import { applyCraftAction } from './apply'
import { computeTargetHit } from './target-hit'
import { modMatchesTargetQuery } from './target-match'
import { cloneItemState, makeRng } from './roll'
import type { CraftDataset, CraftItemMod, CraftItemState, CraftPathQuery, CraftPathResult } from './types'

const DEFAULT_SAMPLES = 250
const DEFAULT_MAX_TRIALS = 40
const MAX_SAMPLES = 500
const MAX_TRIALS = 80
const MAX_TOTAL_APPLIES = 20_000

function stateMatchesTarget(state: CraftItemState, query: string, kind: 'all' | 'p' | 's'): boolean {
  return state.mods.some((m) => !m.veiled && modMatchesTargetQuery(m, query, kind))
}

function cumulativeAttempts(p: number): CraftPathResult['attemptsTable'] {
  const rows = [1, 2, 3, 5, 10, 20, 50, 100]
  return rows.map((attempts) => ({
    attempts,
    probability: 1 - (1 - p) ** attempts,
  }))
}

function clampSamples(samples: number): number {
  return Math.min(Math.max(1, samples), MAX_SAMPLES)
}

function clampMaxTrials(maxTrials: number): number {
  return Math.min(Math.max(1, maxTrials), MAX_TRIALS)
}

/** Single-step spam (chaos / alt) — reuse target-hit instead of nested Monte Carlo. */
function singleStepSpam(
  data: CraftDataset,
  query: CraftPathQuery,
  target: string,
  kind: 'all' | 'p' | 's',
  samples: number,
): CraftPathResult | null {
  if (query.steps.length !== 1 || !query.steps[0].repeatUntilHit) return null
  const step = query.steps[0]
  const hit = computeTargetHit(data, {
    state: query.state,
    actionId: step.actionId,
    targetQuery: target,
    kind,
    samples: Math.min(samples, 1500),
    omens: step.omens,
  })
  if (hit.hitPerAttempt <= 0) {
    return {
      targetQuery: target,
      hitRate: 0,
      expectedAttempts: null,
      attemptsTable: [],
      steps: query.steps,
      samples: hit.samples,
      note: `${hit.note || 'Target cannot be hit with this recipe on this item.'} (single-step recipe.)`,
    }
  }
  return {
    targetQuery: target,
    hitRate: hit.hitPerAttempt,
    expectedAttempts: hit.expectedAttempts,
    attemptsTable: hit.attemptsTable,
    steps: query.steps,
    samples: hit.samples,
    note: `${hit.note} (single-step recipe — per-currency hit rate = full recipe success rate).`,
  }
}

export function simulateCraftPath(data: CraftDataset, query: CraftPathQuery): CraftPathResult {
  const target = query.targetQuery.trim()
  const kind = query.kind ?? 'all'
  const samples = clampSamples(query.samples ?? DEFAULT_SAMPLES)
  const maxTrials = clampMaxTrials(query.maxTrials ?? DEFAULT_MAX_TRIALS)

  if (!target || !query.steps.length) {
    return {
      targetQuery: target,
      hitRate: 0,
      expectedAttempts: null,
      attemptsTable: [],
      steps: query.steps,
      samples: 0,
      note: 'Add a target mod and at least one craft step.',
    }
  }

  const fast = singleStepSpam(data, query, target, kind, samples)
  if (fast) return fast

  const rng = makeRng(0xbad1dea)
  let hits = 0
  let totalApplies = 0

  for (let trial = 0; trial < samples; trial++) {
    let state = cloneItemState(query.state)
    let hit = false

    stepLoop: for (const step of query.steps) {
      let stepAttempts = 0
      do {
        if (stepAttempts++ >= maxTrials || totalApplies >= MAX_TOTAL_APPLIES) break stepLoop
        totalApplies++
        const seed = (rng() * 0xffffffff) >>> 0
        const result = applyCraftAction(data, state, step.actionId, seed, {
          omens: step.omens ?? state.activeOmens,
        })
        if (!result.ok) break stepLoop
        state = result.state
        if (stateMatchesTarget(state, target, kind)) {
          hit = true
          break stepLoop
        }
      } while (step.repeatUntilHit)
    }
    if (hit) hits++
    if (totalApplies >= MAX_TOTAL_APPLIES) break
  }

  const hitRate = samples > 0 ? hits / samples : 0
  const capped = totalApplies >= MAX_TOTAL_APPLIES
  return {
    targetQuery: target,
    hitRate,
    expectedAttempts: hitRate > 0 ? 1 / hitRate : null,
    attemptsTable: hitRate > 0 ? cumulativeAttempts(hitRate) : [],
    steps: query.steps,
    samples,
    note: capped
      ? `Monte Carlo capped at ${MAX_TOTAL_APPLIES.toLocaleString()} craft rolls — result is approximate. Try a simpler target or fewer steps.`
      : `Monte Carlo (${samples} runs, max ${maxTrials} rolls per spam step): cumulative hit chance for the recipe.`,
  }
}

/** Built-in craft path presets (CoE-style alt/regal flows). */
export const CRAFT_PATH_PRESETS: Array<{
  id: string
  name: string
  desc: string
  steps: CraftPathQuery['steps']
}> = [
  {
    id: 'alt-spam',
    name: 'Alt until hit',
    desc: 'Orb of Alteration until target appears on magic item.',
    steps: [{ actionId: 'currency:Orb of Alteration', repeatUntilHit: true }],
  },
  {
    id: 'alt-regal',
    name: 'Alt → Regal',
    desc: 'Alt until target, then regal (target can be on magic or rare).',
    steps: [{ actionId: 'currency:Orb of Alteration', repeatUntilHit: true }, { actionId: 'currency:Regal Orb' }],
  },
  {
    id: 'scour-alt-regal',
    name: 'Scour → Trans → Alt → Regal',
    desc: 'Reset to normal, transmute, alt for target, regal.',
    steps: [
      { actionId: 'currency:Orb of Scouring' },
      { actionId: 'currency:Orb of Transmutation' },
      { actionId: 'currency:Orb of Alteration', repeatUntilHit: true },
      { actionId: 'currency:Regal Orb' },
    ],
  },
  {
    id: 'chaos-spam',
    name: 'Chaos spam',
    desc: 'Chaos orb until target mod on rare.',
    steps: [{ actionId: 'currency:Chaos Orb', repeatUntilHit: true }],
  },
  {
    id: 'alt-aug-regal',
    name: 'Alt → Aug → Regal',
    desc: 'Alt for prefix, aug if needed, regal.',
    steps: [
      { actionId: 'currency:Orb of Alteration', repeatUntilHit: true },
      { actionId: 'currency:Orb of Augmentation' },
      { actionId: 'currency:Regal Orb' },
    ],
  },
]

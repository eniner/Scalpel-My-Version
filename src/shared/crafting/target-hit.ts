import { resolveSimActionId, labelForActionId } from './actions'
import { tierFloorForCurrency } from './currency-rules'
import { essenceForcedMod } from './essence'
import { allEligibleForExalt } from './pool'
import { groupedOutcomesToFlat, poolToSections } from './group-pool'
import { applyCraftAction } from './apply'
import { cloneItemState, makeRng, rollFreshMagic } from './roll'
import type { CraftDataset, CraftItemMod, CraftItemState, CraftMod, CraftOutcome } from './types'

export interface TargetCraftQuery {
  state: CraftItemState
  actionId: string
  /** Substring match on mod text, group name, or tier name. */
  targetQuery: string
  /** Optional: only match prefix or suffix. */
  kind?: 'all' | 'p' | 's'
  samples?: number
  omens?: string[]
}

export interface TargetCraftResult {
  actionId: string
  label: string
  targetQuery: string
  hitPerAttempt: number
  expectedAttempts: number | null
  attemptsTable: Array<{ attempts: number; probability: number }>
  matchingOutcomes: CraftOutcome[]
  samples: number
  note: string
}

import { modMatchesTargetQuery } from './target-match'

function craftModToOutcome(mod: CraftMod, probability: number): CraftOutcome {
  return {
    text: mod.t || mod.n || mod.g,
    group: mod.g,
    kind: mod.k,
    probability,
  }
}

function cumulativeAttempts(p: number): TargetCraftResult['attemptsTable'] {
  const rows = [1, 2, 3, 5, 10, 20, 50, 100]
  return rows.map((attempts) => ({
    attempts,
    probability: 1 - (1 - p) ** attempts,
  }))
}

function sumMatchingProbability(outcomes: CraftOutcome[], query: string, kind: 'all' | 'p' | 's'): number {
  return outcomes
    .filter((o) => modMatchesTargetQuery({ text: o.text, group: o.group, kind: o.kind }, query, kind))
    .reduce((s, o) => s + o.probability, 0)
}

function exaltPoolOutcomes(
  data: CraftDataset,
  state: CraftItemState,
  tierFloor: number,
): CraftOutcome[] {
  const pool = allEligibleForExalt(data, state, { maxPrefix: 3, maxSuffix: 3, tierFloor })
  const sections = poolToSections(pool, 'all')
  return groupedOutcomesToFlat(sections.flatMap((s) => s.groups))
}

function monteCarloTarget(
  data: CraftDataset,
  state: CraftItemState,
  actionId: string,
  query: string,
  kind: 'all' | 'p' | 's',
  samples: number,
  omens?: string[],
): { hitRate: number; outcomes: CraftOutcome[] } {
  let hits = 0
  const outcomeHits = new Map<string, { mod: CraftItemMod; count: number }>()
  const rng = makeRng(0xc0ffee)
  for (let i = 0; i < samples; i++) {
    const result = applyCraftAction(data, state, actionId, (rng() * 0xffffffff) >>> 0, { omens })
    if (!result.ok) continue
    const added = result.added ?? result.state.mods
    let trialHit = false
    for (const mod of added) {
      if (modMatchesTargetQuery(mod, query, kind)) trialHit = true
      const key = `${mod.kind}:${mod.group}:${mod.text}`
      const prev = outcomeHits.get(key)
      if (prev) prev.count++
      else outcomeHits.set(key, { mod, count: 1 })
    }
    if (!added.length) {
      for (const mod of result.state.mods) {
        if (modMatchesTargetQuery(mod, query, kind)) trialHit = true
      }
    }
    if (trialHit) hits++
  }
  const total = [...outcomeHits.values()].reduce((s, h) => s + h.count, 0) || 1
  const outcomes: CraftOutcome[] = [...outcomeHits.values()].map(({ mod, count }) => ({
    text: mod.text,
    group: mod.group,
    kind: mod.kind,
    probability: count / total,
  }))
  return { hitRate: hits / samples, outcomes }
}

export function computeTargetHit(data: CraftDataset, query: TargetCraftQuery): TargetCraftResult {
  const label = labelForActionId(query.actionId, data)
  const sim = resolveSimActionId(query.actionId, data)
  const tierFloor = query.actionId.startsWith('currency:')
    ? tierFloorForCurrency(query.actionId.slice('currency:'.length))
    : 0
  const kind = query.kind ?? 'all'
  const samples = query.samples ?? 5000
  const q = query.targetQuery.trim()
  if (!q) {
    return {
      actionId: query.actionId,
      label,
      targetQuery: q,
      hitPerAttempt: 0,
      expectedAttempts: null,
      attemptsTable: [],
      matchingOutcomes: [],
      samples: 0,
      note: 'Enter a target mod to search for (e.g. "maximum Life", "fire resistance").',
    }
  }

  let hitPerAttempt = 0
  let matchingOutcomes: CraftOutcome[] = []
  let note = ''

  if (sim === 'exalt' || sim === 'regal') {
    const outcomes = exaltPoolOutcomes(data, query.state, tierFloor)
    matchingOutcomes = outcomes.filter((o) => modMatchesTargetQuery(o, q, kind))
    hitPerAttempt = matchingOutcomes.reduce((s, o) => s + o.probability, 0)
    note = 'Exact: one added mod per attempt (exalt/regal pool).'
  } else if (sim === 'chaos') {
    const pool = allEligibleForExalt(data, query.state, { maxPrefix: 3, maxSuffix: 3, tierFloor })
    const sections = poolToSections(pool, 'all')
    const outcomes = groupedOutcomesToFlat(sections.flatMap((s) => s.groups))
    matchingOutcomes = outcomes.filter((o) => modMatchesTargetQuery(o, q, kind))
    hitPerAttempt = matchingOutcomes.reduce((s, o) => s + o.probability, 0)
    note =
      'Approximate: PoE2 chaos adds one mod from the exalt pool (removed mod slightly changes tags). Assumes added-mod slot only.'
  } else if (sim.startsWith('essence:')) {
    const forced = essenceForcedMod(data, sim.slice('essence:'.length), query.state.baseType)
    if (forced && modMatchesTargetQuery({ text: forced.text, group: forced.group, kind: forced.kind }, q, kind)) {
      hitPerAttempt = 1
      matchingOutcomes = [{ text: forced.text, group: forced.group, kind: forced.kind, probability: 1 }]
    }
    note = 'Essence guarantees one mod — hit is 100% if that mod matches your target.'
  } else if (sim === 'alteration') {
    const rng = makeRng(0xabad1dea)
    const modHits = new Map<string, number>()
    let trials = 0
    let hits = 0
    for (let i = 0; i < samples; i++) {
      const rolled = rollFreshMagic(data, query.state, rng, tierFloor)
      trials++
      const rolledMods = rolled.map((m) => ({
        text: m.t,
        group: m.g,
        kind: m.k,
        name: m.n,
      }))
      if (rolledMods.some((m) => modMatchesTargetQuery(m, q, kind))) hits++
      for (const m of rolled) {
        modHits.set(m.id, (modHits.get(m.id) ?? 0) + 1)
      }
    }
    hitPerAttempt = hits / trials
    matchingOutcomes = rolledPreviewFromHits(data, modHits, trials, q, kind)
    note = `Monte Carlo (${samples} alt rolls): any magic mod line matches target.`
  } else if (sim === 'alchemy') {
  const mc = monteCarloTarget(data, query.state, query.actionId, q, kind, samples, query.omens)
    hitPerAttempt = mc.hitRate
    matchingOutcomes = mc.outcomes.filter((o) => modMatchesTargetQuery(o, q, kind))
    note = `Monte Carlo (${samples} alchemy): any of four rare mods matches target.`
  } else if (sim === 'transmutation' || sim === 'augmentation') {
  const mc = monteCarloTarget(data, query.state, query.actionId, q, kind, samples, query.omens)
    hitPerAttempt = mc.hitRate
    matchingOutcomes = mc.outcomes.filter((o) => modMatchesTargetQuery(o, q, kind))
    note = `Monte Carlo (${samples} rolls) for this action.`
  } else {
    return {
      actionId: query.actionId,
      label,
      targetQuery: q,
      hitPerAttempt: 0,
      expectedAttempts: null,
      attemptsTable: [],
      matchingOutcomes: [],
      samples: 0,
      note: 'Target odds not implemented for this currency yet. Try Chaos, Exalt, Alteration, Alchemy, or Essence.',
    }
  }

  const expectedAttempts = hitPerAttempt > 0 ? 1 / hitPerAttempt : null
  return {
    actionId: query.actionId,
    label,
    targetQuery: q,
    hitPerAttempt,
    expectedAttempts,
    attemptsTable: hitPerAttempt > 0 ? cumulativeAttempts(hitPerAttempt) : [],
    matchingOutcomes: matchingOutcomes.sort((a, b) => b.probability - a.probability),
    samples,
    note,
  }
}

function rolledPreviewFromHits(
  data: CraftDataset,
  hits: Map<string, number>,
  trials: number,
  query: string,
  kind: 'all' | 'p' | 's',
): CraftOutcome[] {
  const out: CraftOutcome[] = []
  for (const [id, count] of hits) {
    const mod = data.mods.find((m) => m.id === id)
    if (!mod) continue
    const o = craftModToOutcome(mod, count / trials)
    if (modMatchesTargetQuery(o, query, kind)) out.push(o)
  }
  return out.sort((a, b) => b.probability - a.probability)
}

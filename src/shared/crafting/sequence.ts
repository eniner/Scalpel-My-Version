import { applyCraftAction } from './apply'
import { createFreshItemState } from './apply'
import { pickRevealIndex, shouldRerollReveal } from './desecration'
import { modMatchesTargetQuery } from './target-match'
import { cloneItemState, makeRng } from './roll'
import type { CraftDataset, CraftItemMod, CraftItemState } from './types'
import type { CraftSequenceConfig, CraftSequenceStep, CraftSequenceCondition } from './catalog-types'
import { estimateChaosCost } from './economy'

export interface CraftSequenceRunResult {
  samples: number
  /** Fraction of trials that met stop conditions before the apply budget ran out. */
  hitRate: number
  /**
   * Mean currency applies among successful trials (CoE-style cost-to-hit).
   * Not 1/hitRate — that number is meaningless when a step loops until conditions.
   */
  expectedAttempts: number | null
  /** Mean applies across all trials (includes timed-out failures). */
  avgApplies: number
  /** Mean estimated chaos-equivalent cost among successful trials. */
  expectedChaosCost?: number | null
  /** Mean applies by actionId among successful trials. */
  appliesByAction?: Record<string, number>
  /** Per-step / trial apply budget used for repeat-until loops. */
  applyCap?: number
  /** Fraction of trials that hit the apply budget without success. */
  timedOutRate?: number
  note: string
  sampleHitMods?: string[]
  warnings?: string[]
}

function conditionsMet(state: CraftItemState, conditions: CraftSequenceCondition[] | undefined): boolean {
  if (!conditions?.length) return true
  return conditions.every((c) => {
    const min = c.countMin ?? 1
    const kind = c.kind ?? 'all'
    const n = state.mods.filter(
      (m) => !m.veiled && modMatchesTargetQuery(m, c.query, kind, { minValue: c.minValue }),
    ).length
    return n >= min
  })
}

function stepSucceeded(state: CraftItemState, step: CraftSequenceStep): boolean {
  if (step.requireConditions === false) return true
  if (!step.conditions?.length) return true
  return conditionsMet(state, step.conditions)
}

function needsMagicItem(actionId: string): boolean {
  return /Orb of Alteration|Orb of Augmentation|Regal Orb/i.test(actionId)
}

function needsRareItem(actionId: string): boolean {
  return /Chaos Orb|Exalted Orb|Orb of Annulment/i.test(actionId)
}

function ensureRarityForAction(
  data: CraftDataset,
  state: CraftItemState,
  actionId: string,
  rng: () => number,
): { state: CraftItemState; prepApplies: number; error?: string } {
  let prepApplies = 0
  let cur = state
  if (needsMagicItem(actionId) && cur.rarity === 'Normal') {
    const seed = (rng() * 0xffffffff) >>> 0
    const prep = applyCraftAction(data, cur, 'currency:Orb of Transmutation', seed)
    prepApplies++
    if (!prep.ok) return { state: cur, prepApplies, error: prep.message }
    cur = prep.state
  }
  if (needsRareItem(actionId) && cur.rarity !== 'Rare') {
    if (cur.rarity === 'Normal') {
      const seed = (rng() * 0xffffffff) >>> 0
      const prep = applyCraftAction(data, cur, 'currency:Orb of Alchemy', seed)
      prepApplies++
      if (!prep.ok) return { state: cur, prepApplies, error: prep.message }
      cur = prep.state
    } else if (cur.rarity === 'Magic') {
      const seed = (rng() * 0xffffffff) >>> 0
      const prep = applyCraftAction(data, cur, 'currency:Regal Orb', seed)
      prepApplies++
      if (!prep.ok) return { state: cur, prepApplies, error: prep.message }
      cur = prep.state
    }
  }
  return { state: cur, prepApplies }
}

type TrialResult = {
  success: boolean
  applies: number
  hitMods?: string[]
  applyFail?: string
  autoPrep: boolean
  appliesByAction: Record<string, number>
}

function yieldMain(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

async function runOneTrial(
  data: CraftDataset,
  start: CraftItemState,
  config: CraftSequenceConfig,
  steps: CraftSequenceStep[],
  maxTrials: number,
  rng: () => number,
  globalTarget: string | undefined,
  /** Yield to the event loop every N currency applies (host path). */
  yieldEvery = 0,
): Promise<TrialResult> {
  let state = cloneItemState(start)
  if (config.rarity) state.rarity = config.rarity
  if (config.quality != null) state.quality = config.quality
  if (config.catalyst) state.catalyst = config.catalyst
  let stepIndex = 0
  let applies = 0
  const appliesByAction: Record<string, number> = {}
  let done = false
  let success = false
  let hitMods: string[] | undefined
  let applyFail: string | undefined
  let autoPrep = false
  // Cap total currency applies for this trial (not × steps — that froze Electron on Chaos spam).
  const applyBudget = maxTrials
  /** Hard stop: avoid freezing the host if branching loops. */
  let outerGuard = 0
  const outerMax = applyBudget + steps.length + 4
  let sinceYield = 0

  const coopYield = async () => {
    if (yieldEvery <= 0) return
    if (++sinceYield >= yieldEvery) {
      sinceYield = 0
      await yieldMain()
    }
  }

  while (!done && applies < applyBudget && outerGuard++ < outerMax) {
    if (stepIndex < 0 || stepIndex >= steps.length) {
      done = true
      break
    }
    const step = steps[stepIndex]
    let loopGuard = 0
    let stepOk = false
    let permanentFail = false

    do {
      const prep = ensureRarityForAction(data, state, step.actionId, rng)
      applies += prep.prepApplies
      if (prep.prepApplies > 0) {
        autoPrep = true
        appliesByAction['currency:Orb of Alchemy'] =
          (appliesByAction['currency:Orb of Alchemy'] ?? 0) + prep.prepApplies
        await coopYield()
      }
      if (prep.error) {
        applyFail = prep.error
        stepOk = false
        permanentFail = true
        break
      }
      state = prep.state

      const seed = (rng() * 0xffffffff) >>> 0
      const result = applyCraftAction(data, state, step.actionId, seed, { omens: step.omens })
      applies++
      appliesByAction[step.actionId] = (appliesByAction[step.actionId] ?? 0) + 1
      await coopYield()
      if (!result.ok) {
        applyFail = result.message
        stepOk = false
        // Rarity / fractured errors won't recover by looping the same action.
        permanentFail = /Only applies|No removable|no modifiers|Could not roll|already has a desecrated/i.test(
          result.message,
        )
        break
      }
      state = result.state

      // CoE Sequence: resolve desecration pick-3 immediately (prefer condition match).
      const matchChoice = (m: CraftItemMod) => {
        if (step.conditions?.length) {
          return step.conditions.some((c) =>
            modMatchesTargetQuery(m, c.query, c.kind ?? 'all', { minValue: c.minValue }),
          )
        }
        if (globalTarget) return modMatchesTargetQuery(m, globalTarget, 'all')
        return false
      }
      let revealGuard = 0
      while (state.revealChoices && revealGuard++ < 6) {
        const choices = state.revealChoices
        if (shouldRerollReveal(choices, matchChoice)) {
          const reroll = applyCraftAction(data, state, 'desecration:reveal', (rng() * 0xffffffff) >>> 0, {
            rerollReveal: true,
          })
          if (!reroll.ok) {
            applyFail = reroll.message
            permanentFail = true
            break
          }
          state = reroll.state
          continue
        }
        const pickIndex = pickRevealIndex(choices, { match: matchChoice })
        const revealed = applyCraftAction(data, state, 'desecration:reveal', (rng() * 0xffffffff) >>> 0, {
          pickIndex,
        })
        if (!revealed.ok) {
          applyFail = revealed.message
          permanentFail = true
          break
        }
        state = revealed.state
      }
      if (permanentFail) {
        stepOk = false
        break
      }

      stepOk = stepSucceeded(state, step)
      loopGuard++
      if (stepOk) break
      if (!step.repeatUntilHit && step.requireConditions !== true) break
    } while (step.repeatUntilHit && loopGuard < maxTrials && applies < applyBudget)

    if (globalTarget) {
      const hit = state.mods.some((m) => modMatchesTargetQuery(m, globalTarget, 'all'))
      if (hit) {
        success = true
        hitMods = state.mods.map((m) => m.text)
        done = true
        break
      }
    }

    if (stepOk) {
      const act = step.onSuccess ?? 'continue'
      if (act === 'stop') {
        success = !globalTarget || state.mods.some((m) => modMatchesTargetQuery(m, globalTarget!, 'all'))
        if (success) hitMods = state.mods.map((m) => m.text)
        done = true
      } else if (act === 'goto' && step.onSuccessGoto != null) {
        stepIndex = step.onSuccessGoto
      } else {
        stepIndex++
        if (stepIndex >= steps.length) {
          success = !globalTarget || conditionsMet(state, [{ query: globalTarget!, countMin: 1 }])
          if (!globalTarget) success = true
          if (success) hitMods = state.mods.map((m) => m.text)
          done = true
        }
      }
    } else {
      const act = step.onFailure ?? 'loop'
      if (act === 'restart') {
        state = cloneItemState(start)
        if (config.rarity) state.rarity = config.rarity
        stepIndex = 0
      } else if (act === 'goto' && step.onFailureGoto != null) {
        stepIndex = step.onFailureGoto
      } else if (act === 'stop' || permanentFail) {
        done = true
      }
      // else loop same step (budget-limited)
    }
  }

  return { success, applies, hitMods, applyFail, autoPrep, appliesByAction }
}

/** Host-safe caps — rare T1 Chaos spam must not pin the Electron main thread. */
const HOST_MAX_SAMPLES = 40
const HOST_MAX_TRIALS = 80

/**
 * CoE-style sequence Monte Carlo: method per step, conditions, success/fail branching.
 * Prefer {@link simulateCraftSequenceAsync} from the Electron host (mid-trial yields).
 */
export async function simulateCraftSequence(
  data: CraftDataset,
  config: CraftSequenceConfig,
): Promise<CraftSequenceRunResult> {
  return simulateCraftSequenceAsync(data, config)
}

/** Chunked sequence sim — yields to the event loop so Electron doesn't hard-freeze. */
export async function simulateCraftSequenceAsync(
  data: CraftDataset,
  config: CraftSequenceConfig,
  opts?: { chunkSize?: number; onProgress?: (done: number, total: number) => void },
): Promise<CraftSequenceRunResult> {
  const samples = Math.min(Math.max(config.samples ?? 40, 1), HOST_MAX_SAMPLES)
  const maxTrials = Math.min(Math.max(config.maxTrials ?? 80, 1), HOST_MAX_TRIALS)
  const steps = config.steps
  if (!steps.length) {
    return { samples: 0, hitRate: 0, expectedAttempts: null, avgApplies: 0, note: 'Add at least one sequence step.' }
  }

  const start =
    createFreshItemState(data, config.baseType, config.itemLevel, {
      quality: config.quality,
      catalyst: config.catalyst,
    }) ??
    ({
      baseType: config.baseType,
      itemLevel: config.itemLevel,
      rarity: config.rarity ?? 'Normal',
      tags: [],
      itemClass: '',
      corrupted: false,
      mods: [],
    } satisfies CraftItemState)

  const rng = makeRng(0xc0e5e9)
  let hits = 0
  let totalApplies = 0
  let hitApplies = 0
  let timedOut = 0
  let hitMods: string[] | undefined
  const hitActionTotals: Record<string, number> = {}
  let hitChaos = 0
  const globalTarget = config.targetQuery?.trim()
  const warnings = new Set<string>()
  let applyFailCount = 0
  let lastApplyFail = ''
  const applyBudget = maxTrials

  if (
    steps.some(
      (s) =>
        s.repeatUntilHit &&
        s.requireConditions !== false &&
        (!s.conditions?.length || s.conditions.every((c) => !c.query.trim())),
    )
  ) {
    warnings.add('A step repeats until conditions, but no condition text was set — it will never “hit”.')
  }

  // Warm mod index once before the loop (first eligibleMods call).
  createFreshItemState(data, config.baseType, config.itemLevel)
  await yieldMain()

  for (let trial = 0; trial < samples; trial++) {
    const one = await runOneTrial(data, start, config, steps, maxTrials, rng, globalTarget, 8)
    totalApplies += one.applies
    if (one.autoPrep) {
      warnings.add('Auto-applied Transmute/Alchemy/Regal so currency rarity rules match Craft of Exile.')
    }
    if (one.applyFail) {
      applyFailCount++
      lastApplyFail = one.applyFail
    }
    if (one.success) {
      hits++
      hitApplies += one.applies
      for (const [k, v] of Object.entries(one.appliesByAction)) {
        hitActionTotals[k] = (hitActionTotals[k] ?? 0) + v
      }
      hitChaos += estimateChaosCost(one.appliesByAction, config.chaosPrices, data).totalChaos
      if (one.hitMods) hitMods = one.hitMods
    } else if (!one.applyFail && one.applies >= applyBudget) {
      timedOut++
    }
    opts?.onProgress?.(trial + 1, samples)
    await yieldMain()
  }

  if (hits === 0 && applyFailCount > samples / 2) {
    warnings.add(`Currency kept failing (${lastApplyFail || 'see method rarity rules'}).`)
  }
  if (timedOut > 0) {
    warnings.add(
      `${timedOut}/${samples} trials hit the apply cap (~${applyBudget} applies) before the condition — cost estimate uses successful trials only.`,
    )
  }

  const hitRate = hits / samples
  const warnList = [...warnings]
  return {
    samples,
    hitRate,
    expectedAttempts: hits > 0 ? hitApplies / hits : null,
    expectedChaosCost: hits > 0 ? hitChaos / hits : null,
    appliesByAction:
      hits > 0
        ? Object.fromEntries(Object.entries(hitActionTotals).map(([k, v]) => [k, v / hits]))
        : undefined,
    avgApplies: totalApplies / samples,
    applyCap: applyBudget,
    timedOutRate: timedOut / samples,
    note: [
      globalTarget
        ? `CoE-style sequence · target “${globalTarget}” · ${samples} trials · apply cap ${applyBudget}.`
        : `CoE-style sequence · step conditions · ${samples} trials · apply cap ${applyBudget}.`,
      ...warnList,
    ].join(' '),
    sampleHitMods: hitMods,
    warnings: warnList.length ? warnList : undefined,
  }
}

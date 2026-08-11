import { createFreshItemState } from './apply'
import type { CraftSequenceConfig, CraftSequenceStep } from './catalog-types'
import { estimateChaosCost } from './economy'
import { getCraftModIndex } from './mod-index'
import { computeTargetHit } from './target-hit'
import type { CraftDataset, CraftItemState } from './types'
import type { CraftSequenceRunResult } from './sequence'

/**
 * Host-safe Sequence odds (no Monte Carlo — keeps Electron responsive).
 *
 * Chaos / Greater / Perfect: same formula as CoE’s affix table —
 *   expected applies = 1 / (tierWeight / openPoolWeight)
 * with that currency’s min-mod-level floor. Live CoE (Sekhema T1 ES%):
 *   Chaos ≈ 44 (2.273%), Greater ≈ 21, Perfect ≈ 12.
 */
export function estimateCraftSequence(
  data: CraftDataset,
  config: CraftSequenceConfig,
): CraftSequenceRunResult {
  const steps = config.steps
  if (!steps.length) {
    return { samples: 0, hitRate: 0, expectedAttempts: null, avgApplies: 0, note: 'Add at least one sequence step.' }
  }

  getCraftModIndex(data)
  const base = createFreshItemState(data, config.baseType, config.itemLevel, {
    quality: config.quality,
    catalyst: config.catalyst,
  })
  if (!base) {
    return {
      samples: 0,
      hitRate: 0,
      expectedAttempts: null,
      avgApplies: 0,
      note: `Unknown base “${config.baseType}”.`,
    }
  }

  const spam = findPrimarySpamStep(steps)
  const target = pickTargetQuery(spam, config.targetQuery)
  if (!spam || !target.query) {
    return {
      samples: 0,
      hitRate: 0,
      expectedAttempts: null,
      avgApplies: steps.length,
      note: 'Needs a “repeat until conditions” step with a mod condition (or a global target).',
      warnings: ['Add Repeat-until + Browse mods (T1) on the spam currency step.'],
    }
  }

  const queryForHit =
    target.minValue != null && !/^>=\s*-?\d+/i.test(target.query)
      ? `>=${target.minValue} ${target.query}`
      : target.query
  const kind = target.kind ?? 'all'

  // CoE calculator pool: open-affix odds on a blank rare (no blocked groups).
  const state: CraftItemState = {
    ...base,
    rarity: 'Rare',
    mods: [],
    revealChoices: undefined,
  }

  const hit = computeTargetHit(data, {
    state,
    actionId: spam.actionId,
    targetQuery: queryForHit,
    kind,
    samples: 120,
    omens: spam.omens,
  })

  const hitRate = hit.hitPerAttempt
  const expectedAttempts = hit.expectedAttempts
  const sampleHitMods = hit.matchingOutcomes.slice(0, 3).map((o) => o.text)
  const warnings: string[] = []
  if (hit.note) warnings.push(hit.note)
  if (/chaos/i.test(spam.actionId)) {
    warnings.push(
      'Matches CoE affix-table odds (blank rare, currency tier floor). Mid-craft blocked groups change real chaos spam.',
    )
  }

  const appliesByAction: Record<string, number> = {
    'currency:Orb of Alchemy': 1,
  }
  if (expectedAttempts != null && expectedAttempts > 0) {
    appliesByAction[spam.actionId] = expectedAttempts
  }
  for (const s of steps) {
    if (s.id === spam?.id) continue
    if (s.actionId === 'currency:Orb of Alchemy') continue
    if (s.actionId.startsWith('socketable:')) continue
    appliesByAction[s.actionId] = (appliesByAction[s.actionId] ?? 0) + 1
  }

  const cost = estimateChaosCost(appliesByAction, config.chaosPrices, data)
  if (hitRate <= 0) {
    warnings.push('No matching tiers in the current pool — lower Min roll or pick another mod.')
  }

  return {
    samples: 1,
    hitRate,
    expectedAttempts,
    expectedChaosCost: cost.totalChaos,
    appliesByAction,
    avgApplies: expectedAttempts != null ? expectedAttempts + 1 : 1,
    note: warnings.join(' '),
    sampleHitMods,
    warnings,
  }
}

function findPrimarySpamStep(steps: CraftSequenceStep[]): CraftSequenceStep | undefined {
  return (
    steps.find(
      (s) =>
        s.repeatUntilHit &&
        s.requireConditions !== false &&
        s.conditions?.some((c) => c.query.trim()),
    ) ?? steps.find((s) => s.repeatUntilHit)
  )
}

function pickTargetQuery(
  spam: CraftSequenceStep | undefined,
  globalTarget: string | undefined,
): { query: string; minValue?: number; kind?: 'all' | 'p' | 's' } {
  const cond = spam?.conditions?.find((c) => c.query.trim())
  if (cond) return { query: cond.query.trim(), minValue: cond.minValue, kind: cond.kind ?? 'all' }
  if (globalTarget?.trim()) return { query: globalTarget.trim(), kind: 'all' }
  return { query: '' }
}

const fs = require('node:fs')
const path = require('node:path')
const p = path.join(__dirname, '..', 'src', 'shared', 'crafting', 'sequence.ts')
let s = fs.readFileSync(p, 'utf8')

if (!s.includes("from './economy'")) {
  s = s.replace(
    "import type { CraftSequenceConfig, CraftSequenceStep, CraftSequenceCondition } from './catalog-types'",
    "import type { CraftSequenceConfig, CraftSequenceStep, CraftSequenceCondition } from './catalog-types'\nimport { estimateChaosCost } from './economy'",
  )
}

s = s.replace(
  `export interface CraftSequenceRunResult {
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
  /** Per-step / trial apply budget used for repeat-until loops. */
  applyCap?: number
  /** Fraction of trials that hit the apply budget without success. */
  timedOutRate?: number
  note: string
  sampleHitMods?: string[]
  warnings?: string[]
}`,
  `export interface CraftSequenceRunResult {
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
}`,
)

// Change runOneTrial return + tracking
s = s.replace(
  `): { success: boolean; applies: number; hitMods?: string[]; applyFail?: string; autoPrep: boolean } {
  let state = cloneItemState(start)
  if (config.rarity) state.rarity = config.rarity
  let stepIndex = 0
  let applies = 0
  let done = false
  let success = false
  let hitMods: string[] | undefined
  let applyFail: string | undefined
  let autoPrep = false`,
  `): {
  success: boolean
  applies: number
  hitMods?: string[]
  applyFail?: string
  autoPrep: boolean
  appliesByAction: Record<string, number>
} {
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
  let autoPrep = false`,
)

// Count prep applies roughly as alchemy/transmute
s = s.replace(
  `      const prep = ensureRarityForAction(data, state, step.actionId, rng)
      applies += prep.prepApplies
      if (prep.prepApplies > 0) autoPrep = true`,
  `      const prep = ensureRarityForAction(data, state, step.actionId, rng)
      applies += prep.prepApplies
      if (prep.prepApplies > 0) {
        autoPrep = true
        appliesByAction['currency:Orb of Alchemy'] =
          (appliesByAction['currency:Orb of Alchemy'] ?? 0) + prep.prepApplies
      }`,
)

s = s.replace(
  `      const result = applyCraftAction(data, state, step.actionId, seed, { omens: step.omens })
      applies++
      if (!result.ok) {`,
  `      const result = applyCraftAction(data, state, step.actionId, seed, { omens: step.omens })
      applies++
      appliesByAction[step.actionId] = (appliesByAction[step.actionId] ?? 0) + 1
      if (!result.ok) {`,
)

s = s.replace(
  `  return { success, applies, hitMods, applyFail, autoPrep }
}`,
  `  return { success, applies, hitMods, applyFail, autoPrep, appliesByAction }
}`,
)

// Fix both simulate functions' start state + aggregation - do with a helper replace for createFresh
s = s.replace(
  /const start =\r?\n    createFreshItemState\(data, config\.baseType, config\.itemLevel\) \?\?/g,
  `const start =
    createFreshItemState(data, config.baseType, config.itemLevel, {
      quality: config.quality,
      catalyst: config.catalyst,
    }) ??`,
)

// Sync simulate loop aggregation
const oldLoop = `  let hits = 0
  let totalApplies = 0
  let hitApplies = 0
  let timedOut = 0
  let hitMods: string[] | undefined
  const globalTarget = config.targetQuery?.trim()
  const warnings = new Set<string>()
  let applyFailCount = 0
  let lastApplyFail = ''
  const applyBudget = maxTrials * Math.max(1, steps.length)`

const newLoop = `  let hits = 0
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
  const applyBudget = maxTrials * Math.max(1, steps.length)`

if (!s.includes(oldLoop)) {
  console.error('loop header not found')
  process.exit(1)
}
s = s.split(oldLoop).join(newLoop)

s = s.replace(
  /if \(one\.success\) \{\r?\n      hits\+\+\r?\n      hitApplies \+= one\.applies\r?\n      if \(one\.hitMods\) hitMods = one\.hitMods\r?\n    \} else if \(!one\.applyFail && one\.applies >= applyBudget\) \{\r?\n      timedOut\+\+\r?\n    \}/g,
  `if (one.success) {
      hits++
      hitApplies += one.applies
      for (const [k, v] of Object.entries(one.appliesByAction)) {
        hitActionTotals[k] = (hitActionTotals[k] ?? 0) + v
      }
      hitChaos += estimateChaosCost(one.appliesByAction).totalChaos
      if (one.hitMods) hitMods = one.hitMods
    } else if (!one.applyFail && one.applies >= applyBudget) {
      timedOut++
    }`,
)

s = s.replace(
  /expectedAttempts: hits > 0 \? hitApplies \/ hits : null,\r?\n    avgApplies: totalApplies \/ samples,/g,
  `expectedAttempts: hits > 0 ? hitApplies / hits : null,
    expectedChaosCost: hits > 0 ? hitChaos / hits : null,
    appliesByAction:
      hits > 0
        ? Object.fromEntries(Object.entries(hitActionTotals).map(([k, v]) => [k, v / hits]))
        : undefined,
    avgApplies: totalApplies / samples,`,
)

// Raise default maxTrials already 400/2000 - ensure samples up to 200 stays
// Fix async chunk path - may still have old createFresh without opts - already replaced globally

fs.writeFileSync(p, s)
console.log('sequence patched', (s.match(/expectedChaosCost/g) || []).length)

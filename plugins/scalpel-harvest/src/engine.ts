import type { CatalogItem, FlipStrategy, StrategyResult } from './types'

const TOLERANCE = 1e-9
const MAX_ITERS = 1000

/** Group catalog items by tier (Harvest pools convert within a tier). */
export function groupByTier(items: CatalogItem[]): CatalogItem[][] {
  const map = new Map<number, CatalogItem[]>()
  for (const item of items) {
    const list = map.get(item.tier) ?? []
    list.push(item)
    map.set(item.tier, list)
  }
  return [...map.values()]
}

/**
 * Harvest conversion odds: convert item A → any other item in the same tier,
 * weighted by target weight / (tierTotal − ownWeight). Matches Gains of Exile.
 */
export function buildFlipChances(items: CatalogItem[]): Record<string, Record<string, number>> {
  const chances: Record<string, Record<string, number>> = {}
  for (const tierItems of groupByTier(items)) {
    if (tierItems.length < 2) {
      throw new Error(`Tier ${tierItems[0]?.tier} needs at least 2 items to convert`)
    }
    const total = tierItems.reduce((sum, i) => sum + i.weight, 0)
    for (const from of tierItems) {
      const next: Record<string, number> = {}
      const denom = total - from.weight
      for (const to of tierItems) {
        if (to.id === from.id) continue
        next[to.id] = to.weight / denom
      }
      chances[from.id] = next
    }
  }
  for (const [id, next] of Object.entries(chances)) {
    const sum = Object.values(next).reduce((a, b) => a + b, 0)
    if (Math.abs(1 - sum) > 1e-6) {
      throw new Error(`Flip chances for ${id} sum to ${sum}, expected 1`)
    }
  }
  return chances
}

/** Normalized display weight % within each tier. */
export function tierWeightPercents(items: CatalogItem[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const tierItems of groupByTier(items)) {
    const total = tierItems.reduce((sum, i) => sum + i.weight, 0)
    for (const item of tierItems) out[item.id] = total > 0 ? item.weight / total : 0
  }
  return out
}

/**
 * One-step: max(sell, EV[sell outcomes] − cost).
 * Payoff for UI = that value − sell (positive ⇒ flip).
 */
export function oneStepValues(
  sellPrices: Record<string, number>,
  flipChances: Record<string, Record<string, number>>,
  rerollCost: number,
): Record<string, number> {
  const values: Record<string, number> = {}
  for (const [id, sellNow] of Object.entries(sellPrices)) {
    const chances = flipChances[id] ?? {}
    let expectedSale = 0
    for (const [nextId, chance] of Object.entries(chances)) {
      expectedSale += chance * (sellPrices[nextId] ?? 0)
    }
    values[id] = Math.max(sellNow, expectedSale - rerollCost)
  }
  return values
}

/** Bellman value iteration (Gains of Exile / FAQ). */
export function optimalValues(
  sellPrices: Record<string, number>,
  flipChances: Record<string, Record<string, number>>,
  rerollCost: number,
  tolerance = TOLERANCE,
  maxIterations = MAX_ITERS,
): Record<string, number> {
  let values = { ...sellPrices }
  for (let iter = 0; iter < maxIterations; iter++) {
    const updated: Record<string, number> = {}
    let largest = 0
    for (const [id, sellNow] of Object.entries(sellPrices)) {
      const chances = flipChances[id] ?? {}
      let reroll = -rerollCost
      for (const [nextId, chance] of Object.entries(chances)) {
        reroll += chance * (values[nextId] ?? 0)
      }
      const next = Math.max(sellNow, reroll)
      updated[id] = next
      largest = Math.max(largest, Math.abs(next - (values[id] ?? 0)))
    }
    values = updated
    if (largest < tolerance) break
  }
  return values
}

export function payoffsFromValues(
  values: Record<string, number>,
  sellPrices: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const id of Object.keys(sellPrices)) {
    out[id] = (values[id] ?? 0) - (sellPrices[id] ?? 0)
  }
  return out
}

/**
 * Expected flips per item when the flip set is fixed (GoE `St`).
 * Only items in `flipIds` are candidates to be flipped.
 */
export function expectedFlipsPerItem(items: CatalogItem[], flipIds: string[]): Record<string, number> {
  const flipSet = new Set(flipIds)
  const out: Record<string, number> = {}
  for (const tierItems of groupByTier(items)) {
    const total = tierItems.reduce((sum, i) => sum + i.weight, 0)
    const flipInTier = tierItems.filter((i) => flipSet.has(i.id))
    const flipWeight = flipInTier.reduce((sum, i) => sum + i.weight, 0)
    const keepWeight = total - flipWeight
    const flipWeightSq = flipInTier.reduce((sum, i) => sum + i.weight * i.weight, 0)
    const b = keepWeight > 0 ? (total * flipWeight - flipWeightSq) / keepWeight : 0
    for (const item of tierItems) {
      out[item.id] = flipSet.has(item.id) ? (total - item.weight + b) / total : 0
    }
  }
  return out
}

/** Redistribute inventory after flipping the flip set (GoE `yt`). */
export function afterFlipCounts(
  items: CatalogItem[],
  counts: Record<string, number>,
  flipIds: string[],
): Record<string, number> {
  const flipSet = new Set(flipIds)
  const out: Record<string, number> = Object.fromEntries(items.map((i) => [i.id, 0]))
  for (const tierItems of groupByTier(items)) {
    const keepers = tierItems.filter((i) => !flipSet.has(i.id))
    const keepWeight = keepers.reduce((sum, i) => sum + i.weight, 0)
    for (const item of tierItems) {
      const qty = counts[item.id] ?? 0
      if (!flipSet.has(item.id) || keepWeight === 0) {
        out[item.id] = (out[item.id] ?? 0) + qty
        continue
      }
      for (const keep of keepers) {
        out[keep.id] = (out[keep.id] ?? 0) + qty * (keep.weight / keepWeight)
      }
    }
  }
  return out
}

export function computeStrategy(opts: {
  items: CatalogItem[]
  counts: Record<string, number>
  buyPrices: Record<string, number>
  sellPrices: Record<string, number>
  flipChances: Record<string, Record<string, number>>
  rerollCostChaos: number
  lfCost: number
  strategy: FlipStrategy
}): StrategyResult {
  const { items, counts, buyPrices, sellPrices, flipChances, rerollCostChaos, lfCost, strategy } =
    opts

  const values =
    strategy === 'one-step'
      ? oneStepValues(sellPrices, flipChances, rerollCostChaos)
      : optimalValues(sellPrices, flipChances, rerollCostChaos)

  const payoffs = payoffsFromValues(values, sellPrices)
  const flipIds = items.filter((i) => (payoffs[i.id] ?? 0) > 0).map((i) => i.id)

  const expectedFlips = expectedFlipsPerItem(items, flipIds)
  let expectedFlipsTotal = 0
  const expectedFlipsAll: Record<string, number> = {}
  for (const item of items) {
    const n = (expectedFlips[item.id] ?? 0) * (counts[item.id] ?? 0)
    expectedFlipsAll[item.id] = n
    expectedFlipsTotal += n
  }

  const lifeforceNeeded = lfCost * expectedFlipsTotal
  const lifeforceChaosCost = expectedFlipsTotal * rerollCostChaos

  let buyTotalChaos = 0
  let sellAsIsChaos = 0
  for (const item of items) {
    const qty = counts[item.id] ?? 0
    buyTotalChaos += (buyPrices[item.id] ?? 0) * qty
    sellAsIsChaos += (sellPrices[item.id] ?? 0) * qty
  }

  const afterCounts = afterFlipCounts(items, counts, flipIds)
  let sellAfterChaos = 0
  for (const item of items) {
    sellAfterChaos += (afterCounts[item.id] ?? 0) * (sellPrices[item.id] ?? 0)
  }

  const expectedProfitChaos = sellAfterChaos - lifeforceChaosCost - buyTotalChaos
  const invested = buyTotalChaos + lifeforceChaosCost
  const roiPct = invested > 0 ? (expectedProfitChaos / invested) * 100 : null

  return {
    payoffs,
    flipIds,
    expectedFlips,
    expectedFlipsTotal,
    afterCounts,
    lifeforceNeeded,
    lifeforceChaosCost,
    sellAsIsChaos,
    sellAfterChaos,
    buyTotalChaos,
    expectedProfitChaos,
    roiPct,
  }
}

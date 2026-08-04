import { describe, expect, it } from 'vitest'
import {
  afterFlipCounts,
  buildFlipChances,
  computeStrategy,
  expectedFlipsPerItem,
  oneStepValues,
  optimalValues,
  payoffsFromValues,
} from './engine'
import type { CatalogItem } from './types'

const equal4: CatalogItem[] = [
  { id: 'A', shortName: 'A', type: 1, tier: 1, weight: 1 },
  { id: 'B', shortName: 'B', type: 2, tier: 1, weight: 1 },
  { id: 'C', shortName: 'C', type: 3, tier: 1, weight: 1 },
  { id: 'D', shortName: 'D', type: 4, tier: 1, weight: 1 },
]

describe('buildFlipChances', () => {
  it('excludes self and sums to 1', () => {
    const chances = buildFlipChances(equal4)
    expect(chances.A.A).toBeUndefined()
    expect(chances.A.B).toBeCloseTo(1 / 3)
    expect(Object.values(chances.A).reduce((a, b) => a + b, 0)).toBeCloseTo(1)
  })
})

describe('one-step vs optimal', () => {
  it('matches FAQ-style one-step decision', () => {
    // Own A=10c; outcomes average 11; cost 2 → EV 9 < 10 → keep
    const sell = { A: 10, B: 11, C: 11, D: 11 }
    const chances = buildFlipChances(equal4)
    const values = oneStepValues(sell, chances, 2)
    expect(values.A).toBe(10)
    expect(payoffsFromValues(values, sell).A).toBe(0)
  })

  it('flips when one-step EV beats sell', () => {
    const sell = { A: 10, B: 20, C: 20, D: 20 }
    const chances = buildFlipChances(equal4)
    const values = oneStepValues(sell, chances, 2)
    // EV outcomes = 20, −2 = 18 > 10
    expect(values.A).toBe(18)
    expect(payoffsFromValues(values, sell).A).toBe(8)
  })

  it('optimal is at least one-step', () => {
    const sell = { A: 5, B: 6, C: 40, D: 6 }
    const chances = buildFlipChances(equal4)
    const cost = 1
    const one = oneStepValues(sell, chances, cost)
    const opt = optimalValues(sell, chances, cost)
    for (const id of Object.keys(sell)) {
      expect(opt[id]).toBeGreaterThanOrEqual(one[id] - 1e-9)
    }
  })
})

describe('expectedFlipsPerItem + afterFlipCounts', () => {
  it('keeps inventory when nothing flips', () => {
    const counts = { A: 10, B: 0, C: 0, D: 0 }
    expect(expectedFlipsPerItem(equal4, []).A).toBe(0)
    expect(afterFlipCounts(equal4, counts, [])).toEqual({ A: 10, B: 0, C: 0, D: 0 })
  })
})

describe('computeStrategy', () => {
  it('marks expensive outliers as keep and cheap as flip', () => {
    const sell = { A: 1, B: 1, C: 1, D: 100 }
    const buy = { A: 1, B: 1, C: 1, D: 100 }
    const counts = { A: 25, B: 25, C: 25, D: 25 }
    const chances = buildFlipChances(equal4)
    const result = computeStrategy({
      items: equal4,
      counts,
      buyPrices: buy,
      sellPrices: sell,
      flipChances: chances,
      rerollCostChaos: 2,
      lfCost: 30,
      strategy: 'one-step',
    })
    expect(result.flipIds).toContain('A')
    expect(result.flipIds).not.toContain('D')
  })
})

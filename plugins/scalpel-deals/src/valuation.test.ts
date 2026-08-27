import { describe, expect, it } from 'vitest'
import { computeStats, isUnderpriced, scoreMods, sortedFinite } from './valuation'

describe('sortedFinite', () => {
  it('drops non-positive and non-finite values then sorts', () => {
    expect(sortedFinite([3, Number.NaN, 1, 0, -2, 2, Number.POSITIVE_INFINITY])).toEqual([1, 2, 3])
  })
})

describe('computeStats', () => {
  it('returns null for empty input', () => {
    expect(computeStats([])).toBeNull()
  })

  it('computes median, MAD, and 15th percentile on a known set', () => {
    // 10, 11, 12, 13, 14, 15, 16, 17, 18, 100 — median 14.5, heavy high outlier
    const stats = computeStats([10, 11, 12, 13, 14, 15, 16, 17, 18, 100], 0.15)
    expect(stats).not.toBeNull()
    expect(stats!.count).toBe(10)
    expect(stats!.median).toBe(14.5)
    expect(stats!.percentile).toBeLessThan(stats!.median)
    expect(stats!.mad).toBeGreaterThan(0)
  })
})

describe('isUnderpriced', () => {
  const samples = [10, 11, 12, 12, 13, 13, 14, 14, 15, 16, 18, 20]
  const stats = computeStats(samples, 0.15)!

  it('does not flag until minSamples is met', () => {
    const thin = computeStats([10, 11, 12], 0.15)!
    const r = isUnderpriced(1, thin, { minSamples: 8 })
    expect(r.flagged).toBe(false)
  })

  it('flags a price far below median via multiplier', () => {
    const r = isUnderpriced(4, stats, { multiplier: 0.6, minSamples: 8, percentile: 0.15, madK: 2.5 })
    expect(r.flagged).toBe(true)
    expect(r.reasons).toContain('multiplier')
    expect(r.vsMedian).toBeCloseTo(4 / stats.median, 5)
  })

  it('does not flag a price at the median', () => {
    const r = isUnderpriced(stats.median, stats, { multiplier: 0.6, minSamples: 8 })
    expect(r.flagged).toBe(false)
  })

  it('flags the bottom percentile of a spread-out set', () => {
    const r = isUnderpriced(stats.percentile, stats, {
      multiplier: 0.01,
      madK: 99,
      minSamples: 8,
      percentile: 0.15,
    })
    expect(r.reasons).toContain('percentile')
    expect(r.flagged).toBe(true)
  })
})

describe('scoreMods', () => {
  it('sums weights for matched listing mods and reports missing required', () => {
    const r = scoreMods(
      ['+80 to maximum Life', '12% increased Rarity of Items found'],
      [
        { text: 'maximum Life', weight: 2, required: true },
        { text: 'Rarity of Items', weight: 1 },
        { text: 'to Fire Resistance', weight: 1, required: true },
      ],
    )
    expect(r.score).toBe(3)
    expect(r.maxScore).toBe(4)
    expect(r.missingRequired).toBe(true)
  })
})

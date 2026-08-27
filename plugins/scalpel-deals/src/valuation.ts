/** Robust stats for heavy-tailed PoE listing prices. Pure — no I/O. */

export type ValuationStats = {
  count: number
  median: number
  mad: number
  percentile: number
}

export type FlagReason = 'percentile' | 'mad' | 'multiplier'

export type FlagResult = {
  flagged: boolean
  reasons: FlagReason[]
  vsMedian: number
  stats: ValuationStats
}

export type FlagOptions = {
  /** Flag when price is at or below this quantile of comparables. Default 0.15. */
  percentile: number
  /** Flag when price < median − k × 1.4826 × MAD. Default 2.5. */
  madK: number
  /** Flag when price < multiplier × median (e.g. 0.6). Default 0.6. */
  multiplier: number
  /** Ignore flags until this many comparable samples exist. Default 8. */
  minSamples: number
}

export const DEFAULT_FLAG_OPTIONS: FlagOptions = {
  percentile: 0.15,
  madK: 2.5,
  multiplier: 0.6,
  minSamples: 8,
}

const MAD_SCALE = 1.4826

export function sortedFinite(samples: number[]): number[] {
  return samples.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b)
}

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return Number.NaN
  const clamped = Math.min(1, Math.max(0, q))
  const idx = (sorted.length - 1) * clamped
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]!
  const t = idx - lo
  return sorted[lo]! * (1 - t) + sorted[hi]! * t
}

export function median(sorted: number[]): number {
  return quantile(sorted, 0.5)
}

export function madOf(sorted: number[], med: number): number {
  const deviations = sorted.map((n) => Math.abs(n - med)).sort((a, b) => a - b)
  return median(deviations)
}

export function computeStats(samples: number[], percentile = 0.15): ValuationStats | null {
  const sorted = sortedFinite(samples)
  if (sorted.length === 0) return null
  const med = median(sorted)
  return {
    count: sorted.length,
    median: med,
    mad: madOf(sorted, med),
    percentile: quantile(sorted, percentile),
  }
}

export function isUnderpriced(price: number, stats: ValuationStats, opts: Partial<FlagOptions> = {}): FlagResult {
  const cfg = { ...DEFAULT_FLAG_OPTIONS, ...opts }
  const vsMedian = stats.median > 0 ? price / stats.median : Number.NaN
  const reasons: FlagReason[] = []
  if (!Number.isFinite(price) || price <= 0 || stats.count < cfg.minSamples) {
    return { flagged: false, reasons, vsMedian, stats }
  }
  if (price < stats.median && price <= stats.percentile + Number.EPSILON) {
    reasons.push('percentile')
  }
  const sigma = MAD_SCALE * stats.mad
  if (stats.mad > 0 && price < stats.median - cfg.madK * sigma) {
    reasons.push('mad')
  }
  if (cfg.multiplier > 0 && price < cfg.multiplier * stats.median) {
    reasons.push('multiplier')
  }
  return { flagged: reasons.length > 0, reasons, vsMedian, stats }
}

export type WeightedMod = {
  text: string
  weight: number
  required?: boolean
}

function normMod(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function scoreMods(
  listingMods: string[],
  weights: WeightedMod[],
): { score: number; maxScore: number; missingRequired: boolean } {
  const hay = listingMods.map(normMod)
  let score = 0
  let maxScore = 0
  let missingRequired = false
  for (const w of weights) {
    const needle = normMod(w.text)
    if (!needle) continue
    const weight = Number.isFinite(w.weight) ? w.weight : 0
    maxScore += Math.max(0, weight)
    const hit = hay.some((m) => m.includes(needle) || needle.includes(m))
    if (hit) score += Math.max(0, weight)
    else if (w.required) missingRequired = true
  }
  return { score, maxScore, missingRequired }
}

import type { FilterType } from './types'
import { formatDust } from '../../shared/utils'

export { formatDust }

export function scaleRange(pos: number, min: number, max: number, type: FilterType): number {
  const range = max - min
  if (range <= 0 || pos <= 0) return min
  const t = pos / 1000
  if (type === 'dustIlvl84') {
    return min + Math.round(range * t * t * t)
  }
  const raw = Math.expm1(t * Math.log1p(range))
  if (range <= 10) return min + Math.round(raw * 10) / 10
  return min + Math.round(raw)
}

export function formatRatio(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  if (value >= 10) return String(Math.round(value))
  return value.toFixed(1)
}

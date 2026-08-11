import type { PriceEntry } from '@scalpelpoe/plugin-sdk'
import type { Floor } from './floors'

export function indexPrices(entries: PriceEntry[]): Map<string, PriceEntry> {
  const map = new Map<string, PriceEntry>()
  for (const e of entries) {
    map.set(e.name, e)
    map.set(e.name.toLowerCase(), e)
  }
  return map
}

/** Min/max chaos across all poe.ninja rows for a name (SkillGem emits many variants). */
export function chaosBandForName(
  entries: PriceEntry[],
  name: string,
): { min: number; max: number } | null {
  const key = name.toLowerCase()
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const e of entries) {
    if (e.name.toLowerCase() !== key) continue
    if (!Number.isFinite(e.chaosValue) || e.chaosValue <= 0) continue
    if (e.chaosValue < min) min = e.chaosValue
    if (e.chaosValue > max) max = e.chaosValue
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null
  return { min, max }
}

export function chaosFloor(chaos: number | null | undefined, fallback?: Floor | null): Floor | null {
  if (chaos != null && Number.isFinite(chaos) && chaos > 0) return { chaos }
  return fallback ?? null
}

export function divineRate(byName: Map<string, PriceEntry>): number {
  const d = byName.get('Divine Orb') ?? byName.get('divine orb')
  return d && d.chaosValue > 0 ? d.chaosValue : 180
}

export function mirrorRateDiv(byName: Map<string, PriceEntry>): number {
  const m = byName.get('Mirror of Kalandra') ?? byName.get('mirror of kalandra')
  const cpd = divineRate(byName)
  if (!m || !(m.chaosValue > 0) || !(cpd > 0)) return 380
  return m.chaosValue / cpd
}

/** Convert kebab currency id to PoE display name (small words stay lowercase mid-string). */
export function idToName(id: string): string {
  const small = new Set(['of', 'the', 'and', 'a', 'an', 'to', 'in', 'on', 'for'])
  return id
    .split('-')
    .map((w, i) => {
      if (i > 0 && small.has(w)) return w
      return w.charAt(0).toUpperCase() + w.slice(1)
    })
    .join(' ')
}

export function chaosForName(byName: Map<string, PriceEntry>, name: string): number | null {
  const hit = byName.get(name) ?? byName.get(name.toLowerCase())
  if (!hit || !Number.isFinite(hit.chaosValue)) return null
  return hit.chaosValue
}

export function chaosForId(byName: Map<string, PriceEntry>, id: string): number | null {
  return chaosForName(byName, idToName(id))
}

export function fmtChaos(n: number | null | undefined, cpd = 180): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= cpd) {
    const d = abs / cpd
    return `${sign}${d >= 10 ? d.toFixed(1) : d.toFixed(2)}d`
  }
  if (abs >= 100) return `${sign}${abs.toFixed(0)}c`
  if (abs >= 10) return `${sign}${abs.toFixed(1)}c`
  return `${sign}${abs.toFixed(2)}c`
}

export function fmtSignedChaos(n: number | null | undefined, cpd = 180): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const body = fmtChaos(Math.abs(n), cpd)
  if (n > 0) return `+${body}`
  if (n < 0) return `-${body.replace(/^-/, '')}`
  return body
}

export function parseUserPrice(input: string, cpd: number, mirrorDiv = 380): number | null {
  const match = input.trim().match(/^([0-9.]+)\s*(c|d|m)?$/i)
  if (!match) return null
  const value = parseFloat(match[1])
  if (!Number.isFinite(value)) return null
  const unit = (match[2] || 'c').toLowerCase()
  if (unit === 'd') return value * cpd
  if (unit === 'm') return value * cpd * mirrorDiv
  return value
}

/** Last finite point in a poe.ninja cumulative-% graph (typically ~7 days). */
export function lastGraphPct(graph: Array<number | null> | null | undefined): number | null {
  if (!graph?.length) return null
  for (let i = graph.length - 1; i >= 0; i--) {
    const pct = graph[i]
    if (typeof pct === 'number' && Number.isFinite(pct)) return pct
  }
  return null
}

/**
 * Reconstruct absolute chaos at a graph point from current price + cumulative %.
 * ninja `graph` is % change from an implicit baseline; today ≈ last point.
 */
export function historicalChaos(currentChaos: number, todayPct: number, pointPct: number): number {
  const denom = 1 + todayPct / 100
  const baseline = denom !== 0 ? currentChaos / denom : currentChaos
  return baseline * (1 + pointPct / 100)
}

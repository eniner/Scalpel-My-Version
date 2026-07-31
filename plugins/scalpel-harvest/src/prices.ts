import type { PriceEntry } from '@scalpelpoe/plugin-sdk'
import type { Catalog, LifeforceType } from './types'

export function indexPrices(entries: PriceEntry[]): Map<string, PriceEntry> {
  const map = new Map<string, PriceEntry>()
  for (const e of entries) map.set(e.name, e)
  return map
}

export function chaosForName(byName: Map<string, PriceEntry>, name: string): number | null {
  const hit = byName.get(name)
  if (!hit || !Number.isFinite(hit.chaosValue)) return null
  return hit.chaosValue
}

export function divineRate(byName: Map<string, PriceEntry>): number {
  const d = byName.get('Divine Orb')
  return d && d.chaosValue > 0 ? d.chaosValue : 180
}

export function lifeforceChaosPerUnit(
  byName: Map<string, PriceEntry>,
  catalog: Catalog,
  lfType: LifeforceType,
): number | null {
  return chaosForName(byName, catalog.lifeforceNames[lfType])
}

export function fmtChaos(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 100) return n.toFixed(0)
  if (Math.abs(n) >= 10) return n.toFixed(1)
  return n.toFixed(2)
}

export function fmtPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n.toFixed(1)}%`
}

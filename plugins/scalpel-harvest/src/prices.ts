import { defaultPoeItem, getItemIcon, type PriceEntry } from '@scalpelpoe/plugin-sdk'

export function indexPrices(entries: PriceEntry[]): Map<string, PriceEntry> {
  const map = new Map<string, PriceEntry>()
  for (const e of entries) {
    map.set(e.name, e)
    map.set(e.name.toLowerCase(), e)
  }
  return map
}

export function chaosForName(byName: Map<string, PriceEntry>, name: string): number | null {
  const hit = byName.get(name) ?? byName.get(name.toLowerCase())
  if (!hit || !Number.isFinite(hit.chaosValue)) return null
  return hit.chaosValue
}

export function divineRate(byName: Map<string, PriceEntry>): number {
  const d = byName.get('Divine Orb') ?? byName.get('divine orb')
  return d && d.chaosValue > 0 ? d.chaosValue : 180
}

export function resolveIcon(name: string, priceIcon?: string | null): string | null {
  if (priceIcon) return priceIcon
  try {
    return getItemIcon(defaultPoeItem({ name, baseType: name }))
  } catch {
    return null
  }
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

/** Display a chaos amount in chaos or divine units. */
export function fmtInUnit(chaos: number, unit: 'chaos' | 'divine', cpd: number): string {
  if (!Number.isFinite(chaos)) return '—'
  if (unit === 'divine') {
    const d = cpd > 0 ? chaos / cpd : 0
    return `${fmtChaos(d)}d`
  }
  return `${fmtChaos(chaos)}c`
}

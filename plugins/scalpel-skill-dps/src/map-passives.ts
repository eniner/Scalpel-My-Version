import catalog from './data/ascendancy-keystones-0.5.json'
import { stripNinjaTokens } from './map-equipped'

export type PassiveNodeCard = {
  id: string
  name: string
  iconUrl: string | null
  stats: string[]
  /** Ascendancy class name when this is an ascendancy notable. */
  ascendancyName: string | null
  kind: 'ascendancy' | 'keystone'
}

type CatalogEntry = {
  id: number
  name: string
  stats: string[]
  ascendancyName: string | null
  isKeystone: boolean
  icon?: string | null
}

type RawKeystone = {
  name?: string
  icon?: string
  stats?: string[]
}

type RawCharPassives = {
  keystones?: RawKeystone[]
  passiveSelection?: number[]
  passiveSelectionSet1?: number[]
  passiveSelectionSet2?: number[]
}

/** poe2db hosts tree skill icons; needs a normal Referer (not no-referrer). */
const POE2DB_ICON_BASE = 'https://cdn.poe2db.tw/image'

const CATALOG = catalog as CatalogEntry[]
const BY_ID = new Map(CATALOG.map((e) => [e.id, e]))
const BY_NAME = new Map(CATALOG.map((e) => [e.name.toLowerCase(), e]))

/** Convert PoB `Art/2DArt/.../*.dds` (or ninja `passives/foo.webp`) → CDN URL. */
export function passiveIconUrl(icon: string | null | undefined): string | null {
  if (!icon || typeof icon !== 'string') return null
  if (icon.startsWith('http://') || icon.startsWith('https://')) return icon
  let path = icon.replace(/^\/+/, '')
  if (path.startsWith('passives/')) {
    path = `Art/2DArt/SkillIcons/${path}`
  }
  path = path.replace(/\.dds$/i, '.webp')
  if (!path.toLowerCase().endsWith('.webp') && !path.toLowerCase().endsWith('.png')) {
    path = `${path}.webp`
  }
  return `${POE2DB_ICON_BASE}/${path}`
}

function iconForName(name: string, fallbackIcon?: string | null): string | null {
  const fromCatalog = BY_NAME.get(name.toLowerCase())?.icon
  return passiveIconUrl(fromCatalog ?? fallbackIcon ?? null)
}

function splitStatLines(stats: string[]): string[] {
  const out: string[] = []
  for (const raw of stats) {
    const cleaned = stripNinjaTokens(String(raw ?? ''))
    for (const line of cleaned.split(/\n+/)) {
      const t = line.trim()
      if (t) out.push(t)
    }
  }
  return out
}

function allocatedIds(cm: RawCharPassives): Set<number> {
  const ids = new Set<number>()
  for (const list of [cm.passiveSelection, cm.passiveSelectionSet1, cm.passiveSelectionSet2]) {
    if (!Array.isArray(list)) continue
    for (const id of list) {
      if (typeof id === 'number' && Number.isFinite(id)) ids.add(id)
    }
  }
  return ids
}

/**
 * Ascendancy notables (from allocated passive IDs + tree catalog) and keystones
 * (prefer ninja's `keystones` payload for text; icons from PoB/poe2db paths).
 */
export function mapAscendancyAndKeystones(charModel: unknown): PassiveNodeCard[] {
  const cm = (charModel ?? {}) as RawCharPassives
  const selected = allocatedIds(cm)
  const cards: PassiveNodeCard[] = []
  const seen = new Set<string>()

  for (const id of selected) {
    const entry = BY_ID.get(id)
    if (!entry || entry.isKeystone) continue
    if (!entry.ascendancyName) continue
    const key = entry.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    cards.push({
      id: `asc-${entry.id}`,
      name: entry.name,
      iconUrl: passiveIconUrl(entry.icon),
      stats: entry.stats.map((s) => stripNinjaTokens(s)).filter(Boolean),
      ascendancyName: entry.ascendancyName,
      kind: 'ascendancy',
    })
  }

  for (const [i, k] of (cm.keystones ?? []).entries()) {
    const name = typeof k.name === 'string' ? k.name : ''
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    cards.push({
      id: `ks-ninja-${i}`,
      name,
      iconUrl: iconForName(name, typeof k.icon === 'string' ? k.icon : null),
      stats: splitStatLines(Array.isArray(k.stats) ? k.stats : []),
      ascendancyName: null,
      kind: 'keystone',
    })
  }

  for (const id of selected) {
    const entry = BY_ID.get(id)
    if (!entry?.isKeystone) continue
    const key = entry.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    cards.push({
      id: `ks-${entry.id}`,
      name: entry.name,
      iconUrl: passiveIconUrl(entry.icon),
      stats: entry.stats.map((s) => stripNinjaTokens(s)).filter(Boolean),
      ascendancyName: null,
      kind: 'keystone',
    })
  }

  return cards
}

import type { PoeItem } from '@scalpelpoe/plugin-sdk'
import { defaultPoeItem, externalLinkUrl } from '@scalpelpoe/plugin-sdk'
import type { GearEntry } from './types'

/** Strip `(Str/Dex Base)`-style hints from build-planner base names. */
function normalizeBaseType(raw: string): string {
  return raw
    .trim()
    .replace(/\s*\([^)]*\bBase\b[^)]*\)\s*$/i, '')
    .trim()
}

export interface PluginTradeSearchItem {
  name: string
  baseType: string
  itemClass?: string
  rarity: string
  notes?: string
  /** Pre-parsed stat lines (overrides notes when provided). */
  statPriority?: string[]
  /** When true, search by slot + stats instead of the guide's exact base type. */
  similarItems?: boolean
}

export function gearToTradeItem(entry: GearEntry): Omit<PluginTradeSearchItem, 'notes' | 'statPriority'> {
  if (entry.isUnique) {
    return {
      name: entry.title,
      baseType: entry.subtitle ?? entry.title,
      rarity: 'Unique',
      itemClass: entry.itemClass ?? '',
    }
  }
  const baseType = normalizeBaseType(entry.title)
  return {
    name: '',
    baseType,
    rarity: entry.rarity === 'magic' ? 'Magic' : 'Rare',
    itemClass: entry.itemClass ?? '',
  }
}

/** Map a build-guide gear row to a trade search payload. */
export function gearToTradeSearch(
  entry: GearEntry,
  opts?: { similarItems?: boolean },
): PluginTradeSearchItem {
  return { ...gearToTradeItem(entry), notes: entry.notes, similarItems: opts?.similarItems }
}

export function poedbUrl(entry: GearEntry, poeVersion: 1 | 2): string | null {
  const item: PoeItem = defaultPoeItem(
    {
      name: entry.isUnique ? entry.title : '',
      baseType: entry.isUnique ? (entry.subtitle ?? entry.title) : entry.title,
      rarity: entry.isUnique ? 'Unique' : entry.rarity === 'magic' ? 'Magic' : 'Rare',
      itemClass: entry.itemClass ?? '',
    },
    poeVersion,
  )
  try {
    return externalLinkUrl('poedb', item, poeVersion)
  } catch {
    return null
  }
}

export function wikiUrl(entry: GearEntry, poeVersion: 1 | 2): string | null {
  if (!entry.isUnique) return null
  const item = defaultPoeItem(
    { name: entry.title, baseType: entry.subtitle ?? entry.title, rarity: 'Unique', itemClass: entry.itemClass ?? '' },
    poeVersion,
  )
  try {
    return externalLinkUrl('wiki', item, poeVersion)
  } catch {
    return null
  }
}

import dustValues from '@shared/data/economy/dust-values.json'
import { uniqueDropTierFor, UNIQUE_DROP_TIER_COLORS, UNIQUE_DROP_TIER_ORDER } from '@shared/economy/unique-drop-tier'
import baseToUniques from '@shared/data/items/unique-info.json'
import { getItemClasses } from '@shared/data/items/item-classes'
import type { ActiveFilter, FilterType, SortDir, SortKey, UniqueTierGrade } from './types'

const dustMap = dustValues as Record<string, number>
const _baseToUniques = baseToUniques as Record<string, string[]>
const uniqueToBase: Record<string, string> = {}
for (const [base, uniques] of Object.entries(_baseToUniques)) {
  for (const name of uniques) uniqueToBase[name] = base
}
const _itemClasses = getItemClasses(1)
export const baseClassMap: Record<string, string> = {}
for (const [cls, { bases }] of Object.entries(_itemClasses)) {
  for (const base of bases) baseClassMap[base.name] = cls
}

/** ilvl-84 max-quality dust, same formula Dust Explorer uses. */
function dustIlvl84(baseDust: number): number {
  return Math.round(baseDust * 125 * 20)
}

/** Icon URLs are resolved at render time via shared iconFor/iconMap so ninja
 *  harvest + icon-cache fills show up (the bundled sheet alone is incomplete). */
export const cachedBaseEntries = (() => {
  const entries: {
    name: string
    baseType: string
    itemClass: string
    dustIlvl84: number | null
  }[] = []
  const seen = new Set<string>()
  for (const [base, uniques] of Object.entries(_baseToUniques)) {
    for (const name of uniques) {
      if (seen.has(name)) continue
      seen.add(name)
      const baseDust = dustMap[name]
      entries.push({
        name,
        baseType: base,
        itemClass: baseClassMap[base] || '',
        dustIlvl84: baseDust != null ? dustIlvl84(baseDust) : null,
      })
    }
  }
  return entries
})()

export const TIER_ORDER: UniqueTierGrade[] = [...UNIQUE_DROP_TIER_ORDER]

export const TIER_COLORS: Record<UniqueTierGrade, string> = { ...UNIQUE_DROP_TIER_COLORS }

/** Drop-weight tier from wiki / dust analysis — not economy price. */
export function dropTierFor(name: string): UniqueTierGrade | null {
  return uniqueDropTierFor(name)
}

export const COL_TIER = 36
export const COL_PRICE = 52
export const COL_DUST = 50

export const ALL_FILTER_TYPES: FilterType[] = ['name', 'tier', 'chaosValue', 'dustIlvl84']

export const FILTER_LABELS: Record<FilterType, string> = {
  name: 'Name',
  tier: 'Tier',
  chaosValue: 'Price',
  dustIlvl84: 'Dust Value',
}

export const persistedState: {
  filters: ActiveFilter[]
  sortKey: SortKey
  sortDir: SortDir
} = {
  filters: [],
  sortKey: 'tier',
  sortDir: 'asc',
}

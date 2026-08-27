export type UniqueTierGrade = import('@shared/economy/unique-drop-tier').UniqueDropTier

export interface UniqueTierEntry {
  name: string
  baseType: string
  itemClass: string
  iconUrl: string | null
  chaosValue: number | null
  divineValue: number | null
  dustIlvl84: number | null
  /** Wiki / Prohibited Library drop-weight tier (not price). */
  tier: UniqueTierGrade | null
}

export type SortKey = 'name' | 'chaosValue' | 'dustIlvl84' | 'tier'
export type SortDir = 'asc' | 'desc'
export type FilterType = 'name' | 'chaosValue' | 'dustIlvl84' | 'tier'

export interface ActiveFilter {
  type: FilterType
  value: string
  min: number
  max: number
  /** Selected grades when type === 'tier' */
  tiers: UniqueTierGrade[]
}

export interface CoeCatalogGroup {
  id: string
  name: string
  craftable: boolean
}

export interface CoeCatalogFamily {
  id: string
  groupId: string
  name: string
  jewellery: boolean
}

export interface CoeCatalogItem {
  id: string
  familyId: string
  name: string
  dropLevel: number
  props: Record<string, number | string>
  requirements: Record<string, number | string>
  implicits: string[]
  img?: string
}

export interface CoeCatalog {
  schemaVersion: number
  source: 'coe'
  generatedAt: string
  groups: CoeCatalogGroup[]
  families: CoeCatalogFamily[]
  items: CoeCatalogItem[]
}

/** Craft of Exile–style multi-step sequence (parity target). */
export type SeqOnSuccess = 'continue' | 'goto' | 'stop'
export type SeqOnFailure = 'loop' | 'restart' | 'goto' | 'stop'

export interface CraftSequenceCondition {
  /** Free-text mod query (same matcher as target odds). Supports `>=92 …` for min roll. */
  query: string
  kind?: 'all' | 'p' | 's'
  /** Minimum matching mod count (default 1). */
  countMin?: number
  /** Require the first numeric roll on the mod line to be >= this (e.g. T1 92% ES). */
  minValue?: number
}

export interface CraftSequenceStep {
  id: string
  actionId: string
  omens?: string[]
  /** When true, keep applying until conditions met or maxTrials. */
  repeatUntilHit?: boolean
  conditions?: CraftSequenceCondition[]
  /** If false, step always succeeds after one apply (CoE "Automatic success"). */
  requireConditions?: boolean
  onSuccess?: SeqOnSuccess
  onSuccessGoto?: number
  onFailure?: SeqOnFailure
  onFailureGoto?: number
}

export interface CraftSequenceConfig {
  baseType: string
  itemLevel: number
  quality?: number
  /** Active catalyst name for weight preview/rolls. */
  catalyst?: string
  rarity?: 'Normal' | 'Magic' | 'Rare'
  steps: CraftSequenceStep[]
  /** Global target for hit-rate reporting (optional). */
  targetQuery?: string
  samples?: number
  maxTrials?: number
  /** Chaos-relative price overrides (CoE / ninja). Keys are currency display names. */
  chaosPrices?: Record<string, number>
}

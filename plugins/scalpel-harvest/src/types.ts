export type LifeforceType = 'primal' | 'vivid' | 'wild'

export type FlipStrategy = 'one-step' | 'optimal'

export interface CatalogItem {
  id: string
  shortName: string
  type: number
  tier: number
  weight: number
}

export interface CatalogPool {
  id: string
  name: string
  lfType: LifeforceType
  lfCost: number
  tiers: number[]
  notice?: string
  items: CatalogItem[]
}

export interface Catalog {
  source: string
  lifeforceNames: Record<LifeforceType, string>
  pools: CatalogPool[]
}

export interface RowState {
  id: string
  qty: number
  buy: number
  sell: number
  enabled: boolean
}

export interface StrategyResult {
  /** Expected EV delta of flipping once under the chosen strategy (chaos). */
  payoffs: Record<string, number>
  /** Item ids with +EV to flip. */
  flipIds: string[]
  /** Expected number of flips per owned item (from GoE St). */
  expectedFlips: Record<string, number>
  expectedFlipsTotal: number
  /** Expected inventory after applying flips (from GoE yt). */
  afterCounts: Record<string, number>
  lifeforceNeeded: number
  lifeforceChaosCost: number
  sellAsIsChaos: number
  sellAfterChaos: number
  buyTotalChaos: number
  expectedProfitChaos: number
  roiPct: number | null
}

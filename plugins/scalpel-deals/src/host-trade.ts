import type { ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'

export type SearchItem = {
  name: string
  baseType: string
  itemClass?: string
  rarity: string
  notes?: string
  statPriority?: string[]
  similarItems?: boolean
  upgradeSearch?: boolean
  statKinds?: string[]
  listedTime?: string
  priceMin?: number
  priceMax?: number
}

export type ListingRow = {
  id: string
  name: string
  baseType: string
  priceAmount: number | null
  priceCurrency: string | null
  priceDivine: number | null
  account: string
  online: boolean
  explicitMods: string[]
  implicitMods: string[]
  whisper?: string
  icon?: string
  characterName?: string
  instantBuyout?: boolean
  indexed?: string
}

export function listingPriceLabel(
  row: Pick<ListingRow, 'priceAmount' | 'priceCurrency' | 'priceDivine'>,
): string {
  if (row.priceAmount != null && row.priceCurrency) {
    const n = Number.isInteger(row.priceAmount) ? String(row.priceAmount) : row.priceAmount.toFixed(2)
    return `${n} ${row.priceCurrency}`
  }
  if (row.priceDivine != null) return `${row.priceDivine.toFixed(2)} divine`
  return 'unpriced'
}

export type ScanResult = {
  url: string
  queryId: string
  league?: string
  total: number
  listings: ListingRow[]
  pricesDivine: number[]
}

export type HostTrade = {
  openSearch(item: SearchItem): Promise<{ url: string; queryId: string; total: number }>
  priceCheck(item: SearchItem): Promise<{
    url: string
    queryId: string
    total: number
    pricesDivine: number[]
    cheapestDivine: number | null
    estimateDivine: number | null
    pricedCount: number
  }>
  scanListings?(item: SearchItem): Promise<ScanResult>
  getAuth(): Promise<{ loggedIn: boolean }>
  login(): Promise<void>
  whisperSeller?(queryId: string, listingId: string, league: string): Promise<void>
  visitHideout?(queryId: string, listingId: string, league: string): Promise<void>
}

export type HostCtx = ScalpelPluginContext & { trade: HostTrade }

export function hostTrade(ctx: ScalpelPluginContext): HostTrade {
  const trade = (ctx as HostCtx).trade
  if (!trade || typeof trade.priceCheck !== 'function') {
    throw new Error('This Scalpel build has no plugin trade API. Update the host.')
  }
  return trade
}

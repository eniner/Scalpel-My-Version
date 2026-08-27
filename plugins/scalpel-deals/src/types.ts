import type { WeightedMod } from './valuation'

export type WatchMatchBy = 'base' | 'uniqueName'

export type Watch = {
  id: string
  enabled: boolean
  name: string
  baseType: string
  itemClass: string
  /** Unique name as printed on the item (e.g. Headhunter), not the base. */
  itemName: string
  rarity: 'Rare' | 'Unique' | 'Magic' | 'Any'
  /** How the trade query is built. uniqueName uses the printed unique name. */
  matchBy: WatchMatchBy
  mods: WeightedMod[]
  minPriceDivine: number | null
  maxPriceDivine: number | null
  flagMultiplier: number
  percentile: number
  madK: number
  minSamples: number
  listedTime: string
  notifyCooldownMs: number
}

export type MonitorSettings = {
  monitoring: boolean
  minIntervalMs: number
  desktopNotifications: boolean
  lastError?: string | null
  lastTickAt?: number | null
  backoffUntil?: number | null
}

export type Alert = {
  id: string
  watchId: string
  watchName: string
  listingId: string
  itemName: string
  baseType: string
  priceLabel: string
  priceDivine: number
  vsMedian: number
  reasons: string[]
  scoreLabel: string
  account: string
  online: boolean
  tradeUrl: string
  whisper?: string
  icon?: string
  characterName?: string
  at: number
}

export type WatchListings = {
  watchId: string
  url: string
  queryId: string
  league: string
  total: number
  fetchedAt: number
  listings: Array<{
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
  }>
}

export type WatchHistory = {
  prices: number[]
  seenIds: string[]
  lastNotifyAt: number
  lastScanAt: number
  lastError?: string
}

export type MonitorSnapshot = {
  settings: MonitorSettings
  watches: Watch[]
  alerts: Alert[]
  history: Record<string, WatchHistory>
  listings: Record<string, WatchListings>
  lastTickAt: number | null
  lastError: string | null
  backoffUntil: number | null
  loggedIn: boolean | null
}

export const STORAGE_KEYS = {
  settings: 'settings',
  watches: 'watches',
  alerts: 'alerts',
  history: 'history',
  listings: 'listings',
} as const

export function newWatchId(): string {
  return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function defaultWatch(partial?: Partial<Watch>): Watch {
  return {
    id: newWatchId(),
    enabled: true,
    name: 'New watch',
    baseType: '',
    itemClass: '',
    itemName: '',
    rarity: 'Rare',
    matchBy: 'base',
    mods: [],
    minPriceDivine: null,
    maxPriceDivine: null,
    flagMultiplier: 0.6,
    percentile: 0.15,
    madK: 2.5,
    minSamples: 8,
    listedTime: '',
    notifyCooldownMs: 120_000,
    ...partial,
  }
}

export function defaultSettings(): MonitorSettings {
  return {
    monitoring: false,
    minIntervalMs: 60_000,
    desktopNotifications: true,
  }
}

export function defaultSnapshot(): MonitorSnapshot {
  return {
    settings: defaultSettings(),
    watches: [],
    alerts: [],
    history: {},
    listings: {},
    lastTickAt: null,
    lastError: null,
    backoffUntil: null,
    loggedIn: null,
  }
}

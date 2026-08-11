import type { PoeItem, Zone } from '@shared/types'

export type PluginContextFactoryDeps = {
  pluginId: string
  pluginVersion: string
  getPoeVersion: () => 1 | 2
  getLeague: () => string
  getLeagues: (version: 1 | 2) => Promise<readonly string[]>
  getCurrentItem: () => PoeItem | null
  getCurrentZone: () => Zone | null
  subscribeCurrentItem: (h: (i: PoeItem) => void) => () => void
  subscribeCurrentZone: (h: (z: Zone) => void) => () => void
  subscribeLeagueChange: (h: (l: string) => void) => () => void
  onLogLine: (handler: (line: string) => void) => () => void
  getRecentLogLines: (count?: number) => Promise<string[]>
  openExternal: (url: string) => void
  storage: {
    get: (key: string) => Promise<unknown>
    set: (key: string, value: unknown) => Promise<void>
    delete: (key: string) => Promise<void>
    keys: () => Promise<string[]>
  }
  gameConfig: {
    read: () => Promise<{ content: string; path: string }>
    write: (content: string) => Promise<{ backupPath: string | null }>
    onChange: (handler: () => void) => () => void
  }
  buildPlanner: {
    getPath: () => Promise<{ path: string }>
    list: () => Promise<{ path: string; files: { filename: string; name: string }[] }>
    read: (filename: string) => Promise<{ path: string; content: string }>
    openFolder: () => Promise<{ path: string }>
  }
  trade: {
    openSearch: (item: {
      name: string
      baseType: string
      itemClass?: string
      rarity: string
      notes?: string
      statPriority?: string[]
      similarItems?: boolean
      upgradeSearch?: boolean
      statKinds?: string[]
    }) => Promise<{
      url: string
      queryId: string
      total: number
      matchedStats?: number
      unmatchedMods?: string[]
    }>
    priceCheck: (item: {
      name: string
      baseType: string
      itemClass?: string
      rarity: string
      notes?: string
      statPriority?: string[]
      similarItems?: boolean
      upgradeSearch?: boolean
      statKinds?: string[]
    }) => Promise<{
      url: string
      queryId: string
      total: number
      matchedStats?: number
      unmatchedMods?: string[]
      pricesDivine: number[]
      cheapestDivine: number | null
      estimateDivine: number | null
      pricedCount: number
    }>
    scanWarrants: (opts?: import('../../../plugin-sdk/src/types').WarrantScanOptions) => Promise<
      import('../../../plugin-sdk/src/types').WarrantScanResult
    >
    warrantsCatalog: () => Promise<import('../../../plugin-sdk/src/types').WarrantCatalog>
    whisperSeller: (queryId: string, listingId: string, league: string) => Promise<void>
    visitHideout: (queryId: string, listingId: string, league: string) => Promise<void>
    getAuth: () => Promise<{ loggedIn: boolean }>
    login: () => Promise<void>
  }
  webPanel: {
    open: (opts: { url: string; title?: string; width?: number; height?: number }) => Promise<void>
    navigate: (url: string) => Promise<void>
    close: () => Promise<void>
  }
  readClipboardText: () => Promise<string>
  craft: {
    listActions: (item: import('@shared/types').PoeItem) => Promise<
      Array<{ id: string; label: string; description: string; applies: boolean; reason?: string }>
    >
    simulate: (
      item: import('@shared/types').PoeItem,
      actionId: string,
    ) => Promise<{
      actionId: string
      label: string
      samples: number
      modCountChances?: Array<{ count: number; probability: number }>
      outcomes: Array<{ text: string; group: string; kind: 'p' | 's'; probability: number; weight?: number; ilvl?: number }>
      note?: string
    }>
    modPool: (opts: {
      baseType: string
      itemLevel: number
      kind?: 'all' | 'p' | 's'
      item?: import('@shared/types').PoeItem | null
      context?: 'fresh' | 'item'
      poolSource?: 'craft' | 'marksman' | 'desecrated' | 'all'
      marksmanEnabled?: boolean
      tierFloor?: number
      catalyst?: string
      quality?: number
    }) => Promise<{
      baseType: string
      itemLevel: number
      kind: 'all' | 'p' | 's'
      context: 'fresh' | 'item'
      modCount: number
      totalWeight: number
      outcomes: Array<{ text: string; group: string; kind: 'p' | 's'; probability: number; weight?: number; ilvl?: number }>
      note: string
      catalysts?: Array<{ id: string; name: string; tags: string[] }>
      essencesForBase?: Array<{
        id: string
        name: string
        kind: 'p' | 's'
        text: string
        modName: string
        minIlvl: number
        group: string
      }>
    }>
    searchBases: (query: string, limit?: number) => Promise<string[]>
  }
  prices: {
    getPrices: (opts?: {
      category?: string
    }) => Promise<{ prices: import('@shared/types').PriceEntry[]; updatedAt: number | null }>
    refresh: () => Promise<void>
    onChange: (handler: () => void) => () => void
  }
  /** Optional until hosts ship the ninja character API. */
  ninja?: {
    getCharacterModel: (opts: {
      account: string
      league: string
      name: string
      modelVersion?: number
    }) => Promise<{ type: string; charModel: unknown; modelVersion: number }>
  }
  filter: import('../../../plugin-sdk/src/types').FilterApi
  registerTab: (
    pluginId: string,
    opts: {
      label: string
      icon: string
      render: (container: HTMLElement) => (() => void) | void
    },
  ) => void
  registerHotkey: (pluginId: string, opts: { label: string }, handler: () => void) => void
  openTab: (pluginId: string) => void
  copyAndEvaluateItem: () => Promise<import('@shared/types').PoeItem | null>
  captureGameWindow: (
    region?: import('../../../plugin-sdk/src/types').GameRect,
  ) => Promise<import('../../../plugin-sdk/src/types').GameCapture | null>
  registerOverlay: (pluginId: string, opts: import('../../../plugin-sdk/src/types').RegisterOverlayOptions) => void
  openOverlay: (pluginId: string) => void
  closeOverlay: (pluginId: string) => void
}

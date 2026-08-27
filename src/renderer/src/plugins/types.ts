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
      listedTime?: string
      priceMin?: number
      priceMax?: number
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
      listedTime?: string
      priceMin?: number
      priceMax?: number
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
    scanListings: (item: {
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
    }) => Promise<import('../../../plugin-sdk/src/types').PluginListingScanResult>
    scanWarrants: import('../../../plugin-sdk/src/types').TradeApi['scanWarrants']
    warrantsCatalog: import('../../../plugin-sdk/src/types').TradeApi['warrantsCatalog']
    whisperSeller: import('../../../plugin-sdk/src/types').TradeApi['whisperSeller']
    visitHideout: import('../../../plugin-sdk/src/types').TradeApi['visitHideout']
    getAuth: import('../../../plugin-sdk/src/types').TradeApi['getAuth']
    login: import('../../../plugin-sdk/src/types').TradeApi['login']
  }
  ninja?: import('../../../plugin-sdk/src/types').NinjaApi
  filter: import('../../../plugin-sdk/src/types').FilterApi
  webPanel: {
    open: (opts: { url: string; title?: string; width?: number; height?: number }) => Promise<void>
    navigate: (url: string) => Promise<void>
    close: () => Promise<void>
  }
  readClipboardText: () => Promise<string>
  craft: import('../../../plugin-sdk/src/types').CraftApi
  prices: {
    getPrices: (opts?: {
      category?: string
    }) => Promise<{ prices: import('@shared/types').PriceEntry[]; updatedAt: number | null }>
    refresh: () => Promise<void>
    onChange: (handler: () => void) => () => void
  }
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
  copyAndEvaluateItem: (opts?: {
    showOverlay?: boolean
    dispatch?: boolean
  }) => Promise<import('@shared/types').PoeItem | null>
  captureGameWindow: (
    region?: import('../../../plugin-sdk/src/types').GameRect,
  ) => Promise<import('../../../plugin-sdk/src/types').GameCapture | null>
  getCursorPosition: () => Promise<{ x: number; y: number } | null>
  media: {
    getSession: () => Promise<import('../../../plugin-sdk/src/types').MediaSession | null>
    onChange: (handler: (session: import('../../../plugin-sdk/src/types').MediaSession | null) => void) => () => void
    playPause: () => void
    next: () => void
    previous: () => void
  }
  registerOverlay: (pluginId: string, opts: import('../../../plugin-sdk/src/types').RegisterOverlayOptions) => void
  openOverlay: (pluginId: string) => void
  closeOverlay: (pluginId: string) => void
}

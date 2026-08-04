import { ipcMain } from 'electron'
import type Store from 'electron-store'
import { getTradeUrls } from '@shared/endpoints'
import type { AppSettings } from '@shared/types'
import { getPoeVersion } from '../game-state'
import { getProfileBackedSetting } from '../profiles/profile-settings'
import {
  buildBaseTypeStatFilter,
  buildGuideStatFilters,
  limitGuideStatFilters,
  normalizeGuideBaseType,
  parseGuideStatLines,
  resolveGuideItemClass,
} from '../trade/build-guide-search'
import type { StatFilter } from '../trade/trade'
import { searchTrade, type SearchTradeOptions, type TradeResult } from '../trade/trade'

export interface PluginTradeSearchItem {
  name: string
  baseType: string
  itemClass?: string
  rarity: string
  /** Raw guide notes containing numbered stat priority lines. */
  notes?: string
  /** Pre-parsed stat lines (overrides notes when provided). */
  statPriority?: string[]
  /** When true, search by slot + stats instead of the guide's exact base type. */
  similarItems?: boolean
}

interface GuideTradeSearchParams {
  league: string
  name: string
  baseType: string
  slotItemClass: string
  rarity: string
  modLines: string[]
  similarItems: boolean
  store: Store<AppSettings>
}

function buildSearchOptions(store: Store<AppSettings>, statMatchMode: 'and' | 'any'): SearchTradeOptions {
  return {
    tradeStatus: store.get('tradeStatus') ?? 'available',
    tradePriceOption: getProfileBackedSetting(store, 'tradePriceOption') ?? 'chaos_divine',
    collapseListings: store.get('tradeCollapseListings') ?? true,
    loggedIn: true,
    statMatchMode,
  }
}

async function runGuideTradeSearch(params: GuideTradeSearchParams): Promise<TradeResult> {
  const { league, name, baseType, slotItemClass, rarity, modLines, similarItems, store } = params
  const itemClass = resolveGuideItemClass(baseType, slotItemClass)
  const statFilters = buildGuideStatFilters(modLines, itemClass || undefined)

  let searchItem: {
    name: string
    baseType: string
    itemClass: string
    rarity: string
  }
  let filters = [...statFilters]

  if (rarity === 'Unique') {
    searchItem = {
      name,
      baseType,
      itemClass: slotItemClass,
      rarity,
    }
  } else if (similarItems) {
    if (!itemClass && statFilters.length === 0) {
      throw new Error('Similar search needs a slot type or stat priority from the guide.')
    }
    searchItem = {
      name: '',
      baseType: '',
      itemClass,
      rarity,
    }
    filters = limitGuideStatFilters(filters, 5)
  } else {
    searchItem = {
      name: '',
      baseType,
      itemClass: baseType ? '' : itemClass,
      rarity,
    }
    if (baseType) {
      filters.unshift(buildBaseTypeStatFilter(baseType, true))
    }
  }

  const statMatchMode: 'and' | 'any' = similarItems ? 'any' : 'and'
  const searchOptions = buildSearchOptions(store, statMatchMode)

  let result = await searchTrade(league, searchItem, filters, searchOptions)

  const needsRetry = (r: TradeResult): boolean => !r.queryId || (r.total ?? 0) === 0

  if (needsRetry(result) && filters.length > 0) {
    const explicit = filters.filter((f) => f.type === 'explicit')
    const baseOnly = filters.filter((f) => f.id === 'misc.basetype')
    const relaxed: StatFilter[] = similarItems
      ? explicit.length > 1
        ? limitGuideStatFilters(explicit, 1)
        : explicit
      : [...baseOnly, ...(explicit.length > 0 ? [explicit[0]!] : [])]
    if (relaxed.length > 0) {
      result = await searchTrade(league, searchItem, relaxed, searchOptions)
    }
  }

  if (needsRetry(result) && similarItems && itemClass) {
    result = await searchTrade(league, searchItem, [], buildSearchOptions(store, 'and'))
  }

  return result
}

export function registerPluginTradeHandlers(store: Store<AppSettings>): void {
  ipcMain.handle('plugins:trade-open-search', async (_evt, item: PluginTradeSearchItem) => {
    if (!item || typeof item !== 'object') {
      throw new Error('trade-open-search expects an item object')
    }
    const league = getProfileBackedSetting(store, 'league')
    const version = getPoeVersion()
    const slotItemClass = typeof item.itemClass === 'string' ? item.itemClass : ''
    const baseType = normalizeGuideBaseType(typeof item.baseType === 'string' ? item.baseType : '')
    const similarItems = item.similarItems === true

    const modLines =
      Array.isArray(item.statPriority) && item.statPriority.length > 0
        ? item.statPriority
        : parseGuideStatLines(typeof item.notes === 'string' ? item.notes : undefined)

    const result = await runGuideTradeSearch({
      league,
      name: typeof item.name === 'string' ? item.name : '',
      baseType,
      slotItemClass,
      rarity: typeof item.rarity === 'string' ? item.rarity : 'Rare',
      modLines,
      similarItems,
      store,
    })

    if (!result.queryId) {
      throw new Error('Trade search returned no results link.')
    }
    return {
      url: getTradeUrls(version).webSearch(league, result.queryId),
      queryId: result.queryId,
      total: result.total,
      matchedStats: modLines.length,
      similarItems,
    }
  })
}

export { runGuideTradeSearch }

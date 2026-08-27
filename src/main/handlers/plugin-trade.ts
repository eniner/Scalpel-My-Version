import { ipcMain } from 'electron'
import type Store from 'electron-store'
import { getTradeUrls } from '@shared/endpoints'
import type { AppSettings } from '@shared/types'
import { getPoeVersion } from '../game-state'
import { getProfileBackedSetting } from '../profiles/profile-settings'
import {
  buildBaseTypeStatFilter,
  buildGuideStatFiltersDetailed,
  limitGuideStatFilters,
  normalizeGuideBaseType,
  parseGuideStatLines,
  resolveGuideItemClass,
  type GuideModLine,
} from '../trade/build-guide-search'
import { ensureStatsLoaded } from '../trade/stat-matcher/stats-cache'
import type { StatFilter } from '../trade/trade'
import { listingAmountToDivine, summarizeDivineSamples } from '../trade/listing-divine'
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
  /** Parallel kinds for `statPriority` (explicit/crafted/rune/…). */
  statKinds?: string[]
  /** When true, search by slot + stats instead of the guide's exact base type. */
  similarItems?: boolean
  /**
   * Upgrade finder mode: AND matched stats, apply rolled mins, never fall back
   * to an empty (slot-only) search. Used by Skill DPS Find upgrades.
   */
  upgradeSearch?: boolean
  /** Trade-site indexed window, e.g. `'1hour'`. Used by listing scan. */
  listedTime?: string
  /** Inclusive divine buyout floor sent as `trade_filters.price.min`. */
  priceMin?: number
  /** Inclusive divine buyout ceiling sent as `trade_filters.price.max`. */
  priceMax?: number
}

interface GuideTradeSearchParams {
  league: string
  name: string
  baseType: string
  slotItemClass: string
  rarity: string
  modLines: GuideModLine[]
  similarItems: boolean
  upgradeSearch: boolean
  listedTime?: string
  priceMin?: number
  priceMax?: number
  store: Store<AppSettings>
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function buildSearchOptions(
  store: Store<AppSettings>,
  statMatchMode: 'and' | 'any',
  extra?: { listedTime?: string; priceMin?: number; priceMax?: number },
): SearchTradeOptions {
  const hasBand = extra?.priceMin != null || extra?.priceMax != null
  return {
    tradeStatus: store.get('tradeStatus') ?? 'available',
    tradePriceOption: getProfileBackedSetting(store, 'tradePriceOption') ?? 'chaos_divine',
    collapseListings: store.get('tradeCollapseListings') ?? true,
    loggedIn: true,
    statMatchMode,
    ...(extra?.listedTime ? { listedTime: extra.listedTime } : {}),
    ...(hasBand ? { priceMin: extra?.priceMin, priceMax: extra?.priceMax, priceCurrency: 'divine' } : {}),
  }
}

function readPluginItem(item: PluginTradeSearchItem): {
  name: string
  baseType: string
  slotItemClass: string
  rarity: string
  similarItems: boolean
  upgradeSearch: boolean
  listedTime?: string
  priceMin?: number
  priceMax?: number
  modLines: GuideModLine[]
} {
  const kinds = Array.isArray(item.statKinds) ? item.statKinds : []
  let modLines: GuideModLine[]
  if (Array.isArray(item.statPriority) && item.statPriority.length > 0) {
    modLines = item.statPriority.map((text, i) => ({
      text: String(text),
      kind: typeof kinds[i] === 'string' ? kinds[i] : undefined,
    }))
  } else {
    modLines = parseGuideStatLines(typeof item.notes === 'string' ? item.notes : undefined).map((text) => ({
      text,
    }))
  }
  const listedTime = typeof item.listedTime === 'string' && item.listedTime.trim() ? item.listedTime.trim() : undefined
  return {
    name: typeof item.name === 'string' ? item.name : '',
    baseType: normalizeGuideBaseType(typeof item.baseType === 'string' ? item.baseType : ''),
    slotItemClass: typeof item.itemClass === 'string' ? item.itemClass : '',
    rarity: typeof item.rarity === 'string' ? item.rarity : 'Rare',
    similarItems: item.similarItems === true,
    upgradeSearch: item.upgradeSearch === true,
    listedTime,
    priceMin: finiteNumber(item.priceMin),
    priceMax: finiteNumber(item.priceMax),
    modLines,
  }
}

function clipMods(mods: string[] | undefined, cap = 16): string[] {
  if (!mods || mods.length === 0) return []
  return mods.slice(0, cap).map((m) => String(m))
}

function isTradeStatFilter(f: StatFilter): boolean {
  return f.id !== 'misc.basetype' && f.type !== 'misc'
}

async function runGuideTradeSearch(params: GuideTradeSearchParams): Promise<{
  result: TradeResult
  matched: string[]
  unmatched: string[]
}> {
  const {
    league,
    name,
    baseType,
    slotItemClass,
    rarity,
    modLines,
    similarItems,
    upgradeSearch,
    listedTime,
    priceMin,
    priceMax,
    store,
  } = params
  // Match mods against the trade stats catalog — must load before filtering.
  await ensureStatsLoaded()
  const itemClass = resolveGuideItemClass(baseType, slotItemClass)
  const detailed = buildGuideStatFiltersDetailed(modLines, itemClass || undefined, {
    useStatMinimums: upgradeSearch,
  })
  let filters = [...detailed.filters]

  let searchItem: {
    name: string
    baseType: string
    itemClass: string
    rarity: string
  }

  if (rarity === 'Unique') {
    searchItem = {
      name,
      baseType,
      itemClass: slotItemClass,
      rarity,
    }
  } else if (similarItems) {
    if (!itemClass && detailed.filters.length === 0) {
      throw new Error('Similar search needs a slot type or at least one matched mod.')
    }
    searchItem = {
      name: '',
      baseType: '',
      itemClass,
      rarity: upgradeSearch ? 'Rare' : rarity,
    }
    filters = limitGuideStatFilters(filters, upgradeSearch ? 8 : 5)
  } else {
    searchItem = {
      name: '',
      baseType,
      itemClass: baseType ? '' : itemClass,
      rarity: upgradeSearch ? 'Rare' : rarity,
    }
    if (baseType) {
      filters.unshift(buildBaseTypeStatFilter(baseType, true))
    }
    if (upgradeSearch) {
      filters = limitGuideStatFilters(filters, 8)
    }
  }

  const statMatchMode: 'and' | 'any' = upgradeSearch ? 'and' : similarItems ? 'any' : 'and'
  const searchOptions = buildSearchOptions(store, statMatchMode, { listedTime, priceMin, priceMax })
  const tradeStatCount = filters.filter((f) => isTradeStatFilter(f)).length

  if (upgradeSearch && tradeStatCount === 0) {
    const skipped = detailed.unmatched.length
      ? ` Unmatched: ${detailed.unmatched.slice(0, 3).join(' · ')}${detailed.unmatched.length > 3 ? '…' : ''}`
      : ''
    throw new Error(
      `None of the checked mods could be matched to trade filters.${skipped} Uncheck Bonded/unsearchable lines and keep real item mods.`,
    )
  }

  let result = await searchTrade(league, searchItem, filters, searchOptions)

  const needsRetry = (r: TradeResult): boolean => !r.queryId || (r.total ?? 0) === 0

  if (needsRetry(result) && filters.length > 0) {
    const stats = filters.filter((f) => isTradeStatFilter(f))
    const baseOnly = filters.filter((f) => !isTradeStatFilter(f))
    if (upgradeSearch) {
      for (const keep of [Math.min(4, stats.length), 3, 2, 1]) {
        if (keep <= 0 || keep >= stats.length) continue
        const relaxed: StatFilter[] = [...baseOnly, ...stats.slice(0, keep)]
        result = await searchTrade(league, searchItem, relaxed, searchOptions)
        if (!needsRetry(result)) break
      }
    } else {
      const relaxed: StatFilter[] = similarItems
        ? stats.length > 1
          ? limitGuideStatFilters(stats, 1)
          : stats
        : [...baseOnly, ...(stats.length > 0 ? [stats[0]!] : [])]
      if (relaxed.length > 0) {
        result = await searchTrade(league, searchItem, relaxed, searchOptions)
      }
    }
  }

  if (needsRetry(result) && similarItems && itemClass && !upgradeSearch) {
    result = await searchTrade(
      league,
      searchItem,
      [],
      buildSearchOptions(store, 'and', { listedTime, priceMin, priceMax }),
    )
  }

  return { result, matched: detailed.matched, unmatched: detailed.unmatched }
}

export function registerPluginTradeHandlers(store: Store<AppSettings>): void {
  ipcMain.handle('plugins:trade-open-search', async (_evt, item: PluginTradeSearchItem) => {
    if (!item || typeof item !== 'object') {
      throw new Error('trade-open-search expects an item object')
    }
    const league = getProfileBackedSetting(store, 'league')
    const version = getPoeVersion()
    const parsed = readPluginItem(item)

    const { result, matched, unmatched } = await runGuideTradeSearch({
      league,
      ...parsed,
      store,
    })

    if (!result.queryId) {
      throw new Error('Trade search returned no results link.')
    }
    return {
      url: getTradeUrls(version).webSearch(league, result.queryId),
      queryId: result.queryId,
      total: result.total,
      matchedStats: matched.length,
      unmatchedMods: unmatched,
      similarItems: parsed.similarItems,
      upgradeSearch: parsed.upgradeSearch,
    }
  })

  /**
   * Same query builder as open-search, but returns a divine estimate from
   * live listing buyouts instead of opening the trade browser. Used by Skill
   * DPS build-value for rares + variant uniques (e.g. Rite of Passage Owl).
   */
  ipcMain.handle('plugins:trade-price-check', async (_evt, item: PluginTradeSearchItem) => {
    if (!item || typeof item !== 'object') {
      throw new Error('trade-price-check expects an item object')
    }
    const league = getProfileBackedSetting(store, 'league')
    const version = getPoeVersion()
    const parsed = readPluginItem(item)

    const { result, matched, unmatched } = await runGuideTradeSearch({
      league,
      ...parsed,
      store,
    })

    const samples: number[] = []
    for (const listing of result.listings) {
      if (!listing.price) continue
      const d = listingAmountToDivine(listing.price.amount, listing.price.currency)
      if (d != null) samples.push(d)
    }
    const summary = summarizeDivineSamples(samples)

    return {
      url: result.queryId ? getTradeUrls(version).webSearch(league, result.queryId) : '',
      queryId: result.queryId,
      total: result.total,
      matchedStats: matched.length,
      unmatchedMods: unmatched,
      ...summary,
    }
  })

  /**
   * Listing rows for monitor plugins. Same query as price-check; does not
   * whisper, travel, or open a browser. Host owns rate limits.
   */
  ipcMain.handle('plugins:trade-scan-listings', async (_evt, item: PluginTradeSearchItem) => {
    if (!item || typeof item !== 'object') {
      throw new Error('trade-scan-listings expects an item object')
    }
    const league = getProfileBackedSetting(store, 'league')
    const version = getPoeVersion()
    const parsed = readPluginItem(item)

    const { result, matched, unmatched } = await runGuideTradeSearch({
      league,
      ...parsed,
      store,
    })

    const samples: number[] = []
    const listings = result.listings.map((listing) => {
      const amount = listing.price?.amount ?? null
      const currency = listing.price?.currency ?? null
      const priceDivine = amount != null && currency ? listingAmountToDivine(amount, currency) : null
      if (priceDivine != null) samples.push(priceDivine)
      return {
        id: listing.id,
        name: listing.itemData?.name || listing.itemData?.baseType || parsed.name || parsed.baseType,
        baseType: listing.itemData?.baseType || parsed.baseType,
        rarity: listing.itemData?.rarity,
        priceAmount: amount,
        priceCurrency: currency,
        priceDivine,
        account: listing.account,
        online: listing.online,
        instantBuyout: listing.instantBuyout,
        explicitMods: clipMods(listing.itemData?.explicitMods),
        implicitMods: clipMods(listing.itemData?.implicitMods),
        ilvl: listing.itemData?.ilvl,
        whisper: listing.whisper,
        indexed: listing.indexed,
        icon: listing.icon?.startsWith('//') ? `https:${listing.icon}` : listing.icon,
        characterName: listing.characterName,
      }
    })
    const summary = summarizeDivineSamples(samples)

    return {
      url: result.queryId ? getTradeUrls(version).webSearch(league, result.queryId) : '',
      queryId: result.queryId,
      league,
      total: result.total,
      matchedStats: matched.length,
      unmatchedMods: unmatched,
      listings,
      ...summary,
    }
  })
}

export { runGuideTradeSearch }

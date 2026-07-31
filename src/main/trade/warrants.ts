/**
 * Mercenary Warrant live trade scanner.
 *
 * Trade fetch payloads include `mercenarySkills` with support link order — we
 * fingerprint that, convert ask prices to chaos via poe.ninja rates, and group
 * identical skill packages so the Scalpel Warrants tab can rank by market value.
 */
import { getTradeUrls } from '@shared/endpoints'
import {
  fingerprintSkills,
  skillKey,
  type WarrantListing,
  type WarrantScanResult,
  type WarrantSkill,
  type WarrantSkillGroup,
  type WarrantSupport,
} from '@shared/warrants'
import { getPoeVersion } from '../game-state'
import { lookupPrice, refreshPrices } from './prices'
import { fetchJson } from './trade'

/** Trade site currency option → poe.ninja item name. */
const TRADE_CURRENCY_NAMES: Record<string, string> = {
  chaos: 'Chaos Orb',
  divine: 'Divine Orb',
  exalted: 'Exalted Orb',
  exa: 'Exalted Orb',
  mirror: 'Mirror of Kalandra',
  alch: 'Orb of Alchemy',
  alt: 'Orb of Alteration',
  chrom: 'Chromatic Orb',
  fuse: 'Orb of Fusing',
  fusing: 'Orb of Fusing',
  jew: "Jeweller's Orb",
  jewellers: "Jeweller's Orb",
  chance: 'Orb of Chance',
  scour: 'Orb of Scouring',
  blessed: 'Blessed Orb',
  regret: 'Orb of Regret',
  regal: 'Regal Orb',
  vaal: 'Vaal Orb',
  gcp: "Gemcutter's Prism",
  annul: 'Orb of Annulment',
  aug: 'Orb of Augmentation',
  transmute: 'Orb of Transmutation',
}

function propValue(
  properties: Array<{ name?: string; values?: Array<[string, number]> }> | undefined,
  name: string,
): string | null {
  const p = properties?.find((x) => x.name === name)
  return p?.values?.[0]?.[0] ?? null
}

function mercenaryName(
  properties: Array<{ name?: string; values?: Array<[string, number]> }> | undefined,
): string {
  const named = properties?.find((x) => !x.name && x.values?.[0]?.[0])
  return named?.values?.[0]?.[0] ?? 'Unknown Mercenary'
}

function parseSkills(raw: unknown): WarrantSkill[] {
  if (!Array.isArray(raw)) return []
  return raw.map((s) => {
    const skill = s as {
      hash?: number
      name?: string
      icon?: string
      supports?: Array<{ hash?: number; name?: string; tier?: number }>
    }
    const supports: WarrantSupport[] = (skill.supports ?? []).map((sup) => ({
      hash: Number(sup.hash ?? 0),
      name: String(sup.name ?? 'Unknown Support'),
      tier: typeof sup.tier === 'number' ? sup.tier : undefined,
    }))
    return {
      hash: Number(skill.hash ?? 0),
      name: String(skill.name ?? 'Unknown Skill'),
      icon: skill.icon,
      supports,
    }
  })
}

export function priceToChaos(amount: number, currency: string): number | null {
  const key = currency.toLowerCase()
  if (key === 'chaos') return amount
  const ninjaName = TRADE_CURRENCY_NAMES[key]
  if (!ninjaName) return null
  const info = lookupPrice(ninjaName, ninjaName)
  if (!info?.chaosValue || info.chaosValue <= 0) return null
  return amount * info.chaosValue
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function groupListings(listings: WarrantListing[]): WarrantSkillGroup[] {
  const map = new Map<string, WarrantListing[]>()
  for (const listing of listings) {
    const key = listing.fingerprint || listing.id
    const bucket = map.get(key)
    if (bucket) bucket.push(listing)
    else map.set(key, [listing])
  }

  const groups: WarrantSkillGroup[] = []
  for (const [fingerprint, rows] of map) {
    const priced = rows.map((r) => r.chaosValue).filter((v): v is number => v != null && Number.isFinite(v))
    const sample = [...rows].sort((a, b) => (b.chaosValue ?? -1) - (a.chaosValue ?? -1))[0]
    groups.push({
      fingerprint,
      skillKey: sample.skillKey,
      build: sample.build,
      count: rows.length,
      medianChaos: median(priced),
      minChaos: priced.length ? Math.min(...priced) : null,
      maxChaos: priced.length ? Math.max(...priced) : null,
      sample,
      listings: rows.sort((a, b) => (b.chaosValue ?? -1) - (a.chaosValue ?? -1)),
    })
  }

  return groups.sort((a, b) => (b.medianChaos ?? -1) - (a.medianChaos ?? -1))
}

type RawFetchResult = {
  id?: string
  listing?: {
    indexed?: string
    price?: { amount?: number; currency?: string }
    account?: { name?: string; online?: boolean | { status?: string } }
  }
  item?: {
    icon?: string
    properties?: Array<{ name?: string; values?: Array<[string, number]> }>
    mercenarySkills?: unknown
  }
}

async function fetchBatches(ids: string[], queryId: string): Promise<RawFetchResult[]> {
  const urls = getTradeUrls(1)
  const out: RawFetchResult[] = []
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10)
    if (i > 0) await new Promise((r) => setTimeout(r, 1100))
    const fetched = (await fetchJson(urls.fetch(batch.join(','), queryId))) as {
      result?: RawFetchResult[]
    }
    out.push(...(fetched.result ?? []))
  }
  return out
}

export type WarrantScanOptions = {
  /** Max listings to fetch (capped at 100; trade search returns up to 100 ids). */
  limit?: number
  /** Prefer online sellers when true. */
  onlineOnly?: boolean
  /** Require a listed price. */
  pricedOnly?: boolean
}

/**
 * Search Mercenary Warrants on the official trade site, fetch listing details
 * (including mercenarySkills), convert prices to chaos, and group by skill package.
 */
export async function scanMercenaryWarrants(
  league: string,
  options: WarrantScanOptions = {},
): Promise<WarrantScanResult> {
  if (getPoeVersion() !== 1) {
    throw new Error('Scalpel Warrants is PoE1-only')
  }

  const limit = Math.min(100, Math.max(10, options.limit ?? 50))
  const onlineOnly = options.onlineOnly ?? false
  const pricedOnly = options.pricedOnly ?? true

  // Currency → chaos conversion needs a fresh-ish ninja currency table.
  try {
    await refreshPrices(league)
  } catch {
    /* best-effort; unpriced conversion falls back to null chaos */
  }

  const urls = getTradeUrls(1)
  const tradeFilters: Record<string, unknown> = {}
  if (pricedOnly) tradeFilters.price = { min: 1 }

  const body = JSON.stringify({
    query: {
      status: { option: onlineOnly ? 'online' : 'any' },
      type: 'Mercenary Warrant',
      stats: [{ type: 'and', filters: [] }],
      filters: {
        trade_filters: { disabled: false, filters: tradeFilters },
      },
    },
    sort: { price: 'desc' },
  })

  const search = (await fetchJson(urls.search(league), { method: 'POST', body })) as {
    id?: string
    total?: number
    result?: string[]
  }

  const queryId = search.id ?? ''
  const total = search.total ?? 0
  const ids = (search.result ?? []).slice(0, limit)
  const raw = ids.length > 0 ? await fetchBatches(ids, queryId) : []

  const listings: WarrantListing[] = raw.map((r) => {
    const skills = parseSkills(r.item?.mercenarySkills)
    const amount = r.listing?.price?.amount
    const currency = r.listing?.price?.currency ?? null
    const chaosValue =
      typeof amount === 'number' && currency ? priceToChaos(amount, currency) : null
    const onlineRaw = r.listing?.account?.online
    const online = typeof onlineRaw === 'object' ? Boolean(onlineRaw) : Boolean(onlineRaw)
    const levelRaw = propValue(r.item?.properties, 'Mercenary Level')

    return {
      id: r.id ?? '',
      queryId,
      mercenaryName: mercenaryName(r.item?.properties),
      build: propValue(r.item?.properties, 'Build') ?? 'Unknown',
      level: levelRaw ? Number(levelRaw) || null : null,
      skills,
      fingerprint: fingerprintSkills(skills),
      skillKey: skillKey(skills),
      priceAmount: typeof amount === 'number' ? amount : null,
      priceCurrency: currency,
      chaosValue,
      account: r.listing?.account?.name ?? null,
      online,
      indexed: r.listing?.indexed ?? null,
      icon: r.item?.icon ?? null,
    }
  })

  return {
    total,
    fetched: listings.length,
    queryId,
    league,
    scannedAt: Date.now(),
    groups: groupListings(listings),
    listings,
    webSearchUrl: queryId ? urls.webSearch(league, queryId) : `${urls.webSearch(league, '')}`.replace(/\/$/, ''),
  }
}

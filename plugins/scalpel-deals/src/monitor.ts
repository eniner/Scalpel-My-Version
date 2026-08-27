import type { ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { hostTrade, listingPriceLabel, type ListingRow, type ScanResult } from './host-trade'
import { notifyDesktop } from './notify'
import { capHistory, loadSnapshot, saveAlerts, saveHistory, saveSettings, saveWatchListings } from './persist'
import type { Alert, Watch, WatchHistory, WatchListings } from './types'
import { computeStats, isUnderpriced, scoreMods } from './valuation'
import { watchToSearchItem } from './watch-query'

const LEASE_KEY = 'poll-lease'
const INSTANCE = `p_${Math.random().toString(36).slice(2, 10)}`
const LEASE_MS = 20_000
const MAX_BACKOFF_MS = 5 * 60_000
const FEED_CAP = 80

async function tryLease(ctx: ScalpelPluginContext): Promise<boolean> {
  const now = Date.now()
  const lease = await ctx.storage.get<{ owner: string; until: number }>(LEASE_KEY)
  if (lease && lease.until > now && lease.owner !== INSTANCE) return false
  await ctx.storage.set(LEASE_KEY, { owner: INSTANCE, until: now + LEASE_MS })
  return true
}

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /\b429\b|rate limit|too many requests|Retry-After/i.test(msg)
}

function packFromScan(ctx: ScalpelPluginContext, watch: Watch, scan: ScanResult): WatchListings {
  return {
    watchId: watch.id,
    url: scan.url,
    queryId: scan.queryId,
    league: scan.league || ctx.getLeague() || '',
    total: scan.total,
    fetchedAt: Date.now(),
    listings: scan.listings,
  }
}

async function scanWatch(ctx: ScalpelPluginContext, watch: Watch): Promise<ScanResult> {
  const item = watchToSearchItem(watch)
  const trade = hostTrade(ctx)
  if (typeof trade.scanListings === 'function') {
    return trade.scanListings(item)
  }
  const check = await trade.priceCheck(item)
  const listings: ListingRow[] = (check.pricesDivine ?? []).map((d: number, i: number) => ({
    id: `${check.queryId || 'q'}_${i}`,
    name: watch.itemName || watch.baseType || watch.name,
    baseType: watch.baseType,
    priceAmount: d,
    priceCurrency: 'divine',
    priceDivine: d,
    account: '',
    online: true,
    explicitMods: [],
    implicitMods: [],
  }))
  return {
    url: check.url,
    queryId: check.queryId,
    league: ctx.getLeague() || '',
    total: check.total,
    listings,
    pricesDivine: check.pricesDivine ?? [],
  }
}

/** Fetch the current trade rows for a watch and persist them for the Listings tab. */
export async function fetchWatchListings(ctx: ScalpelPluginContext, watch: Watch): Promise<WatchListings> {
  const scan = await scanWatch(ctx, watch)
  const pack = packFromScan(ctx, watch, scan)
  await saveWatchListings(ctx, pack)
  return pack
}

function inPriceBand(priceDivine: number, watch: Watch): boolean {
  if (watch.minPriceDivine != null && priceDivine < watch.minPriceDivine) return false
  if (watch.maxPriceDivine != null && priceDivine > watch.maxPriceDivine) return false
  return true
}

export function attachMonitor(ctx: ScalpelPluginContext, onChange: () => void): () => void {
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let backoffMs = 0
  let running = false

  const schedule = (ms: number): void => {
    if (stopped) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      void tick()
    }, ms)
  }

  const tick = async (): Promise<void> => {
    if (stopped || running) return
    running = true
    try {
      const snap = await loadSnapshot(ctx)
      if (!snap.settings.monitoring) {
        schedule(4000)
        return
      }
      if (!(await tryLease(ctx))) {
        schedule(5000)
        onChange()
        return
      }

      let auth: { loggedIn: boolean } = { loggedIn: false }
      try {
        auth = await hostTrade(ctx).getAuth()
      } catch {
        auth = { loggedIn: false }
      }
      if (!auth.loggedIn) {
        snap.lastError = 'Not logged into pathofexile.com. Use Login — Scalpel already owns the session.'
        snap.settings.lastError = snap.lastError
        await saveSettings(ctx, snap.settings)
        onChange()
        schedule(Math.max(snap.settings.minIntervalMs, 15_000))
        return
      }

      const now = Date.now()
      if (snap.backoffUntil && now < snap.backoffUntil) {
        schedule(snap.backoffUntil - now + 250)
        return
      }

      const enabled = snap.watches.filter((w) => w.enabled && (w.baseType || w.itemClass || w.itemName))
      if (enabled.length === 0) {
        schedule(snap.settings.minIntervalMs)
        return
      }

      let hitLimit = false
      for (const watch of enabled) {
        if (stopped) break
        try {
          const scan = await scanWatch(ctx, watch)
          const hist: WatchHistory = capHistory(
            snap.history[watch.id] ?? { prices: [], seenIds: [], lastNotifyAt: 0, lastScanAt: 0 },
          )
          const freshPrices = scan.pricesDivine.filter((n) => Number.isFinite(n) && n > 0)
          hist.prices = [...hist.prices, ...freshPrices]
          hist.lastScanAt = Date.now()
          hist.lastError = undefined

          const stats = computeStats(hist.prices, watch.percentile)
          const seen = new Set(hist.seenIds)

          for (const row of scan.listings) {
            if (!row.id || seen.has(row.id)) continue
            hist.seenIds.push(row.id)
            const price = row.priceDivine
            if (price == null || !inPriceBand(price, watch)) continue

            const mods = [...row.explicitMods, ...row.implicitMods]
            const scored = scoreMods(mods, watch.mods)
            if (scored.missingRequired) continue

            if (!stats) continue
            const flag = isUnderpriced(price, stats, {
              percentile: watch.percentile,
              madK: watch.madK,
              multiplier: watch.flagMultiplier,
              minSamples: watch.minSamples,
            })
            if (!flag.flagged) continue

            const cooldownOk = Date.now() - hist.lastNotifyAt >= watch.notifyCooldownMs
            if (!cooldownOk) continue
            hist.lastNotifyAt = Date.now()

            const alert: Alert = {
              id: `a_${Date.now().toString(36)}_${row.id.slice(0, 8)}`,
              watchId: watch.id,
              watchName: watch.name,
              listingId: row.id,
              itemName: row.name || watch.name,
              baseType: row.baseType || watch.baseType,
              priceLabel: listingPriceLabel(row),
              priceDivine: price,
              vsMedian: flag.vsMedian,
              reasons: flag.reasons,
              scoreLabel:
                scored.maxScore > 0 ? `${scored.score.toFixed(1)} / ${scored.maxScore.toFixed(1)}` : 'n/a',
              account: row.account,
              online: row.online,
              tradeUrl: scan.url,
              whisper: row.whisper,
              icon: row.icon,
              characterName: row.characterName,
              at: Date.now(),
            }
            snap.alerts = [alert, ...snap.alerts].slice(0, FEED_CAP)
            if (snap.settings.desktopNotifications) {
              const pct = Number.isFinite(flag.vsMedian) ? `${Math.round(flag.vsMedian * 100)}% of median` : ''
              notifyDesktop(
                `Underpriced: ${alert.itemName}`,
                `${alert.priceLabel} · ${pct} · open the trade site yourself`,
              )
            }
          }

          snap.history[watch.id] = capHistory(hist)
          await saveWatchListings(ctx, packFromScan(ctx, watch, scan))
          backoffMs = 0
        } catch (err) {
          const hist = snap.history[watch.id] ?? { prices: [], seenIds: [], lastNotifyAt: 0, lastScanAt: 0 }
          hist.lastError = err instanceof Error ? err.message : String(err)
          snap.history[watch.id] = hist
          snap.lastError = hist.lastError
          if (isRateLimitError(err)) {
            hitLimit = true
            backoffMs = Math.min(MAX_BACKOFF_MS, Math.max(snap.settings.minIntervalMs * 2, backoffMs * 2 || 30_000))
            break
          }
        }
      }

      snap.lastTickAt = Date.now()
      snap.settings.lastTickAt = snap.lastTickAt
      if (hitLimit) snap.backoffUntil = Date.now() + backoffMs
      else snap.backoffUntil = null
      snap.settings.backoffUntil = snap.backoffUntil
      if (!hitLimit) {
        snap.lastError = snap.lastError
        snap.settings.lastError = snap.lastError
      } else {
        snap.settings.lastError = snap.lastError
      }

      await saveHistory(ctx, snap.history)
      await saveAlerts(ctx, snap.alerts)
      await saveSettings(ctx, snap.settings)
      onChange()
      const wait = hitLimit ? backoffMs : snap.settings.minIntervalMs
      schedule(Math.max(15_000, wait))
    } catch (err) {
      ctx.log('deals tick failed', err)
      schedule(30_000)
    } finally {
      running = false
    }
  }

  schedule(1500)
  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
  }
}

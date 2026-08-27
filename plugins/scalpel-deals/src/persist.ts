import type { ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import {
  STORAGE_KEYS,
  defaultSnapshot,
  type Alert,
  type MonitorSettings,
  type MonitorSnapshot,
  type Watch,
  type WatchHistory,
  type WatchListings,
} from './types'

const ALERT_CAP = 80
const PRICE_CAP = 200
const SEEN_CAP = 400

export async function loadSnapshot(ctx: ScalpelPluginContext): Promise<MonitorSnapshot> {
  const [settings, watches, alerts, history, listings] = await Promise.all([
    ctx.storage.get<MonitorSettings>(STORAGE_KEYS.settings),
    ctx.storage.get<Watch[]>(STORAGE_KEYS.watches),
    ctx.storage.get<Alert[]>(STORAGE_KEYS.alerts),
    ctx.storage.get<Record<string, WatchHistory>>(STORAGE_KEYS.history),
    ctx.storage.get<Record<string, WatchListings>>(STORAGE_KEYS.listings),
  ])
  const snap = defaultSnapshot()
  if (settings && typeof settings === 'object') snap.settings = { ...snap.settings, ...settings }
  if (Array.isArray(watches)) {
    snap.watches = watches.map((w) => {
      const matchBy = w.matchBy ?? (w.rarity === 'Unique' || Boolean(w.itemName?.trim()) ? 'uniqueName' : 'base')
      return { ...w, matchBy, itemName: w.itemName ?? '' }
    })
  }
  if (Array.isArray(alerts)) snap.alerts = alerts
  if (history && typeof history === 'object') snap.history = history
  if (listings && typeof listings === 'object') snap.listings = listings
  snap.lastError = snap.settings.lastError ?? null
  snap.lastTickAt = snap.settings.lastTickAt ?? null
  snap.backoffUntil = snap.settings.backoffUntil ?? null
  return snap
}

export async function saveSettings(ctx: ScalpelPluginContext, settings: MonitorSettings): Promise<void> {
  await ctx.storage.set(STORAGE_KEYS.settings, settings)
}

export async function saveWatches(ctx: ScalpelPluginContext, watches: Watch[]): Promise<void> {
  await ctx.storage.set(STORAGE_KEYS.watches, watches)
}

export async function saveAlerts(ctx: ScalpelPluginContext, alerts: Alert[]): Promise<void> {
  await ctx.storage.set(STORAGE_KEYS.alerts, alerts.slice(0, ALERT_CAP))
}

export async function saveHistory(
  ctx: ScalpelPluginContext,
  history: Record<string, WatchHistory>,
): Promise<void> {
  await ctx.storage.set(STORAGE_KEYS.history, history)
}

export async function saveWatchListings(ctx: ScalpelPluginContext, pack: WatchListings): Promise<void> {
  const all = (await ctx.storage.get<Record<string, WatchListings>>(STORAGE_KEYS.listings)) ?? {}
  all[pack.watchId] = {
    ...pack,
    listings: pack.listings.slice(0, 10),
  }
  await ctx.storage.set(STORAGE_KEYS.listings, all)
}

export function capHistory(h: WatchHistory): WatchHistory {
  return {
    ...h,
    prices: h.prices.slice(-PRICE_CAP),
    seenIds: h.seenIds.slice(-SEEN_CAP),
  }
}

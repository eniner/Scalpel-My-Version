import { useCallback, useEffect, useMemo, useState } from 'react'
import { defaultPoeItem, getItemIcon, type ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { attachMonitor, fetchWatchListings } from './monitor'
import { copyText } from './notify'
import { loadSnapshot, saveAlerts, saveSettings, saveWatches } from './persist'
import { DEALS_CSS } from './styles'
import {
  defaultSettings,
  defaultWatch,
  type Alert,
  type MonitorSettings,
  type MonitorSnapshot,
  type Watch,
  type WatchListings,
} from './types'
import { watchFromParsedItem, watchToSearchItem, parsePoeItemClipboard, isUniqueMatch } from './watch-query'
import { hostTrade, listingPriceLabel } from './host-trade'

type Tab = 'feed' | 'listings' | 'watches' | 'exchange' | 'about'
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'feed', label: 'Alerts' },
  { id: 'listings', label: 'Listings' },
  { id: 'watches', label: 'Watches' },
  { id: 'exchange', label: 'Exchange' },
  { id: 'about', label: 'About' },
]

function fmtAgo(ts: number | null): string {
  if (!ts) return 'never'
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  return `${Math.round(s / 3600)}h ago`
}

function resolveIcon(row: { icon?: string; name: string; baseType: string }): string | null {
  if (row.icon) return row.icon
  return getItemIcon(defaultPoeItem({ name: row.name, baseType: row.baseType }, 2))
}

function sellerLine(row: { account?: string; characterName?: string; online?: boolean }): string {
  const who = [row.account, row.characterName].filter(Boolean).join(' · ')
  if (!who) return row.online ? 'online' : 'unknown seller'
  return `${who}${row.online ? ' · online' : ' · offline'}`
}

function watchFromHover(ctx: ScalpelPluginContext, captured?: { name?: string; baseType?: string; itemClass?: string; rarity?: string; explicits?: string[]; identified?: boolean } | null): Watch | null {
  const item = captured ?? ctx.getCurrentItem()
  if (!item?.baseType && !item?.name) return null
  const rarity = item.rarity === 'Unique' || item.rarity === 'Magic' || item.rarity === 'Rare' ? item.rarity : 'Rare'
  return watchFromParsedItem({
    name: item.name || '',
    baseType: item.baseType || '',
    itemClass: item.itemClass || '',
    rarity,
    identified: item.identified !== false,
    explicits: item.explicits ?? [],
  })
}

export function DealsPanel({ ctx }: { ctx: ScalpelPluginContext }): JSX.Element {
  const [tab, setTab] = useState<Tab>('feed')
  const [snap, setSnap] = useState<MonitorSnapshot | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [fx, setFx] = useState<Array<{ name: string; chaosValue: number; divineValue?: number }>>([])
  const [fxAt, setFxAt] = useState<number | null>(null)
  const [listingsError, setListingsError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const next = await loadSnapshot(ctx)
    try {
      next.loggedIn = (await hostTrade(ctx).getAuth()).loggedIn
    } catch {
      next.loggedIn = false
    }
    setSnap(next)
    setSelectedId((id) => id ?? next.watches[0]?.id ?? null)
  }, [ctx])

  useEffect(() => {
    void reload()
    const stop = attachMonitor(ctx, () => {
      void reload()
    })
    const id = window.setInterval(() => {
      void reload()
    }, 4000)
    return () => {
      stop()
      window.clearInterval(id)
    }
  }, [ctx, reload])

  useEffect(() => {
    if (tab !== 'exchange') return
    void (async () => {
      const { prices, updatedAt } = await ctx.prices.getPrices({ category: 'currency' })
      setFx(
        prices
          .filter((p) => /chaos|exalted|divine/i.test(p.name))
          .map((p) => ({ name: p.name, chaosValue: p.chaosValue, divineValue: p.divineValue })),
      )
      setFxAt(updatedAt)
    })()
  }, [ctx, tab])

  const settings = snap?.settings ?? defaultSettings()
  const selected = useMemo(
    () => snap?.watches.find((w) => w.id === selectedId) ?? null,
    [snap, selectedId],
  )

  const patchSettings = async (patch: Partial<MonitorSettings>): Promise<void> => {
    const next = { ...settings, ...patch }
    await saveSettings(ctx, next)
    await reload()
  }

  const patchWatches = async (watches: Watch[]): Promise<void> => {
    await saveWatches(ctx, watches)
    await reload()
  }

  const updateSelected = async (patch: Partial<Watch>): Promise<void> => {
    if (!snap || !selected) return
    await patchWatches(snap.watches.map((w) => (w.id === selected.id ? { ...w, ...patch } : w)))
  }

  const loadListings = async (watch: Watch): Promise<void> => {
    setBusy('listings')
    setListingsError(null)
    try {
      await fetchWatchListings(ctx, watch)
      setSelectedId(watch.id)
      setTab('listings')
      await reload()
    } catch (err) {
      setListingsError(err instanceof Error ? err.message : String(err))
      setTab('listings')
    } finally {
      setBusy(null)
    }
  }

  if (!snap) {
    return (
      <div className="sd-root">
        <style>{DEALS_CSS}</style>
        <div className="sd-empty">Loading…</div>
      </div>
    )
  }

  return (
    <div className="sd-root">
      <style>{DEALS_CSS}</style>
      <div className="sd-banner">
        <strong>Monitor / alert only.</strong> This plugin never whispers, buys, or sends game input. You
        open the trade site and act yourself. GGG forbids automated or timer-triggered game actions.
      </div>
      <header className="sd-header">
        <h1 className="sd-title">Listing watch</h1>
        <p className="sd-sub">
          {ctx.getLeague() || 'No league'} · PoE2 · flags below median / MAD / your multiplier
        </p>
        <div className="sd-row">
          <button
            type="button"
            className={settings.monitoring ? 'danger' : 'primary'}
            onClick={() => void patchSettings({ monitoring: !settings.monitoring })}
          >
            {settings.monitoring ? 'Stop monitor' : 'Start monitor'}
          </button>
          {snap.loggedIn ? (
            <span className="sd-status">Trade session: signed in</span>
          ) : (
            <button type="button" className="primary" onClick={() => void hostTrade(ctx).login().then(() => reload())}>
              Log in to pathofexile.com
            </button>
          )}
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            Min interval (s)
            <input
              type="number"
              min={15}
              style={{ width: 72 }}
              value={Math.round(settings.minIntervalMs / 1000)}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isFinite(n) && n >= 15) void patchSettings({ minIntervalMs: n * 1000 })
              }}
            />
          </label>
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={settings.desktopNotifications}
              onChange={(e) => void patchSettings({ desktopNotifications: e.target.checked })}
            />
            Desktop notifications
          </label>
        </div>
        <div className="sd-tabs">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={`sd-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </header>
      <div className="sd-body">
        {snap.lastError ? <div className="sd-status err">{snap.lastError}</div> : null}
        <div className="sd-status">
          Last scan {fmtAgo(snap.lastTickAt)}
          {snap.backoffUntil && snap.backoffUntil > Date.now()
            ? ` · backing off until ${new Date(snap.backoffUntil).toLocaleTimeString()}`
            : ''}
        </div>

        {tab === 'feed' && (
          <Feed
            alerts={snap.alerts}
            copied={copied}
            onOpen={(url) => ctx.openExternal(url)}
            onCopy={async (text, id) => {
              const ok = await copyText(text)
              setCopied(ok ? id : null)
            }}
            onClear={async () => {
              await saveAlerts(ctx, [])
              await reload()
            }}
          />
        )}

        {tab === 'listings' && (
          <ListingsView
            watches={snap.watches}
            packs={snap.listings}
            selectedId={selectedId}
            loggedIn={Boolean(snap.loggedIn)}
            busy={busy}
            copied={copied}
            error={listingsError}
            onSelect={setSelectedId}
            onLoad={() => {
              if (selected) void loadListings(selected)
            }}
            onOpen={(url) => ctx.openExternal(url)}
            onCopy={async (text, id) => {
              const ok = await copyText(text)
              setCopied(ok ? id : null)
            }}
            onWhisper={async (queryId, listingId, league) => {
              await ctx.trade.whisperSeller(queryId, listingId, league)
            }}
            onHideout={async (queryId, listingId, league) => {
              await ctx.trade.visitHideout(queryId, listingId, league)
            }}
          />
        )}

        {tab === 'watches' && (
          <Watches
            watches={snap.watches}
            selected={selected}
            busy={busy}
            onSelect={setSelectedId}
            onAdd={async () => {
              const w = defaultWatch()
              await patchWatches([...snap.watches, w])
              setSelectedId(w.id)
            }}
            onFromItem={async () => {
              setBusy('item')
              try {
                const captured = await ctx.copyAndEvaluateItem({ showOverlay: false, dispatch: true })
                const w = watchFromHover(ctx, captured)
                if (!w) return
                await patchWatches([...snap.watches, w])
                setSelectedId(w.id)
              } finally {
                setBusy(null)
              }
            }}
            onRemove={async (id) => {
              await patchWatches(snap.watches.filter((w) => w.id !== id))
            }}
            onChange={(patch) => void updateSelected(patch)}
            onOpenSearch={async () => {
              if (!selected) return
              setBusy('search')
              try {
                const res = await hostTrade(ctx).openSearch(watchToSearchItem(selected))
                if (res.url) ctx.openExternal(res.url)
              } finally {
                setBusy(null)
              }
            }}
            onLoadListings={() => {
              if (selected) void loadListings(selected)
            }}
          />
        )}

        {tab === 'exchange' && <Exchange prices={fx} updatedAt={fxAt} onRefresh={() => ctx.prices.refresh()} />}

        {tab === 'about' && <About />}
      </div>
    </div>
  )
}

function Feed(props: {
  alerts: Alert[]
  copied: string | null
  onOpen: (url: string) => void
  onCopy: (text: string, id: string) => void
  onClear: () => void
}): JSX.Element {
  if (props.alerts.length === 0) {
    return (
      <div className="sd-empty">
        No flags yet. Add a watch, sign in, and start the monitor. Cheap listings show up here for you to open
        manually.
      </div>
    )
  }
  return (
    <>
      <div className="sd-row">
        <button type="button" onClick={props.onClear}>
          Clear feed
        </button>
      </div>
      {props.alerts.map((a) => {
        const icon = resolveIcon({ icon: a.icon, name: a.itemName, baseType: a.baseType })
        return (
        <article key={a.id} className="sd-card">
          <div className="sd-listing">
            {icon ? <img className="sd-listing-icon" src={icon} alt="" /> : <div className="sd-listing-icon placeholder">no art</div>}
            <div>
              <div className="sd-alert-top">
                <h3 className="sd-listing-name">{a.itemName}</h3>
                <span className="sd-price">{a.priceLabel}</span>
              </div>
              <div className="sd-meta">
                {a.watchName}
                {a.itemName !== a.baseType && a.baseType ? ` · ${a.baseType}` : ''}
                {' · '}
                {Math.round(a.vsMedian * 100)}% of median · {a.reasons.join(', ')} · score {a.scoreLabel}
                {' · '}
                {fmtAgo(a.at)}
              </div>
              <div className={`sd-seller ${a.online ? 'on' : 'off'}`}>{sellerLine(a)}</div>
            </div>
          </div>
          <div className="sd-actions">
            <button type="button" className="primary" onClick={() => props.onOpen(a.tradeUrl)}>
              Open trade site
            </button>
            {a.whisper ? (
              <button type="button" onClick={() => props.onCopy(a.whisper ?? '', a.id)}>
                {props.copied === a.id ? 'Copied whisper' : 'Copy whisper'}
              </button>
            ) : null}
          </div>
        </article>
        )
      })}
    </>
  )
}

function Watches(props: {
  watches: Watch[]
  selected: Watch | null
  busy: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onFromItem: () => void
  onRemove: (id: string) => void
  onChange: (patch: Partial<Watch>) => void
  onOpenSearch: () => void
  onLoadListings: () => void
}): JSX.Element {
  const w = props.selected
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 240px) 1fr', gap: 10, minHeight: 0 }}>
      <div>
        <div className="sd-row">
          <button type="button" className="primary" onClick={props.onAdd}>
            Add watch
          </button>
          <button type="button" disabled={props.busy === 'item'} onClick={props.onFromItem}>
            From hovered item
          </button>
        </div>
        <div className="sd-watch-list">
          {props.watches.length === 0 ? <div className="sd-empty">No watches</div> : null}
          {props.watches.map((row) => (
            <button
              key={row.id}
              type="button"
              className={`sd-watch-row${row.id === w?.id ? ' active' : ''}`}
              onClick={() => props.onSelect(row.id)}
            >
              <span>
                {row.enabled ? '●' : '○'} {row.name}
                <div className="sd-meta">
                  {isUniqueMatch(row)
                    ? row.itemName
                      ? `Unique · ${row.itemName}${row.baseType ? ` · ${row.baseType}` : ''}`
                      : `Unique on ${row.baseType || row.itemClass || 'base'}`
                    : row.baseType || row.itemClass || 'no base'}
                </div>
              </span>
            </button>
          ))}
        </div>
      </div>
      {w ? (
        <div className="sd-card">
          <div className="sd-form">
            <label className="wide">
              Match
              <select
                value={w.matchBy}
                onChange={(e) => {
                  const matchBy = e.target.value as Watch['matchBy']
                  props.onChange({
                    matchBy,
                    rarity: matchBy === 'uniqueName' ? 'Unique' : w.rarity === 'Unique' ? 'Rare' : w.rarity,
                  })
                }}
              >
                <option value="base">Base type + mods (rares)</option>
                <option value="uniqueName">Unique printed name</option>
              </select>
            </label>
            <label>
              Label
              <input value={w.name} onChange={(e) => props.onChange({ name: e.target.value })} />
            </label>
            {isUniqueMatch(w) ? (
              <label>
                Unique name as printed
                <input
                  value={w.itemName}
                  placeholder="Headhunter"
                  onChange={(e) => props.onChange({ itemName: e.target.value, rarity: 'Unique', matchBy: 'uniqueName' })}
                />
              </label>
            ) : (
              <label>
                Rarity
                <select
                  value={w.rarity}
                  onChange={(e) => props.onChange({ rarity: e.target.value as Watch['rarity'] })}
                >
                  <option value="Rare">Rare</option>
                  <option value="Magic">Magic</option>
                  <option value="Any">Any (searched as rare)</option>
                </select>
              </label>
            )}
            <label>
              Base type{isUniqueMatch(w) ? ' (optional)' : ''}
              <input value={w.baseType} onChange={(e) => props.onChange({ baseType: e.target.value })} />
            </label>
            <label>
              Item class
              <input value={w.itemClass} onChange={(e) => props.onChange({ itemClass: e.target.value })} />
            </label>
            <label className="wide">
              Paste item text (Ctrl+C in PoE)
              <textarea
                placeholder={'Item Class: Belts\nRarity: Unique\nHeadhunter\nHeavy Belt'}
                onBlur={(e) => {
                  const parsed = parsePoeItemClipboard(e.target.value)
                  if (!parsed) return
                  const next = watchFromParsedItem(parsed)
                  props.onChange({
                    name: next.name,
                    baseType: next.baseType,
                    itemClass: next.itemClass,
                    itemName: next.itemName,
                    rarity: next.rarity,
                    matchBy: next.matchBy,
                    mods: next.mods,
                  })
                  e.target.value = ''
                }}
              />
            </label>
            <label>
              Listed within
              <select value={w.listedTime} onChange={(e) => props.onChange({ listedTime: e.target.value })}>
                <option value="">Any time</option>
                <option value="1day">1 day</option>
                <option value="3hours">3 hours</option>
                <option value="1hour">1 hour</option>
                <option value="15mins">15 minutes</option>
              </select>
            </label>
            <label>
              Flag under % of median
              <input
                type="number"
                min={10}
                max={100}
                value={Math.round(w.flagMultiplier * 100)}
                onChange={(e) => props.onChange({ flagMultiplier: Number(e.target.value) / 100 })}
              />
            </label>
            <label>
              Bottom percentile
              <input
                type="number"
                min={1}
                max={40}
                value={Math.round(w.percentile * 100)}
                onChange={(e) => props.onChange({ percentile: Number(e.target.value) / 100 })}
              />
            </label>
            <label>
              Min samples
              <input
                type="number"
                min={3}
                value={w.minSamples}
                onChange={(e) => props.onChange({ minSamples: Number(e.target.value) })}
              />
            </label>
            <label>
              Notify cooldown (s)
              <input
                type="number"
                min={10}
                value={Math.round(w.notifyCooldownMs / 1000)}
                onChange={(e) => props.onChange({ notifyCooldownMs: Number(e.target.value) * 1000 })}
              />
            </label>
            <label>
              Min divine (trade filter)
              <input
                type="number"
                value={w.minPriceDivine ?? ''}
                onChange={(e) =>
                  props.onChange({ minPriceDivine: e.target.value === '' ? null : Number(e.target.value) })
                }
              />
            </label>
            <label>
              Max divine (trade filter)
              <input
                type="number"
                value={w.maxPriceDivine ?? ''}
                onChange={(e) =>
                  props.onChange({ maxPriceDivine: e.target.value === '' ? null : Number(e.target.value) })
                }
              />
            </label>
            <label className="wide" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={w.enabled}
                onChange={(e) => props.onChange({ enabled: e.target.checked })}
              />
              Enabled
            </label>
          </div>
          <h3 style={{ marginTop: 12 }}>Weighted mods</h3>
          <p className="sd-note">
            {isUniqueMatch(w)
              ? 'Unique search uses the printed name (and optional base). Mods here are sent as stat filters. Weight still only scores fetched rows — nothing is auto-bought.'
              : 'Required mods must appear on the listing. Weight is only a score, not auto-buy.'}
          </p>
          {w.mods.map((m, i) => (
            <div key={`${w.id}-m-${i}`} className="sd-mod-row">
              <input
                value={m.text}
                placeholder="mod text"
                onChange={(e) => {
                  const mods = w.mods.slice()
                  mods[i] = { ...m, text: e.target.value }
                  props.onChange({ mods })
                }}
              />
              <input
                type="number"
                value={m.weight}
                onChange={(e) => {
                  const mods = w.mods.slice()
                  mods[i] = { ...m, weight: Number(e.target.value) }
                  props.onChange({ mods })
                }}
              />
              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <input
                  type="checkbox"
                  checked={Boolean(m.required)}
                  onChange={(e) => {
                    const mods = w.mods.slice()
                    mods[i] = { ...m, required: e.target.checked }
                    props.onChange({ mods })
                  }}
                />
                req
              </label>
              <button
                type="button"
                onClick={() => props.onChange({ mods: w.mods.filter((_, j) => j !== i) })}
              >
                ×
              </button>
            </div>
          ))}
          <div className="sd-actions">
            <button
              type="button"
              onClick={() => props.onChange({ mods: [...w.mods, { text: '', weight: 1, required: false }] })}
            >
              Add mod
            </button>
            <button type="button" className="primary" disabled={props.busy === 'search'} onClick={props.onOpenSearch}>
              Open this search
            </button>
            <button type="button" disabled={props.busy === 'listings'} onClick={props.onLoadListings}>
              {props.busy === 'listings' ? 'Loading listings…' : 'Load listings'}
            </button>
            <button type="button" className="danger" onClick={() => props.onRemove(w.id)}>
              Delete watch
            </button>
          </div>
        </div>
      ) : (
        <div className="sd-empty">Select or add a watch</div>
      )}
    </div>
  )
}

function ListingsView(props: {
  watches: Watch[]
  packs: Record<string, WatchListings>
  selectedId: string | null
  loggedIn: boolean
  busy: string | null
  copied: string | null
  error: string | null
  onSelect: (id: string) => void
  onLoad: () => void
  onOpen: (url: string) => void
  onCopy: (text: string, id: string) => void
  onWhisper: (queryId: string, listingId: string, league: string) => Promise<void>
  onHideout: (queryId: string, listingId: string, league: string) => Promise<void>
}): JSX.Element {
  const [actionStatus, setActionStatus] = useState<Record<string, 'pending' | 'success' | 'failed'>>({})
  const pack = props.selectedId ? props.packs[props.selectedId] : undefined
  const watch = props.watches.find((w) => w.id === props.selectedId) ?? null

  if (props.watches.length === 0) {
    return <div className="sd-empty">Add a watch first, then load listings for it.</div>
  }

  return (
    <>
      <div className="sd-row">
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 220 }}>
          Watch
          <select
            value={props.selectedId ?? ''}
            onChange={(e) => props.onSelect(e.target.value)}
          >
            {props.watches.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="primary" disabled={!watch || props.busy === 'listings'} onClick={props.onLoad}>
          {props.busy === 'listings' ? 'Loading…' : 'Load listings'}
        </button>
        {pack?.url ? (
          <button type="button" onClick={() => props.onOpen(pack.url)}>
            Open trade site
          </button>
        ) : null}
      </div>
      <p className="sd-note">
        Same rows Price Check fetches (first 10). Icon, name, seller, and whisper come from the official trade
        listing. Nothing is sent unless you click.
      </p>
      {props.error ? <div className="sd-status err">{props.error}</div> : null}
      {!pack ? (
        <div className="sd-empty">No listings loaded yet. Sign in and click Load listings.</div>
      ) : (
        <>
          <div className="sd-status">
            {pack.listings.length} shown
            {pack.total > pack.listings.length ? ` of ${pack.total}` : ''}
            {pack.league ? ` · ${pack.league}` : ''}
            {' · fetched '}
            {fmtAgo(pack.fetchedAt)}
          </div>
          {pack.listings.map((row) => {
            const icon = resolveIcon({ icon: row.icon, name: row.name, baseType: row.baseType })
            const mods = [...row.implicitMods, ...row.explicitMods].slice(0, 4)
            const status = actionStatus[row.id]
            const acting = status === 'pending'
            return (
              <article key={row.id} className="sd-card">
                <div className="sd-listing">
                  {icon ? (
                    <img className="sd-listing-icon" src={icon} alt="" />
                  ) : (
                    <div className="sd-listing-icon placeholder">no art</div>
                  )}
                  <div>
                    <h3 className="sd-listing-name">{row.name || watch?.name || 'Listing'}</h3>
                    {row.baseType && row.baseType !== row.name ? (
                      <div className="sd-listing-base">{row.baseType}</div>
                    ) : null}
                    {mods.length > 0 ? (
                      <div className="sd-listing-mods">
                        {mods.map((mod) => (
                          <div key={mod}>{mod}</div>
                        ))}
                      </div>
                    ) : null}
                    <div className={`sd-seller ${row.online ? 'on' : 'off'}`}>{sellerLine(row)}</div>
                  </div>
                  <div className="sd-listing-side">
                    <span className="sd-price">{listingPriceLabel(row)}</span>
                  </div>
                </div>
                <div className="sd-actions">
                  {pack.url ? (
                    <button type="button" className="primary" onClick={() => props.onOpen(pack.url)}>
                      Open trade site
                    </button>
                  ) : null}
                  {row.whisper ? (
                    <button type="button" onClick={() => props.onCopy(row.whisper ?? '', row.id)}>
                      {props.copied === row.id ? 'Copied whisper' : 'Copy whisper'}
                    </button>
                  ) : null}
                  {props.loggedIn && pack.queryId ? (
                    row.instantBuyout ? (
                      <button
                        type="button"
                        disabled={acting}
                        onClick={() => {
                          setActionStatus((prev) => ({ ...prev, [row.id]: 'pending' }))
                          void props
                            .onHideout(pack.queryId, row.id, pack.league)
                            .then(() => setActionStatus((prev) => ({ ...prev, [row.id]: 'success' })))
                            .catch(() => setActionStatus((prev) => ({ ...prev, [row.id]: 'failed' })))
                        }}
                      >
                        {status === 'success' ? 'Hideout ok' : status === 'failed' ? 'Hideout failed' : acting ? 'Traveling…' : 'Visit hideout'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={acting}
                        onClick={() => {
                          setActionStatus((prev) => ({ ...prev, [row.id]: 'pending' }))
                          void props
                            .onWhisper(pack.queryId, row.id, pack.league)
                            .then(() => setActionStatus((prev) => ({ ...prev, [row.id]: 'success' })))
                            .catch(() => setActionStatus((prev) => ({ ...prev, [row.id]: 'failed' })))
                        }}
                      >
                        {status === 'success' ? 'Whisper sent' : status === 'failed' ? 'Whisper failed' : acting ? 'Whispering…' : 'Whisper'}
                      </button>
                    )
                  ) : null}
                </div>
              </article>
            )
          })}
          {pack.listings.length === 0 ? <div className="sd-empty">Search returned no listings.</div> : null}
        </>
      )}
    </>
  )
}

function Exchange(props: {
  prices: Array<{ name: string; chaosValue: number; divineValue?: number }>
  updatedAt: number | null
  onRefresh: () => void
}): JSX.Element {
  return (
    <>
      <p className="sd-note">
        Informational spreads from Scalpel&apos;s poe.ninja snapshot (exalt baseline in PoE2). No auto-trading. Official
        Currency Exchange history is public on GGG&apos;s CDN; this view uses the same ninja feed Price Check already
        has.
      </p>
      <div className="sd-row">
        <button type="button" onClick={props.onRefresh}>
          Refresh ninja
        </button>
        <span className="sd-meta">Updated {props.updatedAt ? fmtAgo(props.updatedAt) : 'unknown'}</span>
      </div>
      <div className="sd-grid">
        {props.prices.map((p) => (
          <div key={p.name} className="sd-card">
            <h3>{p.name}</h3>
            <div className="sd-meta">
              exalt eq {p.chaosValue.toFixed(2)}
              {p.divineValue != null ? ` · divine ${p.divineValue.toFixed(3)}` : ''}
            </div>
          </div>
        ))}
      </div>
      {props.prices.length === 0 ? <div className="sd-empty">No currency rows in the current snapshot.</div> : null}
    </>
  )
}

function About(): JSX.Element {
  return (
    <div className="sd-card">
      <h3>What this is</h3>
      <p className="sd-note">
        Polls Scalpel&apos;s host trade search (the same rate-limited path as Price Check). Builds a rolling median and
        MAD per watch, then flags listings that look cheap. You click Open trade site. Nothing is whispered or bought
        for you.
      </p>
      <h3>What GGG did not open</h3>
      <ul className="sd-note">
        <li>No official PoE2 stash or public-stash stream. That API is still PoE1-only.</li>
        <li>No gold balance on the character endpoint. Fee warnings are not available.</li>
        <li>
          Trade is not GGG OAuth. Scalpel already holds your pathofexile.com session; this plugin reuses that login.
        </li>
        <li>New OAuth app registration is closed on GGG&apos;s developer site.</li>
      </ul>
      <p className="sd-note">
        This product isn&apos;t affiliated with or endorsed by Grinding Gear Games in any way.
      </p>
    </div>
  )
}

import type { PriceEntry, ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import {
  Button,
  ErrorBanner,
  formatPrice,
  ItemChip,
  RARITY_COLORS,
  Textarea,
  TextInput,
  Toggle,
} from '@scalpelpoe/plugin-sdk'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { gearToTradeSearch, poedbUrl, wikiUrl } from './links'
import { importBuildInput } from './parse-maxroll'
import type { BuildPlannerApi, BuildPlannerFileEntry, BuildPlan, CheckedState, GearEntry, GearGroup } from './types'

const DEFAULT_URL = 'https://maxroll.gg/poe2/planner/7c456i0y'

type PluginCtx = ScalpelPluginContext & { buildPlanner?: BuildPlannerApi; trade?: ScalpelPluginContext['trade'] }

interface AppProps {
  ctx: PluginCtx
}

function usePriceMap(ctx: ScalpelPluginContext): Map<string, PriceEntry> {
  const [map, setMap] = useState<Map<string, PriceEntry>>(new Map())

  const load = useCallback(async () => {
    const { prices } = await ctx.prices.getPrices()
    const next = new Map<string, PriceEntry>()
    for (const p of prices) {
      next.set(p.name.toLowerCase(), p)
    }
    setMap(next)
  }, [ctx])

  useEffect(() => {
    void load()
    return ctx.prices.onChange(() => {
      void load()
    })
  }, [ctx, load])

  return map
}

function lookupPrice(entry: GearEntry, prices: Map<string, PriceEntry>): PriceEntry | null {
  if (!entry.isUnique) return null
  return prices.get(entry.title.toLowerCase()) ?? null
}

function formatEntryPrice(price: PriceEntry | null, poeVersion: 1 | 2): string | null {
  if (!price) return null
  const val = price.divineValue ?? price.chaosValue
  if (val == null || val <= 0) return null
  const unit = price.divineValue != null ? ' div' : poeVersion === 2 ? ' ex' : ' c'
  return `${formatPrice(val)}${unit}`
}

function GearRow({
  entry,
  checked,
  onToggle,
  priceLabel,
  ctx,
  poeVersion,
  similarItems,
}: {
  entry: GearEntry
  checked: boolean
  onToggle: () => void
  priceLabel: string | null
  ctx: PluginCtx
  poeVersion: 1 | 2
  similarItems: boolean
}) {
  const color = entry.isUnique ? RARITY_COLORS.Unique : RARITY_COLORS.Rare
  const poedb = poedbUrl(entry, poeVersion)
  const wiki = wikiUrl(entry, poeVersion)
  const [searching, setSearching] = useState(false)
  const [tradeError, setTradeError] = useState<string | null>(null)

  const onTrade = useCallback(async () => {
    if (!ctx.trade?.openSearch) return
    setSearching(true)
    setTradeError(null)
    try {
      const { url } = await ctx.trade.openSearch(gearToTradeSearch(entry, { similarItems }))
      ctx.openExternal(url)
    } catch (e) {
      setTradeError(e instanceof Error ? e.message : 'Trade search failed')
    } finally {
      setSearching(false)
    }
  }, [ctx, entry, similarItems])

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 8,
        alignItems: 'start',
        padding: '8px 0',
        borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
        opacity: checked ? 0.45 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        title="Mark acquired"
        style={{ marginTop: 4, accentColor: 'var(--accent)' }}
      />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted, #888)', minWidth: 72 }}>{entry.slotLabel}</span>
          {entry.isUnique ? (
            <ItemChip name={entry.title} title={entry.title} />
          ) : (
            <span style={{ color, fontWeight: 600, fontSize: 13 }}>{entry.title}</span>
          )}
          {entry.subtitle && !entry.isUnique && (
            <span style={{ fontSize: 11, color: 'var(--text-muted, #888)' }}>({entry.subtitle})</span>
          )}
          {priceLabel && (
            <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{priceLabel}</span>
          )}
        </div>
        {entry.notes && (
          <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginTop: 4, whiteSpace: 'pre-wrap' }}>
            {entry.notes}
          </div>
        )}
        {entry.subtitle && entry.isUnique && (
          <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginTop: 2 }}>{entry.subtitle}</div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {poedb && (
          <Button variant="ghost" size="sm" onClick={() => ctx.openExternal(poedb)}>
            DB
          </Button>
        )}
        {wiki && (
          <Button variant="ghost" size="sm" onClick={() => ctx.openExternal(wiki)}>
            Wiki
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void onTrade()}
          disabled={searching || !ctx.trade?.openSearch}
          title={
            tradeError ??
            (similarItems && !entry.isUnique
              ? 'Search any item in this slot with at least one guide stat'
              : entry.notes
                ? 'Search trade for base type + guide stat priority'
                : 'Search trade for this item')
          }
        >
          {searching ? '…' : 'Trade'}
        </Button>
      </div>
    </div>
  )
}

function GroupSection({
  group,
  checked,
  onToggle,
  prices,
  ctx,
  poeVersion,
  similarItems,
}: {
  group: GearGroup
  checked: CheckedState
  onToggle: (id: string) => void
  prices: Map<string, PriceEntry>
  ctx: PluginCtx
  poeVersion: 1 | 2
  similarItems: boolean
}) {
  const acquired = group.entries.filter((e) => checked[e.id]).length
  return (
    <section style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 4,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{group.label}</h3>
        <span style={{ fontSize: 11, color: 'var(--text-muted, #888)' }}>
          {acquired}/{group.entries.length} acquired
        </span>
      </div>
      {group.entries.map((entry) => (
        <GearRow
          key={entry.id}
          entry={entry}
          checked={Boolean(checked[entry.id])}
          onToggle={() => onToggle(entry.id)}
          priceLabel={formatEntryPrice(lookupPrice(entry, prices), poeVersion)}
          ctx={ctx}
          poeVersion={poeVersion}
          similarItems={similarItems}
        />
      ))}
    </section>
  )
}

export function App({ ctx }: AppProps) {
  const [input, setInput] = useState(DEFAULT_URL)
  const [plan, setPlan] = useState<BuildPlan | null>(null)
  const [groupIndex, setGroupIndex] = useState(0)
  const [checked, setChecked] = useState<CheckedState>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [buildFiles, setBuildFiles] = useState<BuildPlannerFileEntry[]>([])
  const [selectedBuildFile, setSelectedBuildFile] = useState('')
  const [buildPlannerPath, setBuildPlannerPath] = useState<string | null>(null)
  const [similarItems, setSimilarItems] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const poeVersion = ctx.getPoeVersion()
  const league = ctx.getLeague()
  const prices = usePriceMap(ctx)

  useEffect(() => {
    void ctx.storage.get<CheckedState>('checked').then((saved) => {
      if (saved) setChecked(saved)
    })
    void ctx.storage.get<boolean>('tradeSimilarItems').then((saved) => {
      if (saved != null) setSimilarItems(saved)
    })
  }, [ctx])

  const persistChecked = useCallback(
    (next: CheckedState) => {
      setChecked(next)
      void ctx.storage.set('checked', next)
    },
    [ctx],
  )

  const toggleEntry = useCallback(
    (id: string) => {
      persistChecked({ ...checked, [id]: !checked[id] })
    },
    [checked, persistChecked],
  )

  const doImport = useCallback(
    async (textOverride?: string) => {
      const source = (textOverride ?? input).trim()
      if (!source) return
      setError(null)
      setLoading(true)
      try {
        const next = await importBuildInput(source, ctx.fetch)
        setPlan(next)
        setGroupIndex(0)
        if (!textOverride) setInput(source)
        await ctx.storage.set('lastInput', source)
        await ctx.storage.set('lastPlan', next)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    },
    [ctx, input],
  )

  const loadBuildPlannerFile = useCallback(
    async (filename: string) => {
      if (!filename) return
      setError(null)
      setLoading(true)
      try {
        const { content } = await ctx.buildPlanner!.read(filename)
        setSelectedBuildFile(filename)
        setInput(content)
        await doImport(content)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    },
    [ctx, doImport],
  )

  useEffect(() => {
    void (async () => {
      const savedPlan = await ctx.storage.get<BuildPlan>('lastPlan')
      const savedInput = await ctx.storage.get<string>('lastInput')
      if (savedInput) setInput(savedInput)
      if (savedPlan) setPlan(savedPlan)

      try {
        if (!ctx.buildPlanner) return
        const { path, files } = await ctx.buildPlanner.list()
        setBuildPlannerPath(path)
        setBuildFiles(files)
        const savedFile = await ctx.storage.get<string>('lastBuildFile')
        const preferred =
          files.find((f) => f.filename === savedFile)?.filename ??
          files.find((f) => f.name.toLowerCase().includes('zizarans silverfist'))?.filename ??
          files[0]?.filename
        if (preferred) {
          setSelectedBuildFile(preferred)
          if (!savedPlan) {
            await loadBuildPlannerFile(preferred)
          }
        }
      } catch {
        // BuildPlanner API unavailable (older Scalpel host)
      }
    })()
  }, [ctx, loadBuildPlannerFile])

  const activeGroup = plan?.groups[groupIndex] ?? plan?.groups[0]

  const uniqueTotal = useMemo(() => {
    if (!activeGroup) return null
    let sum = 0
    let count = 0
    for (const e of activeGroup.entries) {
      const p = lookupPrice(e, prices)
      const val = p?.divineValue ?? p?.chaosValue
      if (p && val != null && val > 0) {
        sum += val
        count++
      }
    }
    if (count === 0) return null
    const unit = prices.values().next().value?.divineValue != null ? ' div' : poeVersion === 2 ? ' ex' : ' c'
    return `~${formatPrice(sum)}${unit} (${count} uniques priced)`
  }, [activeGroup, prices, poeVersion])

  const onFile = useCallback(
    async (file: File) => {
      const text = await file.text()
      setInput(text)
      await doImport(text)
    },
    [doImport],
  )

  return (
    <div
      style={{
        padding: 12,
        color: 'var(--text)',
        fontFamily: 'inherit',
        fontSize: 13,
        height: '100%',
        overflow: 'auto',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          padding: '8px 10px',
          borderRadius: 6,
          background: 'var(--bg-card, rgba(255,255,255,0.04))',
          fontSize: 12,
          color: 'var(--text-muted, #aaa)',
          lineHeight: 1.45,
        }}
      >
        Import a MaxRoll planner URL or a GGG <code>.build</code> export. Uniques show poe.ninja prices when Scalpel
        has them cached.
      </div>

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <TextInput
          value={input.startsWith('{') ? '' : input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="MaxRoll URL or planner ID (e.g. 7c456i0y)"
          fullWidth
        />
        {!input.startsWith('{') && (
          <span style={{ fontSize: 11, color: 'var(--text-muted, #888)' }}>
            Or paste .build JSON below, pick from BuildPlanner, or import a file
          </span>
        )}
        {buildFiles.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <label htmlFor="buildplanner-select" style={{ fontSize: 11, color: 'var(--text-muted, #888)' }}>
              BuildPlanner
            </label>
            <select
              id="buildplanner-select"
              value={selectedBuildFile}
              onChange={(e) => setSelectedBuildFile(e.target.value)}
              style={{
                flex: '1 1 200px',
                minWidth: 0,
                background: 'var(--bg-input, #1a1a1a)',
                color: 'var(--text)',
                border: '1px solid var(--border-subtle, #333)',
                borderRadius: 4,
                padding: '4px 8px',
              }}
            >
              {buildFiles.map((f) => (
                <option key={f.filename} value={f.filename}>
                  {f.name}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              size="sm"
              disabled={!selectedBuildFile || loading}
              onClick={() => {
                void loadBuildPlannerFile(selectedBuildFile)
                void ctx.storage.set('lastBuildFile', selectedBuildFile)
              }}
            >
              Load
            </Button>
          </div>
        )}
        <Textarea
          value={input.startsWith('{') ? input : ''}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Paste .build JSON here…'
          rows={3}
          fullWidth
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Button variant="primary" onClick={() => void doImport()} disabled={loading}>
            {loading ? 'Loading…' : 'Import build'}
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            Import .build file
          </Button>
          {ctx.buildPlanner && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void ctx.buildPlanner!.openFolder()}
              title={buildPlannerPath ?? 'Open BuildPlanner folder'}
            >
              Open folder
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => void ctx.prices.refresh()}>
            Refresh prices
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".build,.json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onFile(f)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 12 }}>
          <ErrorBanner message={error} tone="error" />
        </div>
      )}

      {plan && (
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{plan.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted, #888)' }}>
              {plan.sourceLabel}
              {plan.author ? ` · ${plan.author}` : ''}
              {' · '}
              {league}
            </div>
          </div>

          {plan.groups.length > 1 && (
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="group-select" style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginRight: 8 }}>
                Gear set
              </label>
              <select
                id="group-select"
                value={groupIndex}
                onChange={(e) => setGroupIndex(Number(e.target.value))}
                style={{
                  background: 'var(--bg-input, #1a1a1a)',
                  color: 'var(--text)',
                  border: '1px solid var(--border-subtle, #333)',
                  borderRadius: 4,
                  padding: '4px 8px',
                }}
              >
                {plan.groups.map((g, i) => (
                  <option key={g.id} value={i}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {uniqueTotal && (
            <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 8 }}>{uniqueTotal}</div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
              fontSize: 12,
            }}
          >
            <Toggle
              checked={similarItems}
              onChange={(next) => {
                setSimilarItems(next)
                void ctx.storage.set('tradeSimilarItems', next)
              }}
            />
            <span style={{ color: 'var(--text-muted, #888)' }}>
              Similar items — any base in slot with at least one priority stat
            </span>
          </div>

          {activeGroup && (
            <GroupSection
              group={activeGroup}
              checked={checked}
              onToggle={toggleEntry}
              prices={prices}
              ctx={ctx}
              poeVersion={poeVersion}
              similarItems={similarItems}
            />
          )}
        </div>
      )}
    </div>
  )
}

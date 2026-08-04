import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CraftApi, CraftItemStateResult, ModSearchHitResult, PoeItem, ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { Button, ErrorBanner, ItemChip } from '@scalpelpoe/plugin-sdk'
import { BASE_GROUPS, WeightTableLayout, collectTagsFromReport, poolLabel, tagColor } from './WeightTable'
import { inputStyle, matchesSearch, pct, selectStyle } from './craft-utils'
import { craftStateToPoeItem } from './craft-session'
import type { CraftTabProps } from './craft-build-context'
import { resolveMarksmanEnabled } from './craft-build-context'
import type { ModPoolReport } from './ModCheatSheet.types'

type ViewMode = 'split' | 'flat'
type SortKey = 'chance' | 'weight' | 'ilvl' | 'name'
type PoolSource = 'craft' | 'marksman' | 'desecrated' | 'all'
type LookupMode = 'base' | 'global'

interface ModCheatSheetProps extends CraftTabProps {
  craft: CraftApi
  ctx: ScalpelPluginContext
  item: PoeItem | null
  sessionState: CraftItemStateResult | null
  onItemChange: (item: PoeItem | null) => void
  onSessionChange: (state: CraftItemStateResult | null) => void
}

function GlobalSearchTable({ hits }: { hits: ModSearchHitResult[] }): JSX.Element {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ textAlign: 'left', opacity: 0.7, position: 'sticky', top: 0, background: 'rgba(20,20,24,0.95)' }}>
          <th style={{ padding: '6px 8px' }}>Weight</th>
          <th style={{ padding: '6px 8px' }}>iLvl</th>
          <th style={{ padding: '6px 8px' }}>Base</th>
          <th style={{ padding: '6px 8px' }}>Class</th>
          <th style={{ padding: '6px 8px' }}>Pool</th>
          <th style={{ padding: '6px 8px' }}>Tier</th>
          <th style={{ padding: '6px 8px' }}>Mod</th>
          <th style={{ padding: '6px 8px' }}>Type</th>
        </tr>
      </thead>
      <tbody>
        {hits.map((h) => (
          <tr key={`${h.baseType}:${h.modId}`} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <td style={{ padding: '6px 8px', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{h.spawnWeight}</td>
            <td style={{ padding: '6px 8px', opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>{h.ilvl}</td>
            <td style={{ padding: '6px 8px' }}>{h.baseType}</td>
            <td style={{ padding: '6px 8px', opacity: 0.65, fontSize: 11 }}>{h.itemClass}</td>
            <td style={{ padding: '6px 8px', opacity: 0.7, fontSize: 11 }}>{poolLabel(h.pool)}</td>
            <td style={{ padding: '6px 8px', opacity: 0.65 }}>{h.tierName}</td>
            <td style={{ padding: '6px 8px' }}>{h.text}</td>
            <td style={{ padding: '6px 8px', opacity: 0.7 }}>{h.kind === 'p' ? 'Prefix' : 'Suffix'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ModCheatSheet({
  craft,
  item,
  sessionState,
  buildContext,
  onSmartImport,
}: ModCheatSheetProps): JSX.Element {
  const workingItem = sessionState ? craftStateToPoeItem(sessionState) : item
  const marksmanEnabled = resolveMarksmanEnabled(workingItem, buildContext) || sessionState?.marksmanEnabled === true
  const [baseType, setBaseType] = useState(workingItem?.baseType ?? '')
  const [itemLevel, setItemLevel] = useState(workingItem?.itemLevel ?? 82)
  const [kind, setKind] = useState<'all' | 'p' | 's'>('all')
  const [context, setContext] = useState<'fresh' | 'item'>(workingItem ? 'item' : 'fresh')
  const [view, setView] = useState<ViewMode>('split')
  const [lookupMode, setLookupMode] = useState<LookupMode>('base')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('weight')
  const [report, setReport] = useState<ModPoolReport | null>(null)
  const [globalHits, setGlobalHits] = useState<ModSearchHitResult[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [baseQuery, setBaseQuery] = useState(workingItem?.baseType ?? '')
  const [baseSuggestions, setBaseSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [poolSource, setPoolSource] = useState<PoolSource>('craft')
  const [itemClass, setItemClass] = useState(workingItem?.itemClass ?? '')
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const globalDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showPoolCol = poolSource === 'all' || poolSource === 'marksman' || poolSource === 'desecrated'
  const reportTags = useMemo(() => (report ? collectTagsFromReport(report) : []), [report])

  useEffect(() => {
    if (sessionState) {
      setBaseType(sessionState.baseType)
      setBaseQuery(sessionState.baseType)
      setItemLevel(sessionState.itemLevel)
      setItemClass(sessionState.itemClass)
      setContext('item')
    } else if (item) {
      setBaseType(item.baseType)
      setBaseQuery(item.baseType)
      setItemLevel(item.itemLevel)
      setItemClass(item.itemClass)
    }
  }, [sessionState, item])

  const loadSuggestions = useCallback(
    async (query: string) => {
      try {
        setBaseSuggestions(await craft.searchBases(query, 40, itemClass || undefined))
      } catch {
        setBaseSuggestions([])
      }
    },
    [craft, itemClass],
  )

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void loadSuggestions(baseQuery)
    }, 180)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [baseQuery, loadSuggestions])

  const pickBaseGroup = useCallback(
    async (group: string) => {
      setItemClass(group)
      setActiveTags(new Set())
      try {
        const bases = await craft.searchBases('', 1, group)
        if (bases[0]) {
          setBaseQuery(bases[0])
          setBaseType(bases[0])
        }
      } catch {
        /* keep current base */
      }
    },
    [craft],
  )

  const runLookup = useCallback(async () => {
    if (!baseType.trim()) {
      setError('Choose a base group, then search for a base type.')
      setReport(null)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await craft.modPool({
        baseType: baseType.trim(),
        itemLevel,
        kind,
        item: context === 'item' && poolSource === 'craft' ? workingItem : null,
        context: poolSource === 'craft' ? context : 'fresh',
        poolSource,
        marksmanEnabled: poolSource === 'craft' || poolSource === 'all' ? marksmanEnabled : undefined,
      })
      setReport(result)
      setExpanded(new Set())
      setActiveTags(new Set())
    } catch (err) {
      setReport(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [baseType, itemLevel, kind, context, workingItem, craft, marksmanEnabled, poolSource, buildContext.marksmanSource])

  const runGlobalSearch = useCallback(async () => {
    const q = search.trim()
    if (q.length < 2) {
      setGlobalHits([])
      return
    }
    setBusy(true)
    setError(null)
    try {
      setGlobalHits(
        await craft.searchMods({
          query: q,
          itemLevel,
          poolSource,
          itemClass: itemClass || undefined,
          kind,
          limit: 500,
        }),
      )
    } catch (err) {
      setGlobalHits([])
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [craft, search, itemLevel, poolSource, itemClass, kind])

  useEffect(() => {
    if (lookupMode === 'base' && baseType.trim()) void runLookup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseType, itemLevel, kind, context, marksmanEnabled, poolSource, buildContext.marksmanSource, lookupMode])

  useEffect(() => {
    if (lookupMode !== 'global') return
    if (globalDebounceRef.current) clearTimeout(globalDebounceRef.current)
    globalDebounceRef.current = setTimeout(() => void runGlobalSearch(), 280)
    return () => {
      if (globalDebounceRef.current) clearTimeout(globalDebounceRef.current)
    }
  }, [lookupMode, runGlobalSearch])

  const importItem = useCallback(async () => {
    setError(null)
    try {
      const msg = await onSmartImport()
      if (!msg) {
        setError('No PoE item on cursor — hover an item in-game and try again.')
        return
      }
      setContext('item')
      setLookupMode('base')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [onSmartImport])

  const toggleGroup = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const toggleTag = useCallback((tag: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }, [])

  const filteredOutcomes = useMemo(() => {
    if (!report) return []
    const rows = report.outcomes.filter((o) => {
      if (activeTags.size > 0) {
        const g = report.groups.find((gr) => gr.group === o.group && gr.kind === o.kind)
        if (!g?.tags?.some((t) => activeTags.has(t))) return false
      }
      return matchesSearch(search, o.text, o.tierName, o.group, o.kind === 'p' ? 'prefix' : 'suffix', poolLabel(o.pool))
    })
    rows.sort((a, b) => {
      switch (sort) {
        case 'weight':
          return (b.weight ?? 0) - (a.weight ?? 0)
        case 'ilvl':
          return (b.ilvl ?? 0) - (a.ilvl ?? 0)
        case 'name':
          return (a.text || a.group).localeCompare(b.text || b.group)
        default:
          return b.probability - a.probability
      }
    })
    return rows
  }, [report, search, sort, activeTags])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button disabled={busy} onClick={() => void importItem()}>
          Import hovered item
        </Button>
        {workingItem ? (
          <ItemChip
            name={`${workingItem.rarity} ${workingItem.name || workingItem.baseType}`}
            itemClass={workingItem.itemClass}
            title={`${workingItem.rarity} · iLvl ${workingItem.itemLevel}`}
          />
        ) : null}
        <input
          type="number"
          min={1}
          max={100}
          value={itemLevel}
          title="Item level"
          onChange={(e) => setItemLevel(Number(e.target.value) || 1)}
          style={{ ...inputStyle, width: 56, padding: '5px 8px' }}
        />
        <span style={{ fontSize: 11, opacity: 0.55 }}>iLvl</span>
      </div>

      {error ? <ErrorBanner message={error} tone="warn" inline /> : null}

      <div>
        <p style={{ margin: '0 0 6px', fontSize: 11, opacity: 0.6 }}>
          Choose base group <span style={{ color: '#e8a050' }}>REQUIRED</span>
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {BASE_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => void pickBaseGroup(g)}
              style={{
                ...selectStyle,
                padding: '5px 10px',
                fontSize: 11,
                background: itemClass === g ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.35)',
                fontWeight: itemClass === g ? 700 : 400,
                borderColor: itemClass === g ? 'rgba(255,255,255,0.25)' : selectStyle.border,
              }}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <label style={{ fontSize: 11, opacity: 0.7, display: 'block', marginBottom: 4 }}>Search for a base or item</label>
          <input
            type="search"
            value={baseQuery}
            placeholder={itemClass ? `e.g. ${itemClass === 'Gloves' ? 'Secured Wraps' : 'base name'}…` : 'Pick a base group first'}
            disabled={!itemClass}
            onChange={(e) => {
              setBaseQuery(e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setBaseType(baseQuery)
                setShowSuggestions(false)
              }
            }}
            style={inputStyle}
          />
          {showSuggestions && baseSuggestions.length ? (
            <ul
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                margin: '2px 0 0',
                padding: 0,
                listStyle: 'none',
                maxHeight: 160,
                overflow: 'auto',
                background: 'rgba(18,18,22,0.98)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 4,
                zIndex: 10,
              }}
            >
              {baseSuggestions.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setBaseQuery(name)
                      setBaseType(name)
                      setShowSuggestions(false)
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 10px',
                      border: 'none',
                      background: 'transparent',
                      color: 'inherit',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setLookupMode('base')}
            style={{ ...selectStyle, fontWeight: lookupMode === 'base' ? 700 : 400 }}
          >
            Weights
          </button>
          <button
            type="button"
            onClick={() => setLookupMode('global')}
            style={{ ...selectStyle, fontWeight: lookupMode === 'global' ? 700 : 400 }}
          >
            Global search
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="search"
          placeholder="Search for an affix…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 140 }}
        />
        {(['craft', 'marksman', 'desecrated', 'all'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPoolSource(p)}
            style={{
              ...selectStyle,
              fontSize: 10,
              padding: '4px 8px',
              background: poolSource === p ? 'rgba(255,255,255,0.12)' : selectStyle.background,
            }}
          >
            {p === 'all' ? 'All pools' : poolLabel(p)}
          </button>
        ))}
        {lookupMode === 'base' ? (
          <select value={view} onChange={(e) => setView(e.target.value as ViewMode)} style={{ ...selectStyle, fontSize: 10 }}>
            <option value="split">Split layout</option>
            <option value="flat">Flat tier list</option>
          </select>
        ) : null}
      </div>

      {lookupMode === 'base' && reportTags.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 72, overflow: 'auto' }}>
          {reportTags.map((tag) => {
            const on = activeTags.has(tag)
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                style={{
                  fontSize: 9,
                  padding: '2px 7px',
                  borderRadius: 2,
                  border: 'none',
                  cursor: 'pointer',
                  background: on ? tagColor(tag) : 'rgba(255,255,255,0.08)',
                  color: on ? '#111' : tagColor(tag),
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  opacity: on ? 1 : 0.85,
                }}
              >
                {tag}
              </button>
            )
          })}
          {activeTags.size > 0 ? (
            <button type="button" onClick={() => setActiveTags(new Set())} style={{ ...selectStyle, fontSize: 9, padding: '2px 6px' }}>
              Clear tags
            </button>
          ) : null}
        </div>
      ) : null}

      {lookupMode === 'global' && globalHits.length > 0 ? (
        <section style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{ margin: 0, fontSize: 11, opacity: 0.6 }}>
            {globalHits.length} hits · iLvl ≤ {itemLevel}
          </p>
          <div style={{ flex: 1, overflow: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4 }}>
            <GlobalSearchTable hits={globalHits} />
          </div>
        </section>
      ) : null}

      {lookupMode === 'base' && report ? (
        <section style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{ margin: 0, fontSize: 11, opacity: 0.65 }}>
            <strong>{report.baseType}</strong> · iLvl {report.itemLevel} · {report.modCount} tiers ·{' '}
            {report.totalWeight.toLocaleString()} total weight
          </p>
          {view === 'split' ? (
            <WeightTableLayout
              report={report}
              search={search}
              activeTags={activeTags}
              expanded={expanded}
              onToggle={toggleGroup}
              showPool={showPoolCol}
            />
          ) : (
            <div style={{ flex: 1, overflow: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ textAlign: 'left', opacity: 0.65, position: 'sticky', top: 0, background: 'rgba(20,20,24,0.95)' }}>
                    <th style={{ padding: '5px 6px' }}>Weight</th>
                    <th style={{ padding: '5px 6px' }}>Weight %</th>
                    <th style={{ padding: '5px 6px' }}>iLvl</th>
                    <th style={{ padding: '5px 6px' }}>Base</th>
                    <th style={{ padding: '5px 6px' }}>Mod</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOutcomes.map((o) => (
                    <tr key={`${o.id}-${o.text}`} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '5px 6px', fontWeight: 600 }}>{o.weight}</td>
                      <td style={{ padding: '5px 6px' }}>{pct(o.probability)}</td>
                      <td style={{ padding: '5px 6px' }}>{o.ilvl}</td>
                      <td style={{ padding: '5px 6px', opacity: 0.7 }}>{o.tierName}</td>
                      <td style={{ padding: '5px 6px' }}>{o.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : lookupMode === 'base' && !baseType ? (
        <p style={{ margin: 0, opacity: 0.7, fontSize: 13 }}>
          Select a base group above, then pick a specific base to browse per-base spawn weights.
        </p>
      ) : null}
    </div>
  )
}

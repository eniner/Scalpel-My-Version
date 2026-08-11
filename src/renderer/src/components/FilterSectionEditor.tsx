import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FilterAction, FilterSection, FilterSectionTier, HistoryEntry } from '@shared/types'
import { getItemClasses } from '@shared/data/items/item-classes'
import { isTownOrHideout } from '@shared/is-town-or-hideout'
import { HiddenLootLabel, LootLabel } from '@renderer/shared/LootLabel'
import { IconGlow } from '@renderer/shared/IconGlow'
import { iconMap, initIconMap, initPoeVersion, mergeIconCache } from '@renderer/shared/constants'
import { goldIcon } from '@renderer/shared/icons'
import { TierStyleEditor } from './TierStyleEditor'
import {
  ContinueBadge,
  EffectChips,
  loadHideOnMap,
  loadPinnedSections,
  loadSession,
  saveHideOnMap,
  savePinnedSections,
  saveSession,
  sectionTypePresetFor,
  sectionsFingerprint,
  useVirtualWindow,
} from './filter-section-editor-helpers'
import {
  ComparePanel,
  ConflictsPanel,
  EconomyBar,
  MoveToPicker,
  SectionLootSim,
  UndoHistoryPanel,
  applyBatchStyleFrom,
  duplicateTier,
  useSectionConflicts,
  useSectionPrices,
} from './FilterSectionEditorExtras'
import {
  BatchConditionPanel,
  ConditionSummaryChips,
  DiffRollbackPanel,
  EconomyNudgesPanel,
  LootFilmstripPanel,
  MatchDebuggerPanel,
  ModeSwitcher,
  PreflightPanel,
  ReapplyPanel,
  SectionChangesPanel,
  SectionTemplatesPanel,
  StrictnessDiffPanel,
  TierConditionInspector,
  type EditorWorkbenchMode,
} from './FilterSectionEditorAdvanced'
import { FilterSectionEditorGuide } from './FilterSectionEditorGuide'
import {
  ContinueChainPanel,
  EconomyPolicyPanel,
  EditPackPanel,
  FindConditionPanel,
  LootRegressionPanel,
  NamedCheckpointsPanel,
  SectionTypePresetPanel,
} from './FilterSectionEditorPower'
import {
  ActionToast,
  ComfortSettingsRow,
  KeyboardHelpOverlay,
  MoreToolsDisclosure,
  SectionStickyBar,
  WorkflowStrip,
  loadConfirmBulk,
  saveConfirmBulk,
  type EditorToast,
  type ToolToggleKey,
} from './FilterSectionEditorChrome'

const LOCAL_ICONS: Record<string, string> = { Gold: goldIcon }
const VIRT_THRESHOLD = 50
const VIRT_ROW_H = 34
const VIRT_VIEWPORT_H = 280

function resolveBaseIcon(name: string, iconKey?: string): string | null {
  return LOCAL_ICONS[name] ?? (iconKey ? iconMap[iconKey] : undefined) ?? iconMap[name] ?? null
}

function BaseIcon({ name, iconKey, size = 20 }: { name: string; iconKey?: string; size?: number }): JSX.Element {
  const url = resolveBaseIcon(name, iconKey)
  if (!url) {
    const letters = name.trim().slice(0, 2).toUpperCase() || '?'
    return (
      <span
        style={{
          width: size,
          height: size,
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 4,
          background: 'rgba(255,255,255,0.08)',
          color: '#6b6b7a',
          fontSize: Math.max(8, Math.round(size * 0.4)),
          fontWeight: 700,
          userSelect: 'none',
        }}
        aria-hidden
      >
        {letters}
      </span>
    )
  }
  return <IconGlow src={url} size={size} blur={8} saturate={2.2} opacity={0.35} />
}

function sortBasesByPrice(bases: string[], prices: Record<string, number | null>): string[] {
  return [...bases].sort((a, b) => {
    const pa = prices[a]
    const pb = prices[b]
    if (pa == null && pb == null) return 0
    if (pa == null) return 1
    if (pb == null) return -1
    return pb - pa
  })
}

interface Props {
  filterPath?: string | null
  /** `window` = large sister overlay (fills available height). */
  variant?: 'embedded' | 'window'
}

const DRAG_MIME = 'application/x-scalpel-basetype'
const DRAG_MIME_FALLBACK = 'text/plain'

interface DragItem {
  baseType: string
  fromBlockIndex: number
}

/** One or more BaseTypes being dragged between tiers. */
interface DragPayload {
  items: DragItem[]
}

interface SelectedItem {
  baseType: string
  fromBlockIndex: number
}

interface GlobalHit {
  baseType: string
  blockIndex: number
  tierLabel: string
  typePath: string
  sectionTitle: string
}

function parseDragPayload(raw: string): DragPayload | null {
  try {
    const parsed = JSON.parse(raw) as DragPayload | DragItem
    if (parsed && typeof parsed === 'object' && 'items' in parsed && Array.isArray(parsed.items)) {
      return { items: parsed.items.filter((i) => i?.baseType && i.fromBlockIndex != null) }
    }
    // Legacy single-item shape
    if (parsed && typeof parsed === 'object' && 'baseType' in parsed) {
      const one = parsed as DragItem
      if (one.baseType && one.fromBlockIndex != null) return { items: [one] }
    }
  } catch {
    /* ignore */
  }
  return null
}

function hasScalpelDrag(types: DOMStringList | readonly string[]): boolean {
  const list = Array.from(types as ArrayLike<string>)
  return list.includes(DRAG_MIME) || list.includes(DRAG_MIME_FALLBACK)
}

const STYLE_ACTION_TYPES = new Set([
  'SetTextColor',
  'SetBorderColor',
  'SetBackgroundColor',
  'SetFontSize',
  'PlayAlertSound',
  'CustomAlertSound',
  'PlayEffect',
  'MinimapIcon',
])

const GROUP_TITLES: Record<string, string> = {
  currency: 'Currency',
  gold: 'Gold',
  uniques: 'Uniques',
  gems: 'Gems',
  fragments: 'Fragments',
  waystones: 'Waystones',
  jewels: 'Jewels',
  exoticbases: 'Exotic bases',
  exoticmods: 'Exotic mods',
  artifact: 'Artifacts',
  relics: 'Relics',
  verisium: 'Verisium',
  chancing: 'Chancing',
  leveling: 'Leveling',
  rare: 'Rares',
  sockets: 'Sockets',
  maplike: 'Map-like',
  endgame: 'Endgame',
  special: 'Special',
  anyremaining: 'Any remaining',
  hidelayer: 'Hide layer',
  conditionalhide: 'Conditional hide',
  questlikeexception: 'Quest',
  miscmapitemsextra: 'Misc map',
  xenotiering: 'Xeno',
  legacytemp: 'Legacy',
  decorators: 'Decorators',
  rr: 'RR',
  ut: 'UT',
  __untagged__: 'Untagged',
}

function groupKeyOf(typePath: string): string {
  if (typePath === '__untagged__') return '__untagged__'
  return typePath.split('->')[0] ?? typePath
}

function groupTitleOf(key: string): string {
  if (GROUP_TITLES[key]) return GROUP_TITLES[key]
  return key.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function selKey(item: SelectedItem): string {
  return `${item.fromBlockIndex}\0${item.baseType}`
}

function firstVisibleTier(section: FilterSection): FilterSectionTier | null {
  return section.tiers.find((t) => t.visibility === 'Show') ?? section.tiers[0] ?? null
}

function buildCatalogNames(): string[] {
  const names = new Set<string>()
  for (const version of [1, 2] as const) {
    for (const { bases } of Object.values(getItemClasses(version))) {
      for (const b of bases) names.add(b.name)
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}

interface TypeaheadRow {
  name: string
  iconKey?: string
}

/** Compact typeahead for BaseType Add-rule flow (name + icon). */
function BaseTypeTypeahead({
  value,
  onChange,
  onPick,
  disabled,
}: {
  value: string
  onChange: (next: string) => void
  /** When set, catalog pick / Enter commits via onPick (bulk flow). */
  onPick?: (name: string) => void
  disabled?: boolean
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const [searchable, setSearchable] = useState<TypeaheadRow[]>([])
  const catalog = useMemo((): TypeaheadRow[] => buildCatalogNames().map((name) => ({ name })), [])
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void window.api.getSearchableItems().then((items) => {
      const byName = new Map<string, TypeaheadRow>()
      for (const i of items) {
        const name = i.baseType || i.name
        if (!name) continue
        const prev = byName.get(name)
        if (!prev || (!prev.iconKey && i.iconKey)) {
          byName.set(name, { name, iconKey: i.iconKey })
        }
      }
      setSearchable([...byName.values()].sort((a, b) => a.name.localeCompare(b.name)))
    })
  }, [])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (q.length < 1) return []
    const byName = new Map<string, TypeaheadRow>()
    for (const row of searchable.length > 0 ? [...searchable, ...catalog] : catalog) {
      if (!row.name.toLowerCase().includes(q)) continue
      const prev = byName.get(row.name)
      if (!prev || (!prev.iconKey && row.iconKey)) byName.set(row.name, row)
    }
    return [...byName.values()].slice(0, 40)
  }, [value, searchable, catalog])

  const commitPick = (name: string): void => {
    if (onPick) {
      onPick(name)
      onChange('')
      setOpen(true)
      return
    }
    onChange(name)
    setOpen(false)
  }

  const onCatalogDragStart = (e: React.DragEvent, name: string): void => {
    const payload: DragPayload = { items: [{ baseType: name, fromBlockIndex: -1 }] }
    const json = JSON.stringify(payload)
    e.dataTransfer.setData(DRAG_MIME, json)
    e.dataTransfer.setData(DRAG_MIME_FALLBACK, json)
    e.dataTransfer.effectAllowed = 'copyMove'
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <BaseIcon name={value || '?'} size={22} />
        <input
          type="text"
          value={value}
          disabled={disabled}
          aria-label="BaseType search"
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            const name = value.trim()
            if (!name) return
            const exact = suggestions.find((s) => s.name.toLowerCase() === name.toLowerCase())
            commitPick(exact?.name ?? name)
          }}
          placeholder="BaseType (type to search catalog…)"
          style={{
            flex: 1,
            minWidth: 0,
            boxSizing: 'border-box',
            background: '#12131a',
            color: '#f0e6d2',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 6,
            padding: '8px 10px',
            fontSize: 12,
          }}
        />
      </div>
      {open && suggestions.length > 0 && (
        <div
          role="listbox"
          aria-label="BaseType catalog suggestions"
          style={{
            position: 'absolute',
            zIndex: 40,
            left: 0,
            right: 0,
            top: '100%',
            marginTop: 2,
            maxHeight: 220,
            overflowY: 'auto',
            background: '#0a0b10',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 6,
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
          }}
        >
          {suggestions.map((row) => (
            <button
              key={row.name}
              type="button"
              role="option"
              aria-selected={row.name === value}
              draggable={!disabled}
              onDragStart={(e) => onCatalogDragStart(e, row.name)}
              onClick={() => commitPick(row.name)}
              title="Click to pick · drag onto a tier to add"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                textAlign: 'left',
                padding: '7px 10px',
                fontSize: 12,
                background: row.name === value ? 'rgba(201,162,39,0.2)' : 'transparent',
                color: '#f0e6d2',
                border: 'none',
                cursor: 'grab',
              }}
            >
              <BaseIcon name={row.name} iconKey={row.iconKey} size={22} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

async function reorderInBlock(blockIndex: number, orderedNames: string[]): Promise<{ ok: boolean; error?: string }> {
  const res = await window.api.getFilterBlock(blockIndex)
  if (!res.ok || !res.block) return { ok: false, error: res.error ?? 'Failed to load block' }
  let sawBase = false
  const conditions = res.block.conditions.map((c) => {
    if (c.type !== 'BaseType') return c
    if (!sawBase) {
      sawBase = true
      return { ...c, values: [...orderedNames] }
    }
    return { ...c, values: [] }
  })
  if (!sawBase) {
    conditions.push({ type: 'BaseType', values: [...orderedNames], operator: '==', explicitOperator: true })
  }
  return window.api.saveBlockEdit(blockIndex, { ...res.block, conditions }, '')
}

function TierBaseTypeRows({
  tier,
  tiers,
  tierIdx,
  busy,
  dragging,
  isWindow,
  selected,
  dropItemIndex,
  prices,
  sortByPrice,
  onDragStart,
  onDragEnd,
  onDragOverItem,
  onDropItem,
  onToggleSelect,
  onMoveBase,
}: {
  tier: FilterSectionTier
  tiers: FilterSectionTier[]
  tierIdx: number
  busy: boolean
  dragging: boolean
  isWindow: boolean
  selected: SelectedItem[]
  dropItemIndex: { blockIndex: number; index: number } | null
  prices: Record<string, number | null>
  sortByPrice: boolean
  onDragStart: (e: React.DragEvent, item: DragItem) => void
  onDragEnd: () => void
  onDragOverItem: (e: React.DragEvent, blockIndex: number, index: number) => void
  onDropItem: (e: React.DragEvent, tier: FilterSectionTier, beforeIndex: number) => void
  onToggleSelect: (item: SelectedItem, additive: boolean) => void
  onMoveBase: (baseType: string, fromBlockIndex: number, toBlockIndex: number) => void
}): JSX.Element {
  const [scrollTop, setScrollTop] = useState(0)
  const bases = sortByPrice ? sortBasesByPrice(tier.baseTypes, prices) : tier.baseTypes
  const useVirt = bases.length > VIRT_THRESHOLD
  const { start, end, totalHeight, offsetY } = useVirtualWindow(
    bases.length,
    VIRT_ROW_H,
    VIRT_VIEWPORT_H,
    useVirt ? scrollTop : 0,
  )
  const slice = useVirt ? bases.slice(start, end) : bases

  const renderRow = (base: string, itemIdx: number): JSX.Element => {
    const item = { baseType: base, fromBlockIndex: tier.blockIndex }
    const isSel = selected.some((s) => selKey(s) === selKey(item))
    const showInsert = dropItemIndex?.blockIndex === tier.blockIndex && dropItemIndex.index === itemIdx
    const price = prices[base]
    return (
      <div key={`${base}-${itemIdx}`}>
        {showInsert && (
          <div
            style={{
              height: 2,
              margin: '2px 0 4px',
              background: '#c9a227',
              borderRadius: 1,
              boxShadow: '0 0 6px rgba(201,162,39,0.6)',
            }}
          />
        )}
        <div
          role="option"
          aria-selected={isSel}
          tabIndex={0}
          draggable={!busy}
          onDragStart={(e) => onDragStart(e, item)}
          onDragEnd={onDragEnd}
          onDragOver={(e) => onDragOverItem(e, tier.blockIndex, itemIdx)}
          onDrop={(e) => onDropItem(e, tier, itemIdx)}
          onClick={(e) => {
            if (!isWindow) return
            onToggleSelect(item, e.ctrlKey || e.metaKey || e.shiftKey)
          }}
          onKeyDown={(e) => {
            if (!isWindow) return
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onToggleSelect(item, e.ctrlKey || e.metaKey || e.shiftKey)
            }
          }}
          title={
            isWindow
              ? 'Drag to reorder / move · click to select · Ctrl+click multi'
              : 'Drag to reorder or move to another tier'
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 6px',
            marginBottom: 4,
            height: useVirt ? VIRT_ROW_H - 4 : undefined,
            boxSizing: 'border-box',
            background: isSel ? 'rgba(201,162,39,0.22)' : 'rgba(0,0,0,0.35)',
            border: isSel ? '1px solid rgba(201,162,39,0.55)' : '1px solid transparent',
            borderRadius: 4,
            fontSize: 12,
            color: '#f0e6d2',
            cursor: busy ? 'default' : 'grab',
            opacity: dragging && isSel ? 0.55 : 1,
            outline: 'none',
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = '1px solid #c9a227'
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = 'none'
          }}
        >
          <span style={{ color: '#9a9aab', fontSize: 11, cursor: 'grab' }} aria-hidden>
            ⋮⋮
          </span>
          <BaseIcon name={base} size={20} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', userSelect: 'none' }}>
            {base}
            {price != null && (
              <span style={{ marginLeft: 6, color: '#9a9aab', fontSize: 11 }}>{price.toFixed(1)}c</span>
            )}
          </span>
          <button
            type="button"
            disabled={busy || tierIdx === 0}
            aria-label={`Move ${base} to higher tier`}
            onClick={(e) => {
              e.stopPropagation()
              onMoveBase(base, tier.blockIndex, tiers[tierIdx - 1]?.blockIndex ?? tier.blockIndex)
            }}
            style={{ padding: '2px 8px', fontSize: 11 }}
          >
            ↑
          </button>
          <button
            type="button"
            disabled={busy || tierIdx >= tiers.length - 1}
            aria-label={`Move ${base} to lower tier`}
            onClick={(e) => {
              e.stopPropagation()
              onMoveBase(base, tier.blockIndex, tiers[tierIdx + 1]?.blockIndex ?? tier.blockIndex)
            }}
            style={{ padding: '2px 8px', fontSize: 11 }}
          >
            ↓
          </button>
        </div>
      </div>
    )
  }

  const rows = slice.map((base, i) => renderRow(base, useVirt ? start + i : i))
  const tailInsert =
    dropItemIndex?.blockIndex === tier.blockIndex && dropItemIndex.index >= bases.length ? (
      <div style={{ height: 2, margin: '2px 0 4px', background: '#c9a227', borderRadius: 1 }} />
    ) : null

  if (!useVirt) {
    return (
      <>
        {rows}
        {tailInsert}
      </>
    )
  }

  return (
    <div
      style={{ maxHeight: VIRT_VIEWPORT_H, overflowY: 'auto' }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      role="listbox"
      aria-label={`${tier.label} base types`}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: offsetY, left: 0, right: 0 }}>{rows}</div>
      </div>
      {tailInsert}
    </div>
  )
}

/** FilterBlade-style section browser with style edit, DnD, and Add rule. */
export function FilterSectionEditor({ filterPath, variant = 'embedded' }: Props): JSX.Element {
  const isWindow = variant === 'window'
  const [sections, setSections] = useState<FilterSection[]>([])
  const [loadedPath, setLoadedPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /** Bumped after iconMap init/merge so icon lookups re-render. */
  const [, setIconsEpoch] = useState(0)
  const [poeVersion, setPoeVersion] = useState<1 | 2>(1)
  const [missingSounds, setMissingSounds] = useState<Set<string>>(new Set())
  const [missingSoundCount, setMissingSoundCount] = useState(0)
  const [baselineFingerprint, setBaselineFingerprint] = useState<string | null>(null)
  const [pinnedPaths, setPinnedPaths] = useState<string[]>(() => loadPinnedSections())
  const [hideOnMap, setHideOnMap] = useState(() => loadHideOnMap())
  const [bulkNames, setBulkNames] = useState<string[]>([])
  const globalFindRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const settings = await window.api.getSettings()
        const v = (settings.poeVersion === 2 ? 2 : 1) as 1 | 2
        initPoeVersion(v)
        initIconMap(v)
        mergeIconCache(await window.api.getIconCache())
        if (alive) {
          setPoeVersion(v)
          setIconsEpoch((n) => n + 1)
        }
      } catch {
        // icons stay empty; names still work
      }
    })()
    const unsub = window.api.onIconCacheUpdated((cache) => {
      mergeIconCache(cache)
      if (alive) setIconsEpoch((n) => n + 1)
    })
    return () => {
      alive = false
      unsub()
    }
  }, [])

  const [query, setQuery] = useState('')
  const [globalQuery, setGlobalQuery] = useState('')
  const [visFilter, setVisFilter] = useState<'all' | 'show' | 'hide'>('all')
  const [activeGroup, setActiveGroup] = useState('')
  const [activeType, setActiveType] = useState('')
  const [expandedTier, setExpandedTier] = useState<number | null>(null)
  const [styleBlock, setStyleBlock] = useState<{ index: number; label: string } | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)
  const [dropItemIndex, setDropItemIndex] = useState<{ blockIndex: number; index: number } | null>(null)
  const [dropSectionTypePath, setDropSectionTypePath] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const didDragRef = useRef(false)
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addTier, setAddTier] = useState('')
  const [addMode, setAddMode] = useState<'existing' | 'new'>('existing')
  const [addNewTierId, setAddNewTierId] = useState('custom')
  const [cloneFromBlock, setCloneFromBlock] = useState('')
  const [cloneConditions, setCloneConditions] = useState(true)
  const [selected, setSelected] = useState<SelectedItem[]>([])
  const [copyFrom, setCopyFrom] = useState('')
  const [pinned, setPinned] = useState(false)
  const [historyLen, setHistoryLen] = useState(0)
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
  const [filterDir, setFilterDir] = useState<string | null>(null)
  const [league, setLeague] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [showCompare, setShowCompare] = useState(false)
  const [showLootSim, setShowLootSim] = useState(false)
  const [showMatchDebug, setShowMatchDebug] = useState(false)
  const [showReapply, setShowReapply] = useState(false)
  const [showDiff, setShowDiff] = useState(false)
  const [showSectionChanges, setShowSectionChanges] = useState(false)
  const [showStrictness, setShowStrictness] = useState(false)
  const [showBatch, setShowBatch] = useState(false)
  const [showFilmstrip, setShowFilmstrip] = useState(false)
  const [showPreflight, setShowPreflight] = useState(false)
  const [showEconomyNudges, setShowEconomyNudges] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showRegression, setShowRegression] = useState(false)
  const [showEditPack, setShowEditPack] = useState(false)
  const [showEconomyPolicy, setShowEconomyPolicy] = useState(false)
  const [showContinueChain, setShowContinueChain] = useState(false)
  const [showFindCond, setShowFindCond] = useState(false)
  const [showCheckpoints, setShowCheckpoints] = useState(false)
  const [showSectionToolkit, setShowSectionToolkit] = useState(false)
  const [showMoreTools, setShowMoreTools] = useState(false)
  const [showKeys, setShowKeys] = useState(false)
  const [confirmBulk, setConfirmBulk] = useState(() => loadConfirmBulk())
  const [toast, setToast] = useState<EditorToast | null>(null)
  const toastIdRef = useRef(0)
  const [compareLeft, setCompareLeft] = useState('')
  const [compareRight, setCompareRight] = useState('')
  const [sortByPrice, setSortByPrice] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [workbenchMode, setWorkbenchMode] = useState<EditorWorkbenchMode>('edit')
  const canEdit = !isWindow || workbenchMode === 'edit' || workbenchMode === 'advanced'
  const canAdvanced = isWindow && workbenchMode === 'advanced'
  const showGuide = isWindow && workbenchMode === 'guide'

  const pushToast = useCallback((message: string, canUndo = true): void => {
    toastIdRef.current += 1
    setToast({ id: toastIdRef.current, message, canUndo })
    setStatus(message)
  }, [])

  const dismissToast = useCallback((): void => setToast(null), [])

  useEffect(() => {
    void window.api.getSettings().then((settings) => {
      setFilterDir(settings.activeProfile?.filterDir ?? null)
      setLeague(settings.activeProfile?.league ?? '')
    }).catch(() => {})
  }, [])

  const selectSection = (typePath: string): void => {
    setActiveType(typePath)
    setActiveGroup(groupKeyOf(typePath))
    setExpandedTier(null)
    setStyleBlock(null)
    setAddOpen(false)
    setSelected([])
    setCopyFrom('')
    // Smart defaults: when in Advanced, surface the section toolkit hint panel once
    if (isWindow && workbenchMode === 'advanced') {
      setShowSectionToolkit(true)
    }
  }

  const refreshHistory = useCallback(async (): Promise<void> => {
    try {
      const h = await window.api.getHistory()
      setHistoryLen(h.length)
      setHistoryEntries(h)
    } catch {
      setHistoryLen(0)
      setHistoryEntries([])
    }
  }, [])

  const refreshSounds = useCallback(async (secs: FilterSection[]): Promise<void> => {
    try {
      const settings = await window.api.getSettings()
      const dir = settings.activeProfile?.filterDir
      setFilterDir(dir ?? null)
      if (settings.activeProfile?.league) setLeague(settings.activeProfile.league)
      if (!dir) {
        setMissingSounds(new Set())
        setMissingSoundCount(0)
        return
      }
      const files = await window.api.scanSoundFiles(dir)
      const available = new Set(files.map((f) => f.replace(/^.*[\\/]/, '').toLowerCase()))
      const missing = new Set<string>()
      for (const s of secs) {
        for (const t of s.tiers) {
          const sound = t.effects?.sound
          if (!t.effects?.customSound || !sound) continue
          const base = sound.replace(/^.*[\\/]/, '').toLowerCase()
          if (!available.has(base) && !available.has(sound.toLowerCase())) {
            missing.add(sound)
          }
        }
      }
      setMissingSounds(missing)
      setMissingSoundCount(missing.size)
    } catch {
      setMissingSounds(new Set())
      setMissingSoundCount(0)
    }
  }, [])

  const refresh = useCallback(async (): Promise<void> => {
    if (!window.api.getFilterSections) return
    const result = await window.api.getFilterSections()
    if (!result.ok) {
      setError(result.error ?? 'No filter loaded')
      setSections([])
      setLoadedPath(null)
      return
    }
    setError(null)
    setSections(result.sections)
    setLoadedPath(result.path ?? null)
    setActiveType((prev) => {
      if (prev && result.sections.some((s) => s.typePath === prev)) return prev
      return result.sections[0]?.typePath ?? ''
    })
    setActiveGroup((prev) => {
      const first = result.sections[0]
      if (!first) return ''
      if (prev && result.sections.some((s) => groupKeyOf(s.typePath) === prev)) return prev
      return groupKeyOf(first.typePath)
    })
    const fp = sectionsFingerprint(result.sections)
    setBaselineFingerprint((prev) => (prev == null ? fp : prev))
    await refreshSounds(result.sections)
    await refreshHistory()
  }, [refreshHistory, refreshSounds])

  useEffect(() => {
    void refresh()
  }, [filterPath, refresh])

  useEffect(() => {
    savePinnedSections(pinnedPaths)
  }, [pinnedPaths])

  useEffect(() => {
    if (!isWindow) {
      setSessionReady(true)
      return
    }
    const s = loadSession()
    if (s.activeType) setActiveType(s.activeType)
    if (s.activeGroup) setActiveGroup(s.activeGroup)
    if (s.expandedTier !== undefined) setExpandedTier(s.expandedTier ?? null)
    if (s.query != null) setQuery(s.query)
    if (s.globalQuery != null) setGlobalQuery(s.globalQuery)
    if (s.visFilter) setVisFilter(s.visFilter)
    if (s.sortByPrice != null) setSortByPrice(s.sortByPrice)
    if (
      s.workbenchMode === 'browse' ||
      s.workbenchMode === 'edit' ||
      s.workbenchMode === 'advanced' ||
      s.workbenchMode === 'guide'
    ) {
      setWorkbenchMode(s.workbenchMode)
    }
    setSessionReady(true)
  }, [isWindow])

  useEffect(() => {
    if (!isWindow || !sessionReady) return
    const t = window.setTimeout(() => {
      saveSession({
        activeType,
        activeGroup,
        expandedTier,
        query,
        globalQuery,
        visFilter,
        sortByPrice,
        workbenchMode,
      })
    }, 350)
    return () => window.clearTimeout(t)
  }, [isWindow, sessionReady, activeType, activeGroup, expandedTier, query, globalQuery, visFilter, sortByPrice, workbenchMode])

  useEffect(() => {
    if (!isWindow) return
    const unsub = window.api.onZoneChanged((zone) => {
      if (!hideOnMap || !zone) return
      if (isTownOrHideout(zone.areaCode, poeVersion)) return
      void (async () => {
        try {
          await window.api.filterSectionEditor.setPinned(false)
          setPinned(false)
        } catch {
          /* ignore */
        }
        window.api.filterSectionEditor.requestClose()
      })()
    })
    return unsub
  }, [isWindow, hideOnMap, poeVersion])

  const groups = useMemo(() => {
    const map = new Map<string, FilterSection[]>()
    for (const s of sections) {
      const g = groupKeyOf(s.typePath)
      const list = map.get(g) ?? []
      list.push(s)
      map.set(g, list)
    }
    return [...map.entries()].map(([key, leaves]) => ({
      key,
      title: groupTitleOf(key),
      leaves,
      shownCount: leaves.reduce((n, s) => n + s.shownCount, 0),
      totalCount: leaves.reduce((n, s) => n + s.totalCount, 0),
    }))
  }, [sections])

  const active = useMemo(
    () => sections.find((s) => s.typePath === activeType) ?? sections[0] ?? null,
    [sections, activeType],
  )

  const conflicts = useSectionConflicts(sections)
  const { prices, loading: pricesLoading } = useSectionPrices(isWindow ? active : null, league)

  useEffect(() => {
    if (!showCompare || sections.length === 0) return
    setCompareLeft((prev) => prev || active?.typePath || sections[0]?.typePath || '')
    setCompareRight((prev) => {
      if (prev) return prev
      const other = sections.find((s) => s.typePath !== (active?.typePath ?? sections[0]?.typePath))
      return other?.typePath ?? sections[1]?.typePath ?? sections[0]?.typePath ?? ''
    })
  }, [showCompare, sections, active?.typePath])

  const groupLeaves = useMemo(() => {
    const g = activeGroup || (active ? groupKeyOf(active.typePath) : '')
    return groups.find((x) => x.key === g)?.leaves ?? []
  }, [groups, activeGroup, active])

  const otherSections = useMemo(
    () => sections.filter((s) => s.typePath !== (active?.typePath ?? '')),
    [sections, active],
  )

  const pinnedSections = useMemo(
    () => pinnedPaths.map((p) => sections.find((s) => s.typePath === p)).filter((s): s is FilterSection => !!s),
    [pinnedPaths, sections],
  )

  const dirty = baselineFingerprint != null && sectionsFingerprint(sections) !== baselineFingerprint

  useEffect(() => {
    if (!active) return
    const g = groupKeyOf(active.typePath)
    if (g !== activeGroup && groups.some((x) => x.key === g)) setActiveGroup(g)
  }, [active, activeGroup, groups])

  const tiers = useMemo(() => {
    if (!active) return []
    const q = query.trim().toLowerCase()
    return active.tiers.filter((t) => {
      if (visFilter === 'show' && t.visibility !== 'Show') return false
      if (visFilter === 'hide' && t.visibility !== 'Hide') return false
      if (!q) return true
      return (
        t.label.toLowerCase().includes(q) ||
        t.tier.toLowerCase().includes(q) ||
        t.baseTypes.some((b) => b.toLowerCase().includes(q))
      )
    })
  }, [active, query, visFilter])

  const globalHits = useMemo((): GlobalHit[] => {
    const q = globalQuery.trim().toLowerCase()
    if (!isWindow || q.length < 2) return []
    const hits: GlobalHit[] = []
    for (const s of sections) {
      for (const t of s.tiers) {
        for (const base of t.baseTypes) {
          if (!base.toLowerCase().includes(q)) continue
          hits.push({
            baseType: base,
            blockIndex: t.blockIndex,
            tierLabel: t.label,
            typePath: s.typePath,
            sectionTitle: s.title,
          })
          if (hits.length >= 60) return hits
        }
      }
    }
    return hits
  }, [globalQuery, sections, isWindow])

  useEffect(() => {
    if (!addTier && tiers[0]) setAddTier(String(tiers[0].blockIndex))
  }, [tiers, addTier])

  const toggleVisibility = async (tier: FilterSectionTier): Promise<void> => {
    const next = tier.visibility === 'Show' ? 'Hide' : 'Show'
    setBusy(true)
    setError(null)
    try {
      const result = await window.api.setSectionTierVisibility(tier.blockIndex, next)
      if (!result.ok) {
        setError(result.error ?? 'Failed to update visibility')
        return
      }
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const moveMany = async (items: DragItem[], toBlockIndex: number): Promise<void> => {
    const catalogAdds = items.filter((s) => s.fromBlockIndex === -1)
    const moves = items.filter((s) => s.fromBlockIndex !== -1)
    const byFrom = new Map<number, string[]>()
    for (const s of moves) {
      if (s.fromBlockIndex === toBlockIndex) continue
      const list = byFrom.get(s.fromBlockIndex) ?? []
      list.push(s.baseType)
      byFrom.set(s.fromBlockIndex, list)
    }
    if (catalogAdds.length === 0 && byFrom.size === 0) return

    // Conflict-aware: warn if earlier rules still win for the first moved item
    const sample = [...catalogAdds, ...moves].find((s) => s.fromBlockIndex !== toBlockIndex)
    if (sample && isWindow) {
      try {
        const preview = await window.api.previewBaseTypeMove(sample.baseType, toBlockIndex)
        if (preview.ok && preview.warning) {
          const ok = window.confirm(
            `${preview.warning}\n\nMove “${sample.baseType}”${items.length > 1 ? ` (+${items.length - 1} more)` : ''} anyway?`,
          )
          if (!ok) return
        }
      } catch {
        /* ignore preview failures */
      }
    }

    setBusy(true)
    setError(null)
    try {
      for (const item of catalogAdds) {
        const result = await window.api.addBaseTypeToTier(toBlockIndex, item.baseType)
        if (!result.ok) {
          setError(result.error ?? 'Failed to add item')
          return
        }
      }
      for (const [from, bases] of byFrom) {
        const result =
          bases.length === 1
            ? await window.api.moveItemTier(bases[0], from, toBlockIndex, '')
            : await window.api.batchMoveItemTier(bases, from, toBlockIndex, '')
        if (!result.ok) {
          setError(result.error ?? 'Failed to move item')
          return
        }
      }
      setSelected([])
      setExpandedTier(toBlockIndex)
      await refresh()
      pushToast(
        items.length === 1 ? `Moved ${items[0].baseType}` : `Moved ${items.length} items`,
        true,
      )
    } finally {
      setBusy(false)
    }
  }

  const moveBase = async (baseType: string, fromBlockIndex: number, toBlockIndex: number): Promise<void> => {
    await moveMany([{ baseType, fromBlockIndex }], toBlockIndex)
  }

  const bumpSelectedTo = async (toBlockIndex: number): Promise<void> => {
    if (selected.length === 0) return
    await moveMany(selected, toBlockIndex)
  }

  const bumpSelectedAdjacent = async (dir: -1 | 1): Promise<void> => {
    if (!active || selected.length === 0) return
    const fromBlock = selected[0].fromBlockIndex
    const idx = active.tiers.findIndex((t) => t.blockIndex === fromBlock)
    if (idx < 0) return
    const target = active.tiers[idx + dir]
    if (!target) return
    await moveMany(selected, target.blockIndex)
  }

  const removeSelected = async (): Promise<void> => {
    if (selected.length === 0) return
    const byBlock = new Map<number, Set<string>>()
    for (const item of selected) {
      const set = byBlock.get(item.fromBlockIndex) ?? new Set<string>()
      set.add(item.baseType)
      byBlock.set(item.fromBlockIndex, set)
    }
    const emptying: Array<{ blockIndex: number; label: string }> = []
    for (const [blockIndex, bases] of byBlock) {
      const tier = sections.flatMap((s) => s.tiers).find((t) => t.blockIndex === blockIndex)
      if (!tier || tier.baseTypes.length === 0) continue
      const remaining = tier.baseTypes.filter((b) => !bases.has(b))
      if (remaining.length === 0) emptying.push({ blockIndex, label: tier.label })
    }
    if (emptying.length > 0) {
      const labels = emptying.map((t) => t.label).join(', ')
      if (!window.confirm(`Remove last item from tier ${labels}? Optionally delete empty tier.`)) return
    }
    setBusy(true)
    setError(null)
    try {
      for (const item of selected) {
        const result = await window.api.removeBaseTypeFromTier(item.fromBlockIndex, item.baseType)
        if (!result.ok) {
          setError(result.error ?? 'Failed to remove item')
          return
        }
      }
      setSelected([])
      for (const t of emptying) {
        let empty = true
        try {
          const block = await window.api.getFilterBlock(t.blockIndex)
          if (block.ok && block.block) {
            const bases = block.block.conditions
              .filter((c) => c.type === 'BaseType')
              .flatMap((c) => c.values)
            empty = bases.length === 0
          }
        } catch {
          empty = true
        }
        if (empty && window.confirm('Delete empty tier block?')) {
          const del = await window.api.deleteFilterBlock(t.blockIndex)
          if (!del.ok) {
            setError(del.error ?? 'Failed to delete empty tier')
            return
          }
        }
      }
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const reorderWithinTier = async (
    blockIndex: number,
    currentBases: string[],
    moving: DragItem[],
    beforeIndex: number,
  ): Promise<void> => {
    const movingNames = moving.map((m) => m.baseType)
    const movingSet = new Set(movingNames)
    const without = currentBases.filter((b) => !movingSet.has(b))
    let dest = 0
    for (let i = 0; i < beforeIndex && i < currentBases.length; i++) {
      if (!movingSet.has(currentBases[i])) dest++
    }
    if (beforeIndex >= currentBases.length) dest = without.length
    const finalOrder = [...without.slice(0, dest), ...movingNames, ...without.slice(dest)]
    if (finalOrder.join('\0') === currentBases.join('\0')) return
    setBusy(true)
    setError(null)
    try {
      const result = await reorderInBlock(blockIndex, finalOrder)
      if (!result.ok) {
        setError(result.error ?? 'Failed to reorder')
        return
      }
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const copyStyleToTier = async (toBlockIndex: number): Promise<void> => {
    const fromIndex = Number(copyFrom)
    if (!Number.isFinite(fromIndex) || fromIndex === toBlockIndex) return
    setBusy(true)
    setError(null)
    try {
      const fromRes = await window.api.getFilterBlock(fromIndex)
      const toRes = await window.api.getFilterBlock(toBlockIndex)
      if (!fromRes.ok || !fromRes.block || !toRes.ok || !toRes.block) {
        setError(fromRes.error ?? toRes.error ?? 'Failed to load blocks')
        return
      }
      const styleActions: FilterAction[] = fromRes.block.actions
        .filter((a) => STYLE_ACTION_TYPES.has(a.type))
        .map((a) => ({ type: a.type, values: [...a.values] }))
      const kept = toRes.block.actions.filter((a) => !STYLE_ACTION_TYPES.has(a.type))
      const result = await window.api.saveBlockEdit(toBlockIndex, { ...toRes.block, actions: [...kept, ...styleActions] }, '')
      if (!result.ok) {
        setError(result.error ?? 'Failed to copy style')
        return
      }
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const applyStyleToSection = async (): Promise<void> => {
    const fromIndex = Number(copyFrom)
    if (!active || !Number.isFinite(fromIndex)) return
    setBusy(true)
    setError(null)
    try {
      const result = await applyBatchStyleFrom(
        fromIndex,
        active.tiers.map((t) => t.blockIndex),
      )
      if (!result.ok) {
        setError(result.error ?? 'Failed to apply style')
        return
      }
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const quickSetVisibility = async (mode: 'hide-le-c' | 'show-sa'): Promise<void> => {
    if (!active) return
    const label = mode === 'hide-le-c' ? 'Hide ≤C tiers' : 'Show only S–A'
    if (confirmBulk && !window.confirm(`${label} in ${active.title}?`)) return
    setBusy(true)
    setError(null)
    try {
      for (const tier of active.tiers) {
        const letter = tier.tier.toLowerCase()
        const next: 'Show' | 'Hide' =
          mode === 'show-sa'
            ? letter === 's' || letter === 'a'
              ? 'Show'
              : 'Hide'
            : letter === 's' || letter === 'a' || letter === 'b'
              ? 'Show'
              : 'Hide'
        if (tier.visibility === next) continue
        const result = await window.api.setSectionTierVisibility(tier.blockIndex, next)
        if (!result.ok) {
          setError(result.error ?? 'Failed to update visibility')
          return
        }
      }
      await refresh()
      pushToast(`${label} applied — Undo to reverse`, true)
    } finally {
      setBusy(false)
    }
  }

  const duplicateTierNow = async (tier: FilterSectionTier): Promise<void> => {
    if (!active) return
    const suggested = `${tier.tier}-copy`
    const newId = window.prompt('New tier id', suggested)
    if (newId == null || !newId.trim()) return
    const tierId = newId.trim()
    setBusy(true)
    setError(null)
    try {
      const result = await duplicateTier(tier, active.typePath, tierId)
      if (!result.ok) {
        setError(result.error ?? 'Failed to duplicate tier')
        return
      }
      await refresh()
      if (tier.baseTypes.length > 1) {
        const secs = await window.api.getFilterSections()
        const updated = secs.ok
          ? secs.sections.find((s) => s.typePath === active.typePath)
          : undefined
        const newTier = updated?.tiers.find(
          (t) => t.tier === tierId && t.baseTypes.includes(tier.baseTypes[0]),
        )
        if (newTier) {
          for (const extra of tier.baseTypes.slice(1)) {
            const r = await window.api.addBaseTypeToTier(newTier.blockIndex, extra)
            if (!r.ok) {
              setError(r.error ?? 'Failed to add item to duplicated tier')
              return
            }
          }
          setExpandedTier(newTier.blockIndex)
          await refresh()
        }
      }
    } finally {
      setBusy(false)
    }
  }

  const restoreHistoryEntry = async (entryId: number): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const result = await window.api.undoToEntry(entryId)
      if (!result.ok) {
        setError(result.error ?? 'Failed to restore history entry')
        return
      }
      setSelected([])
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const undoLast = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const result = await window.api.undoEdit('')
      if (!result.ok) {
        setError(result.error ?? 'Nothing to undo')
        return
      }
      setSelected([])
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const undoSection = async (typePath: string): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const result = await window.api.undoSectionHistory(typePath)
      if (!result.ok) {
        setError(result.error ?? 'No section-scoped history')
        return
      }
      pushToast(`Undid ${result.undone} section edit(s)`, false)
      setSelected([])
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const reorderTier = async (tier: FilterSectionTier, dir: -1 | 1): Promise<void> => {
    if (!active) return
    const ordered = [...active.tiers].sort((a, b) => a.blockIndex - b.blockIndex)
    const idx = ordered.findIndex((t) => t.blockIndex === tier.blockIndex)
    if (idx < 0) return
    const swapWith = ordered[idx + dir]
    if (!swapWith) return
    setBusy(true)
    setError(null)
    try {
      const result = await window.api.moveFilterBlock(tier.blockIndex, swapWith.blockIndex)
      if (!result.ok) {
        setError(result.error ?? 'Reorder failed')
        return
      }
      await refresh()
      pushToast(`Moved ${tier.label} ${dir < 0 ? 'earlier' : 'later'} in file order`, true)
    } finally {
      setBusy(false)
    }
  }

  const openSuggestedTools = (tools: string[]): void => {
    setWorkbenchMode('advanced')
    for (const t of tools) {
      if (t === 'nudges') setShowEconomyNudges(true)
      if (t === 'batch') setShowBatch(true)
      if (t === 'strictness') setShowStrictness(true)
      if (t === 'economy') setShowEconomyPolicy(true)
      if (t === 'match') setShowMatchDebug(true)
      if (t === 'filmstrip') setShowFilmstrip(true)
      if (t === 'find') setShowFindCond(true)
      if (t === 'preflight') setShowPreflight(true)
      if (t === 'style' && active?.tiers[0]) {
        setStyleBlock({ index: active.tiers[0].blockIndex, label: active.tiers[0].label })
      }
    }
  }

  const toggleTool = (key: ToolToggleKey): void => {
    const map: Record<ToolToggleKey, () => void> = {
      match: () => setShowMatchDebug((v) => !v),
      reapply: () => setShowReapply((v) => !v),
      strictness: () => setShowStrictness((v) => !v),
      batch: () => setShowBatch((v) => !v),
      filmstrip: () => setShowFilmstrip((v) => !v),
      preflight: () => setShowPreflight((v) => !v),
      nudges: () => setShowEconomyNudges((v) => !v),
      templates: () => setShowTemplates((v) => !v),
      suite: () => setShowRegression((v) => !v),
      editPack: () => setShowEditPack((v) => !v),
      policy: () => setShowEconomyPolicy((v) => !v),
      continue: () => setShowContinueChain((v) => !v),
      find: () => setShowFindCond((v) => !v),
      checkpoints: () => setShowCheckpoints((v) => !v),
      changes: () => setShowSectionChanges((v) => !v),
      diff: () => setShowDiff((v) => !v),
      compare: () => setShowCompare((v) => !v),
      history: () => setShowHistory((v) => !v),
      lootSim: () => setShowLootSim((v) => !v),
    }
    map[key]()
  }

  const runWorkflowDiagnose = (): void => {
    setWorkbenchMode('advanced')
    setShowMatchDebug(true)
    setShowFilmstrip(true)
    setShowStrictness(false)
    setShowEconomyPolicy(false)
    setShowRegression(false)
    setShowPreflight(false)
  }

  const runWorkflowFix = (): void => {
    setWorkbenchMode('advanced')
    setShowStrictness(true)
    setShowEconomyPolicy(true)
    setShowBatch(true)
    setShowMatchDebug(false)
    setShowFilmstrip(false)
    setShowRegression(false)
    setShowPreflight(false)
  }

  const runWorkflowVerify = (): void => {
    setWorkbenchMode('advanced')
    setShowRegression(true)
    setShowPreflight(true)
    setShowMatchDebug(false)
    setShowFilmstrip(false)
    setShowStrictness(false)
    setShowEconomyPolicy(false)
  }

  const cycleSelectedVisibility = async (): Promise<void> => {
    if (!active || selected.length === 0) return
    const blocks = [...new Set(selected.map((s) => s.fromBlockIndex))]
    setBusy(true)
    try {
      for (const blockIndex of blocks) {
        const tier = active.tiers.find((t) => t.blockIndex === blockIndex)
        if (!tier) continue
        const next = tier.visibility === 'Show' ? 'Hide' : 'Show'
        await window.api.setSectionTierVisibility(blockIndex, next)
      }
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const createCheckpointNow = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const result = await window.api.createCheckpoint(`Sections ${new Date().toLocaleString()}`)
      if (!result.ok) {
        setError(result.error ?? 'Failed to create checkpoint')
        return
      }
      pushToast('Checkpoint saved', false)
      await refreshHistory()
    } finally {
      setBusy(false)
    }
  }

  const togglePin = async (): Promise<void> => {
    const next = !pinned
    try {
      const result = await window.api.filterSectionEditor.setPinned(next)
      if (result.ok) setPinned(result.pinned)
    } catch {
      setError('Failed to toggle pin')
    }
  }

  const toggleSectionPin = (typePath: string): void => {
    setPinnedPaths((prev) => (prev.includes(typePath) ? prev.filter((p) => p !== typePath) : [...prev, typePath]))
  }

  const jumpToHit = (hit: GlobalHit): void => {
    selectSection(hit.typePath)
    setExpandedTier(hit.blockIndex)
    setGlobalQuery('')
    setQuery(hit.baseType)
  }

  const jumpToBlock = (blockIndex: number): void => {
    for (const s of sections) {
      const tier = s.tiers.find((t) => t.blockIndex === blockIndex)
      if (tier) {
        selectSection(s.typePath)
        setExpandedTier(blockIndex)
        setWorkbenchMode('edit')
        return
      }
    }
  }

  const dropOntoSection = async (typePath: string, e: React.DragEvent): Promise<void> => {
    e.preventDefault()
    e.stopPropagation()
    setDropSectionTypePath(null)
    setDropTarget(null)
    setDropItemIndex(null)
    setDragging(false)
    const raw = e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData(DRAG_MIME_FALLBACK)
    if (!raw) return
    const payload = parseDragPayload(raw)
    if (!payload || payload.items.length === 0) {
      setError('Invalid drag payload')
      return
    }
    const section = sections.find((s) => s.typePath === typePath)
    const tier = section ? firstVisibleTier(section) : null
    if (!tier) {
      setError('Section has no tiers')
      return
    }
    selectSection(typePath)
    await moveMany(payload.items, tier.blockIndex)
  }

  const onDragStart = (e: React.DragEvent, item: DragItem): void => {
    didDragRef.current = true
    const key = selKey(item)
    const moving =
      selected.some((s) => selKey(s) === key) && selected.length > 1 ? selected : [item]
    const payload: DragPayload = { items: moving }
    const json = JSON.stringify(payload)
    e.dataTransfer.setData(DRAG_MIME, json)
    e.dataTransfer.setData(DRAG_MIME_FALLBACK, json)
    e.dataTransfer.effectAllowed = 'move'
    setDragging(true)

    const ghost = document.createElement('div')
    ghost.style.cssText =
      'display:flex;align-items:center;gap:8px;padding:6px 10px;background:#171821;border:1px solid #c9a227;border-radius:6px;color:#f0e6d2;font:12px sans-serif;position:fixed;top:-1000px;left:-1000px;pointer-events:none;z-index:99999'
    const iconUrl = resolveBaseIcon(item.baseType)
    if (iconUrl) {
      const img = document.createElement('img')
      img.src = iconUrl
      img.width = 20
      img.height = 20
      img.style.objectFit = 'contain'
      ghost.appendChild(img)
    }
    const label = document.createElement('span')
    label.textContent =
      moving.length > 1 ? `${item.baseType} +${moving.length - 1}` : item.baseType
    ghost.appendChild(label)
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 12, 12)
    requestAnimationFrame(() => ghost.remove())
  }

  const onDragEnd = (): void => {
    setDragging(false)
    setDropTarget(null)
    setDropItemIndex(null)
    setDropSectionTypePath(null)
    // Keep didDragRef true until click so the trailing click doesn't toggle select.
    requestAnimationFrame(() => {
      didDragRef.current = false
    })
  }

  const onDragOverTier = (e: React.DragEvent, blockIndex: number): void => {
    if (!dragging && !hasScalpelDrag(e.dataTransfer.types)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(blockIndex)
    setDropItemIndex(null)
  }

  const onDragEnterTier = (e: React.DragEvent, blockIndex: number): void => {
    if (!dragging && !hasScalpelDrag(e.dataTransfer.types)) return
    e.preventDefault()
    setDropTarget(blockIndex)
  }

  const onDragLeaveTier = (e: React.DragEvent, blockIndex: number): void => {
    const related = e.relatedTarget as Node | null
    if (related && e.currentTarget.contains(related)) return
    setDropTarget((t) => (t === blockIndex ? null : t))
  }

  const onDropTier = async (e: React.DragEvent, toBlockIndex: number): Promise<void> => {
    e.preventDefault()
    e.stopPropagation()
    setDropTarget(null)
    setDropItemIndex(null)
    setDragging(false)
    const raw = e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData(DRAG_MIME_FALLBACK)
    if (!raw) return
    const payload = parseDragPayload(raw)
    if (!payload || payload.items.length === 0) {
      setError('Invalid drag payload')
      return
    }
    await moveMany(payload.items, toBlockIndex)
  }

  const onDragOverItem = (e: React.DragEvent, blockIndex: number, index: number): void => {
    if (!dragging && !hasScalpelDrag(e.dataTransfer.types)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(blockIndex)
    setDropItemIndex({ blockIndex, index })
  }

  const onDropItem = async (
    e: React.DragEvent,
    tier: FilterSectionTier,
    beforeIndex: number,
  ): Promise<void> => {
    e.preventDefault()
    e.stopPropagation()
    setDropTarget(null)
    setDropItemIndex(null)
    setDragging(false)
    const raw = e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData(DRAG_MIME_FALLBACK)
    if (!raw) return
    const payload = parseDragPayload(raw)
    if (!payload || payload.items.length === 0) {
      setError('Invalid drag payload')
      return
    }
    const sameBlock = payload.items.every((i) => i.fromBlockIndex === tier.blockIndex)
    const hasCatalog = payload.items.some((i) => i.fromBlockIndex === -1)
    if (sameBlock && !hasCatalog) {
      const currentBases =
        isWindow && sortByPrice ? sortBasesByPrice(tier.baseTypes, prices) : tier.baseTypes
      await reorderWithinTier(tier.blockIndex, currentBases, payload.items, beforeIndex)
      return
    }
    await moveMany(payload.items, tier.blockIndex)
  }

  const toggleSelect = (item: SelectedItem, additive: boolean): void => {
    if (didDragRef.current) return
    setSelected((prev) => {
      const key = selKey(item)
      const exists = prev.some((p) => selKey(p) === key)
      if (additive) {
        return exists ? prev.filter((p) => selKey(p) !== key) : [...prev, item]
      }
      return exists && prev.length === 1 ? [] : [item]
    })
  }

  const addBulkName = (name: string): void => {
    const n = name.trim()
    if (!n) return
    setBulkNames((prev) => (prev.includes(n) ? prev : [...prev, n]))
  }

  const submitAddRule = async (): Promise<void> => {
    if (!active) return
    const names =
      isWindow && addMode === 'existing'
        ? [...bulkNames, ...(addName.trim() && !bulkNames.includes(addName.trim()) ? [addName.trim()] : [])]
        : addName.trim()
          ? [addName.trim()]
          : []
    if (names.length === 0) {
      setError('Enter a BaseType name')
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (addMode === 'existing') {
        const blockIndex = Number(addTier)
        for (const name of names) {
          const result = await window.api.addBaseTypeToTier(blockIndex, name)
          if (!result.ok) {
            setError(result.error ?? 'Failed to add item')
            return
          }
        }
        setExpandedTier(blockIndex)
      } else {
        if (active.typePath === '__untagged__') {
          setError('Create a NeverSink-tagged section first — untagged cannot insert $type rules')
          return
        }
        const before = active.tiers[0]?.blockIndex
        if (before == null) {
          setError('Section has no tiers to insert before')
          return
        }
        const name = names[0]
        const cloneIdx = cloneFromBlock ? Number(cloneFromBlock) : before
        const result = await window.api.insertSectionRule({
          typePath: active.typePath,
          tier: addNewTierId.trim() || 'custom',
          baseType: name,
          beforeBlockIndex: before,
          visibility: 'Show',
          copyStyleFromIndex: Number.isFinite(cloneIdx) ? cloneIdx : before,
          cloneConditions,
        })
        if (!result.ok) {
          setError(result.error ?? 'Failed to add rule')
          return
        }
        // Extra bulk names go into the new rule's block after refresh — insert only takes one;
        // remaining names: add to the newly created first matching tier after refresh is hard,
        // so add them sequentially to existing first tier if insert only supports one name.
        if (names.length > 1) {
          await refresh()
          const updated = (await window.api.getFilterSections()).sections.find((s) => s.typePath === active.typePath)
          const newTier = updated?.tiers.find((t) => t.tier === (addNewTierId.trim() || 'custom') && t.baseTypes.includes(name))
          const target = newTier?.blockIndex ?? before
          for (const extra of names.slice(1)) {
            const r = await window.api.addBaseTypeToTier(target, extra)
            if (!r.ok) {
              setError(r.error ?? 'Failed to add item')
              return
            }
          }
        }
      }
      setAddName('')
      setBulkNames([])
      setAddOpen(false)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!isWindow) return
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'Escape') {
        e.preventDefault()
        void (async () => {
          try {
            await window.api.filterSectionEditor.setPinned(false)
            setPinned(false)
          } catch {
            /* ignore */
          }
          window.api.filterSectionEditor.requestClose()
        })()
        return
      }

      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        globalFindRef.current?.focus()
        return
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        void undoLast()
        return
      }

      if (e.key === 'ArrowUp') {
        if (!canEdit) return
        e.preventDefault()
        void bumpSelectedAdjacent(-1)
        return
      }
      if (e.key === 'ArrowDown') {
        if (!canEdit) return
        e.preventDefault()
        void bumpSelectedAdjacent(1)
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!canEdit || selected.length === 0) return
        e.preventDefault()
        void removeSelected()
        return
      }

      // Power keys (Advanced / Edit)
      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault()
        if (!active) return
        const idx = sections.findIndex((s) => s.typePath === active.typePath)
        const next = sections[Math.min(sections.length - 1, idx + 1)]
        if (next) selectSection(next.typePath)
        return
      }
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        if (!active) return
        const idx = sections.findIndex((s) => s.typePath === active.typePath)
        const prev = sections[Math.max(0, idx - 1)]
        if (prev) selectSection(prev.typePath)
        return
      }
      if (e.key === 'a' || e.key === 'A') {
        if (!canEdit || !active) return
        e.preventDefault()
        setAddOpen(true)
        return
      }
      if (e.key === 'm' || e.key === 'M') {
        if (!isWindow) return
        e.preventDefault()
        setWorkbenchMode('advanced')
        setShowMatchDebug(true)
        return
      }
      if (e.key === 's' || e.key === 'S') {
        if (!canEdit || selected.length === 0) return
        e.preventDefault()
        void cycleSelectedVisibility()
        return
      }
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault()
        setShowKeys(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: handlers use latest selected/active via closure refresh
  }, [isWindow, selected, active, busy, historyLen, workbenchMode, sections])

  if (!filterPath) {
    return (
      <p style={{ margin: 0, fontSize: 12, color: '#9a9aab' }}>
        Select a local filter (e.g. 9lives-local) to edit sections.
      </p>
    )
  }

  const currentGroupKey = activeGroup || (active ? groupKeyOf(active.typePath) : '')

  return (
    <div
      style={{
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 8,
        background: '#12131a',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        ...(isWindow ? { flex: 1, minHeight: 0, height: '100%' } : {}),
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f0e6d2' }}>
            {isWindow ? 'Sections' : 'Section editor'}
          </div>
          {isWindow && <ModeSwitcher mode={workbenchMode} onChange={setWorkbenchMode} />}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {isWindow && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void togglePin()}
              title="Keep this window open when PoE loses focus"
              style={{
                fontSize: 11,
                background: pinned ? 'rgba(201,162,39,0.35)' : undefined,
                borderColor: pinned ? '#c9a227' : undefined,
              }}
            >
              {pinned ? 'Pinned' : 'Pin window'}
            </button>
          )}
          {isWindow && (
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                color: '#c8c4bc',
                cursor: 'pointer',
                userSelect: 'none',
              }}
              title="Auto-close when entering a map (not town/hideout)"
            >
              <input
                type="checkbox"
                checked={hideOnMap}
                onChange={(e) => {
                  const on = e.target.checked
                  setHideOnMap(on)
                  saveHideOnMap(on)
                }}
              />
              Hide on map
            </label>
          )}
          <button
            type="button"
            disabled={busy || historyLen === 0}
            onClick={() => void undoLast()}
            aria-label="Undo last filter edit"
            style={{ fontSize: 11 }}
          >
            Undo{historyLen > 0 ? ` (${historyLen})` : ''}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void createCheckpointNow()}
            aria-label="Create filter checkpoint"
            style={{ fontSize: 11 }}
          >
            Checkpoint
          </button>
          <button type="button" disabled={busy} onClick={() => void refresh()} aria-label="Refresh sections" style={{ fontSize: 11 }}>
            Refresh
          </button>
          {dirty && (
            <>
              <span
                title="Filter content differs from when this editor opened (edits already saved to disk)"
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: 'rgba(201,162,39,0.22)',
                  border: '1px solid rgba(201,162,39,0.55)',
                  color: '#e8d48b',
                }}
              >
                Changed since open
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => setBaselineFingerprint(sectionsFingerprint(sections))}
                style={{ fontSize: 11 }}
              >
                Mark clean
              </button>
            </>
          )}
          {missingSoundCount > 0 && (
            <span
              title={[...missingSounds].join(', ')}
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 4,
                background: 'rgba(248,113,113,0.2)',
                border: '1px solid rgba(248,113,113,0.5)',
                color: '#fca5a5',
              }}
            >
              {missingSoundCount} missing sound{missingSoundCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      {loadedPath && (
        <div style={{ fontSize: 11, color: '#9a9aab' }}>Editing: {loadedPath.replace(/^.*[\\/]/, '')}</div>
      )}

      {error && <div style={{ fontSize: 12, color: '#f87171' }} role="alert">{error}</div>}
      <ActionToast
        toast={toast}
        busy={busy}
        onUndo={() => {
          dismissToast()
          void undoLast()
        }}
        onDismiss={dismissToast}
      />
      {status && !error && !toast && <div style={{ fontSize: 12, color: '#9a9aab' }}>{status}</div>}

      <KeyboardHelpOverlay open={showKeys} onClose={() => setShowKeys(false)} />

      {styleBlock && (
        <TierStyleEditor
          blockIndex={styleBlock.index}
          tierLabel={styleBlock.label}
          onClose={() => setStyleBlock(null)}
          onSaved={() => void refresh()}
        />
      )}

      {showGuide ? (
        <FilterSectionEditorGuide
          onGoEdit={() => setWorkbenchMode('edit')}
          onGoAdvanced={() => setWorkbenchMode('advanced')}
        />
      ) : sections.length === 0 && !error ? (
        <div style={{ fontSize: 12, color: '#9a9aab' }}>No NeverSink-tagged sections in this filter.</div>
      ) : (
        <>
          {/* Sticky working set */}
          {pinnedSections.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#9a9aab', marginRight: 2 }}>Pinned</span>
              {pinnedSections.map((s) => {
                const on = s.typePath === active?.typePath
                const dropHl = dropSectionTypePath === s.typePath
                return (
                  <button
                    key={s.typePath}
                    type="button"
                    onClick={() => selectSection(s.typePath)}
                    onDragOver={(e) => {
                      if (!dragging && !hasScalpelDrag(e.dataTransfer.types)) return
                      e.preventDefault()
                      setDropSectionTypePath(s.typePath)
                    }}
                    onDragLeave={() => setDropSectionTypePath((p) => (p === s.typePath ? null : p))}
                    onDrop={(e) => void dropOntoSection(s.typePath, e)}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '4px 9px',
                      borderRadius: 6,
                      border: dropHl
                        ? '1px solid #c9a227'
                        : on
                          ? '1px solid #c9a227'
                          : '1px solid rgba(255,255,255,0.14)',
                      background: dropHl
                        ? 'rgba(201,162,39,0.35)'
                        : on
                          ? 'rgba(201,162,39,0.25)'
                          : 'rgba(255,255,255,0.04)',
                      color: '#f0e6d2',
                      cursor: 'pointer',
                    }}
                  >
                    ★ {s.title}
                  </button>
                )
              })}
            </div>
          )}

          {/* Cross-section drop strip */}
          {isWindow && canEdit && dragging && otherSections.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
                padding: 8,
                borderRadius: 6,
                border: '1px dashed rgba(201,162,39,0.55)',
                background: 'rgba(201,162,39,0.08)',
              }}
            >
              <span style={{ fontSize: 10, color: '#9a9aab', width: '100%' }}>Drop onto another section</span>
              {otherSections.map((s) => {
                const first = firstVisibleTier(s)
                const hl = dropSectionTypePath === s.typePath
                return (
                  <button
                    key={s.typePath}
                    type="button"
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      setDropSectionTypePath(s.typePath)
                    }}
                    onDragLeave={() => setDropSectionTypePath((p) => (p === s.typePath ? null : p))}
                    onDrop={(e) => void dropOntoSection(s.typePath, e)}
                    style={{
                      fontSize: 11,
                      textAlign: 'left',
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: hl ? '1px solid #c9a227' : '1px solid rgba(255,255,255,0.14)',
                      background: hl ? 'rgba(201,162,39,0.3)' : '#0a0b10',
                      color: '#f0e6d2',
                      cursor: 'copy',
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{s.title}</div>
                    <div style={{ fontSize: 10, color: '#9a9aab' }}>{first?.label ?? '—'}</div>
                  </button>
                )
              })}
            </div>
          )}

          {/* 1. Group tabs + leaf dropdown */}
          <div role="listbox" aria-label="Filter section groups" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {groups.map((g) => {
              const on = g.key === currentGroupKey
              const leaf = g.leaves.find((s) => s.typePath === activeType) ?? g.leaves[0]
              const dropHl = leaf && dropSectionTypePath === leaf.typePath && dragging
              return (
                <button
                  key={g.key}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => {
                    setActiveGroup(g.key)
                    if (leaf) selectSection(leaf.typePath)
                  }}
                  onDragOver={(e) => {
                    if (!dragging && !hasScalpelDrag(e.dataTransfer.types)) return
                    e.preventDefault()
                    if (leaf) setDropSectionTypePath(leaf.typePath)
                  }}
                  onDragLeave={() => {
                    if (leaf) setDropSectionTypePath((p) => (p === leaf.typePath ? null : p))
                  }}
                  onDrop={(e) => {
                    if (leaf) void dropOntoSection(leaf.typePath, e)
                  }}
                  title={`${g.title} — ${g.shownCount}/${g.totalCount} tiers`}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: dropHl || on ? '1px solid #c9a227' : '1px solid rgba(255,255,255,0.14)',
                    background: dropHl ? 'rgba(201,162,39,0.35)' : on ? '#c9a227' : 'rgba(255,255,255,0.04)',
                    color: on && !dropHl ? '#171821' : '#c8c4bc',
                    cursor: 'pointer',
                  }}
                >
                  {g.title}
                  <span style={{ marginLeft: 6, opacity: on ? 0.75 : 0.55, fontWeight: 500 }}>
                    {g.shownCount}/{g.totalCount}
                  </span>
                </button>
              )
            })}
          </div>

          {groupLeaves.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#9a9aab', flex: 1 }}>
                Section
                <select
                  value={active?.typePath ?? ''}
                  onChange={(e) => selectSection(e.target.value)}
                  onDragOver={(e) => {
                    if (!dragging && !hasScalpelDrag(e.dataTransfer.types)) return
                    e.preventDefault()
                    const path = (e.target as HTMLSelectElement).value || active?.typePath
                    if (path) setDropSectionTypePath(path)
                  }}
                  onDrop={(e) => {
                    const path = active?.typePath
                    if (path) void dropOntoSection(path, e)
                  }}
                  style={{
                    flex: 1,
                    minWidth: 160,
                    background: '#0a0b10',
                    color: '#f0e6d2',
                    border:
                      dropSectionTypePath && dropSectionTypePath === active?.typePath
                        ? '1px solid #c9a227'
                        : '1px solid rgba(255,255,255,0.14)',
                    borderRadius: 6,
                    padding: '6px 8px',
                    fontSize: 12,
                  }}
                >
                  {groupLeaves.map((s) => (
                    <option key={s.typePath} value={s.typePath}>
                      {s.title} ({s.shownCount}/{s.totalCount})
                    </option>
                  ))}
                </select>
              </label>
              {active && (
                <button
                  type="button"
                  title={pinnedPaths.includes(active.typePath) ? 'Unpin section' : 'Pin section to working set'}
                  onClick={() => toggleSectionPin(active.typePath)}
                  style={{
                    fontSize: 14,
                    width: 32,
                    height: 30,
                    padding: 0,
                    background: pinnedPaths.includes(active.typePath) ? 'rgba(201,162,39,0.3)' : undefined,
                    borderColor: pinnedPaths.includes(active.typePath) ? '#c9a227' : undefined,
                  }}
                >
                  {pinnedPaths.includes(active.typePath) ? '★' : '☆'}
                </button>
              )}
            </div>
          )}

          {/* 2. Global find (window) + local filter */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9a9aab' }}>
              Visibility
              <select
                value={visFilter}
                onChange={(e) => setVisFilter(e.target.value as 'all' | 'show' | 'hide')}
                style={{
                  background: '#0a0b10',
                  color: '#f0e6d2',
                  border: '1px solid rgba(255,255,255,0.14)',
                  borderRadius: 6,
                  padding: '6px 8px',
                  fontSize: 12,
                }}
              >
                <option value="all">All tiers</option>
                <option value="show">Shown only</option>
                <option value="hide">Hidden only</option>
              </select>
            </label>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter tiers / items in section…"
              style={{
                flex: '1 1 140px',
                minWidth: 120,
                background: '#0a0b10',
                color: '#f0e6d2',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 12,
              }}
            />
            {isWindow && (
              <input
                ref={globalFindRef}
                type="search"
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
                placeholder="Find across all sections… (/)"
                style={{
                  flex: '1 1 180px',
                  minWidth: 160,
                  background: '#0a0b10',
                  color: '#f0e6d2',
                  border: '1px solid rgba(201,162,39,0.35)',
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontSize: 12,
                }}
              />
            )}
          </div>

          {isWindow && globalHits.length > 0 && (
            <div
              style={{
                maxHeight: 140,
                overflowY: 'auto',
                border: '1px solid rgba(201,162,39,0.25)',
                borderRadius: 6,
                background: '#0a0b10',
                padding: 6,
              }}
            >
              {globalHits.map((hit) => {
                const item = { baseType: hit.baseType, fromBlockIndex: hit.blockIndex }
                return (
                  <div
                    key={`${hit.blockIndex}-${hit.baseType}`}
                    draggable={!busy}
                    onDragStart={(e) => onDragStart(e, item)}
                    onDragEnd={onDragEnd}
                    title="Drag onto a tier to move"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 4px',
                      fontSize: 11,
                      color: '#f0e6d2',
                      cursor: busy ? 'default' : 'grab',
                      borderRadius: 4,
                    }}
                  >
                    <BaseIcon name={hit.baseType} size={18} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span style={{ color: '#c9a227' }}>{hit.baseType}</span>
                      <span style={{ color: '#9a9aab' }}>
                        {' '}
                        · {hit.sectionTitle} / {hit.tierLabel}
                      </span>
                    </span>
                    <button type="button" disabled={busy} onClick={() => jumpToHit(hit)} style={{ fontSize: 10, padding: '2px 8px' }}>
                      Jump
                    </button>
                    {active && (
                      <button
                        type="button"
                        disabled={busy || !tiers[0]}
                        title="Move into first visible tier of current section"
                        onClick={() => void moveBase(hit.baseType, hit.blockIndex, tiers[0]?.blockIndex ?? hit.blockIndex)}
                        style={{ fontSize: 10, padding: '2px 8px' }}
                      >
                        Move here
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Workflow + sticky section actions (window) */}
          {isWindow && canEdit && active && (
            <SectionStickyBar
              section={active}
              busy={busy}
              historyLen={historyLen}
              sortByPrice={sortByPrice}
              onHideLow={() => void quickSetVisibility('hide-le-c')}
              onShowSA={() => void quickSetVisibility('show-sa')}
              onToggleSort={() => setSortByPrice((v) => !v)}
              onUndoSection={() => void undoSection(active.typePath)}
              onCheckpoint={() => void createCheckpointNow()}
              onOpenStyle={() => {
                const t = active.tiers.find((x) => x.blockIndex === expandedTier) ?? active.tiers[0]
                if (t) setStyleBlock({ index: t.blockIndex, label: t.label })
              }}
              onOpenSuggested={() => {
                setWorkbenchMode('advanced')
                const preset = sectionTypePresetFor(active.typePath)
                openSuggestedTools(preset?.suggestedTools ?? ['match', 'batch', 'economy'])
              }}
            />
          )}

          {isWindow && (
            <ComfortSettingsRow
              confirmBulk={confirmBulk}
              onConfirmBulk={(on) => {
                setConfirmBulk(on)
                saveConfirmBulk(on)
              }}
              onShowKeys={() => setShowKeys(true)}
            />
          )}

          {canAdvanced && (
            <>
              <WorkflowStrip
                busy={busy}
                showMatch={showMatchDebug}
                showStrictness={showStrictness}
                showPolicy={showEconomyPolicy}
                showSuite={showRegression}
                showPreflight={showPreflight}
                onDiagnose={runWorkflowDiagnose}
                onFix={runWorkflowFix}
                onVerify={runWorkflowVerify}
              />
              <MoreToolsDisclosure
                open={showMoreTools}
                onOpenChange={setShowMoreTools}
                active={{
                  match: showMatchDebug,
                  reapply: showReapply,
                  strictness: showStrictness,
                  batch: showBatch,
                  filmstrip: showFilmstrip,
                  preflight: showPreflight,
                  nudges: showEconomyNudges,
                  templates: showTemplates,
                  suite: showRegression,
                  editPack: showEditPack,
                  policy: showEconomyPolicy,
                  continue: showContinueChain,
                  find: showFindCond,
                  checkpoints: showCheckpoints,
                  changes: showSectionChanges,
                  diff: showDiff,
                  compare: showCompare,
                  history: showHistory,
                  lootSim: showLootSim,
                }}
                onToggle={toggleTool}
              />
            </>
          )}

          {canAdvanced && showMatchDebug && (
            <MatchDebuggerPanel
              sections={sections}
              busy={busy}
              onJump={jumpToBlock}
              onRefresh={() => {
                void refresh()
              }}
            />
          )}
          {canAdvanced && showFilmstrip && (
            <LootFilmstripPanel
              busy={busy}
              onInspect={(item) => {
                setShowMatchDebug(true)
                setShowFilmstrip(true)
                // MatchDebugger is self-contained; stash via a custom event for fill
                window.dispatchEvent(new CustomEvent('scalpel-inspect-item', { detail: item }))
              }}
            />
          )}
          {canAdvanced && showReapply && (
            <ReapplyPanel
              busy={busy}
              onDone={() => {
                void refresh()
              }}
            />
          )}
          {canAdvanced && showStrictness && (
            <StrictnessDiffPanel
              busy={busy}
              onDone={() => {
                void refresh()
              }}
            />
          )}
          {canAdvanced && showBatch && (
            <BatchConditionPanel
              section={active}
              busy={busy}
              onDone={() => {
                void refresh()
              }}
            />
          )}
          {canAdvanced && showPreflight && <PreflightPanel busy={busy} onJump={jumpToBlock} />}
          {canAdvanced && showEconomyNudges && (
            <EconomyNudgesPanel
              section={active}
              prices={prices}
              busy={busy}
              onBump={(baseType, from, to) => {
                void moveBase(baseType, from, to)
              }}
            />
          )}
          {canAdvanced && showTemplates && (
            <SectionTemplatesPanel
              section={active}
              busy={busy}
              onDone={() => {
                void refresh()
              }}
            />
          )}
          {canAdvanced && showSectionToolkit && (
            <SectionTypePresetPanel
              section={active}
              busy={busy}
              onOpenTools={openSuggestedTools}
              onApplyHideLow={() => void quickSetVisibility('hide-le-c')}
            />
          )}
          {canAdvanced && showRegression && (
            <LootRegressionPanel
              busy={busy}
              onInspect={(item) => {
                setShowMatchDebug(true)
                window.dispatchEvent(new CustomEvent('scalpel-inspect-item', { detail: item }))
              }}
            />
          )}
          {canAdvanced && showEditPack && <EditPackPanel busy={busy} />}
          {canAdvanced && showEconomyPolicy && (
            <EconomyPolicyPanel
              section={active}
              prices={prices}
              busy={busy}
              onDone={() => {
                void refresh()
                pushToast('Economy policy applied', true)
              }}
            />
          )}
          {canAdvanced && showContinueChain && <ContinueChainPanel section={active} onJump={jumpToBlock} />}
          {canAdvanced && showFindCond && (
            <FindConditionPanel busy={busy} activeTypePath={active?.typePath} onJump={jumpToBlock} />
          )}
          {canAdvanced && showCheckpoints && (
            <NamedCheckpointsPanel
              busy={busy}
              onDone={() => {
                void refresh()
              }}
            />
          )}
          {canAdvanced && showSectionChanges && (
            <SectionChangesPanel
              sections={sections}
              busy={busy}
              activeTypePath={active?.typePath}
              onJumpSection={(typePath) => {
                selectSection(typePath)
                setWorkbenchMode('edit')
              }}
              onUndoLast={() => void undoLast()}
              onUndoSection={(typePath) => void undoSection(typePath)}
            />
          )}
          {canAdvanced && showDiff && (
            <DiffRollbackPanel
              busy={busy}
              onRestored={() => {
                void refresh()
              }}
            />
          )}

          {canAdvanced && showCompare && (
            <ComparePanel
              sections={sections}
              leftPath={compareLeft}
              rightPath={compareRight}
              onLeft={setCompareLeft}
              onRight={setCompareRight}
            />
          )}

          {canAdvanced && showHistory && (
            <UndoHistoryPanel entries={historyEntries} busy={busy} onRestore={(id) => void restoreHistoryEntry(id)} />
          )}

          {canAdvanced && showLootSim && (
            <SectionLootSim section={active} busy={busy} onBusy={setBusy} />
          )}

          {canAdvanced && conflicts.length > 0 && <ConflictsPanel conflicts={conflicts} />}

          {canAdvanced && active && (
            <EconomyBar
              prices={prices}
              sortByPrice={sortByPrice}
              loading={pricesLoading}
              onToggleSort={() => setSortByPrice((v) => !v)}
            />
          )}

          {/* 3. Tier bump pills + multi-select toolbar */}
          {isWindow && canEdit && selected.length > 0 && active && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
                alignItems: 'center',
                padding: '8px 10px',
                borderRadius: 6,
                background: 'rgba(201,162,39,0.1)',
                border: '1px solid rgba(201,162,39,0.35)',
              }}
            >
              <span style={{ fontSize: 11, color: '#f0e6d2', fontWeight: 600 }}>{selected.length} selected →</span>
              {active.tiers.map((t) => (
                <button
                  key={t.blockIndex}
                  type="button"
                  disabled={busy}
                  onClick={() => void bumpSelectedTo(t.blockIndex)}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 999,
                    border: '1px solid #c9a227',
                    background: '#c9a227',
                    color: '#171821',
                    cursor: 'pointer',
                  }}
                >
                  {t.label}
                </button>
              ))}
              <button type="button" disabled={busy} onClick={() => void removeSelected()} style={{ fontSize: 11 }}>
                Remove
              </button>
              <button type="button" onClick={() => setSelected([])} aria-label="Clear selection" style={{ fontSize: 11, marginLeft: 'auto' }}>
                Clear
              </button>
            </div>
          )}

          {isWindow && canEdit && selected.length > 0 && (
            <MoveToPicker
              sections={sections}
              selectedCount={selected.length}
              busy={busy}
              onMove={(toBlock) => void bumpSelectedTo(toBlock)}
            />
          )}

          {/* 5. Copy style */}
          {isWindow && canEdit && active && active.tiers.length >= 2 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#9a9aab' }}>Copy style from</span>
              <select
                value={copyFrom}
                onChange={(e) => setCopyFrom(e.target.value)}
                aria-label="Copy style source tier"
                style={{
                  background: '#0a0b10',
                  color: '#f0e6d2',
                  border: '1px solid rgba(255,255,255,0.14)',
                  borderRadius: 6,
                  padding: '4px 8px',
                  fontSize: 11,
                }}
              >
                <option value="">—</option>
                {active.tiers.map((t) => (
                  <option key={t.blockIndex} value={t.blockIndex}>
                    {t.label}
                  </option>
                ))}
              </select>
              {copyFrom &&
                active.tiers
                  .filter((t) => String(t.blockIndex) !== copyFrom)
                  .map((t) => (
                    <button
                      key={t.blockIndex}
                      type="button"
                      disabled={busy}
                      aria-label={`Apply style to ${t.label}`}
                      onClick={() => void copyStyleToTier(t.blockIndex)}
                      style={{ fontSize: 10, padding: '3px 8px' }}
                    >
                      → {t.label}
                    </button>
                  ))}
              {copyFrom && (
                <button
                  type="button"
                  disabled={busy}
                  aria-label="Apply style to all tiers in section"
                  onClick={() => void applyStyleToSection()}
                  style={{ fontSize: 10, padding: '3px 8px' }}
                >
                  Apply style to section
                </button>
              )}
            </div>
          )}

          <div style={{ fontSize: 11, color: '#9a9aab', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {active ? (
              <>
                <span style={{ color: '#c9a227', fontWeight: 600 }}>{active.title}</span>
                <button
                  type="button"
                  title={pinnedPaths.includes(active.typePath) ? 'Unpin section' : 'Pin section'}
                  onClick={() => toggleSectionPin(active.typePath)}
                  style={{
                    fontSize: 12,
                    padding: '0 6px',
                    height: 22,
                    background: pinnedPaths.includes(active.typePath) ? 'rgba(201,162,39,0.25)' : 'transparent',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#c9a227',
                  }}
                >
                  {pinnedPaths.includes(active.typePath) ? '★' : '☆'}
                </button>
                {' · '}
                {tiers.length}
                {tiers.length !== active.tiers.length ? ` of ${active.tiers.length}` : ''} tiers
                {isWindow
                  ? workbenchMode === 'browse'
                    ? ' · Browse mode — visibility only · switch to Edit to move items'
                    : workbenchMode === 'advanced'
                      ? ' · Advanced tools above · Edit mode for day-to-day moves'
                      : workbenchMode === 'guide'
                        ? ' · Guide open — switch to Edit or Advanced to work'
                        : ' · drag items onto tiers / sections · ↑↓ bump · Del remove · / find · Ctrl+Z undo'
                  : ' · drag onto tiers · brush · Add rule'}
              </>
            ) : (
              'Select a section to edit tiers'
            )}
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              maxHeight: isWindow ? undefined : 360,
              flex: isWindow ? 1 : undefined,
              minHeight: isWindow ? 0 : undefined,
              overflowY: 'auto',
            }}
          >
            {tiers.length === 0 ? (
              <div style={{ fontSize: 12, color: '#9a9aab', padding: '8px 2px' }}>No tiers match the current filters.</div>
            ) : null}
            {tiers.map((tier) => {
              const shown = tier.visibility === 'Show'
              const open = expandedTier === tier.blockIndex
              const isDrop = dropTarget === tier.blockIndex && dropItemIndex == null
              const fileOrdered = active
                ? [...active.tiers].sort((a, b) => a.blockIndex - b.blockIndex)
                : []
              const fileIdx = fileOrdered.findIndex((t) => t.blockIndex === tier.blockIndex)
              return (
                <div
                  key={tier.blockIndex}
                  onDragEnter={(e) => onDragEnterTier(e, tier.blockIndex)}
                  onDragOver={(e) => onDragOverTier(e, tier.blockIndex)}
                  onDragLeave={(e) => onDragLeaveTier(e, tier.blockIndex)}
                  onDrop={(e) => void onDropTier(e, tier.blockIndex)}
                  style={{
                    border: isDrop ? '2px solid #c9a227' : '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 6,
                    background: isDrop
                      ? 'rgba(201,162,39,0.18)'
                      : shown
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(0,0,0,0.35)',
                    padding: '8px 10px',
                    outline: isDrop ? '1px dashed rgba(201,162,39,0.6)' : undefined,
                    outlineOffset: 2,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void toggleVisibility(tier)}
                      title={shown ? 'Hide tier' : 'Show tier'}
                      aria-label={shown ? `Hide ${tier.label}` : `Show ${tier.label}`}
                      style={{
                        width: 32,
                        height: 28,
                        fontSize: 16,
                        lineHeight: 1,
                        padding: 0,
                        background: shown ? 'rgba(76,175,80,0.25)' : 'rgba(255,255,255,0.06)',
                        color: '#f0e6d2',
                      }}
                    >
                      {shown ? '☑' : '☐'}
                    </button>

                    <button
                      type="button"
                      aria-expanded={open}
                      aria-label={`${open ? 'Collapse' : 'Expand'} ${tier.label}`}
                      onClick={() => setExpandedTier(open ? null : tier.blockIndex)}
                      style={{
                        flex: 1,
                        minWidth: 120,
                        textAlign: 'left',
                        background: 'transparent',
                        padding: '4px 0',
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                        color: '#f0e6d2',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ color: '#c9a227', width: 12 }}>{open ? '▾' : '▸'}</span>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{tier.label}</span>
                      <span style={{ fontSize: 11, color: '#9a9aab' }}>{tier.itemCount} items</span>
                      <ContinueBadge tier={tier} />
                      <EffectChips effects={tier.effects} missingSounds={missingSounds} filterDir={filterDir} />
                    </button>

                    {isWindow && canEdit && (
                      <span style={{ display: 'inline-flex', gap: 2 }}>
                        <button
                          type="button"
                          disabled={busy || fileIdx <= 0}
                          title="Move tier earlier in file (wins sooner)"
                          aria-label={`Move ${tier.label} up in file order`}
                          onClick={() => void reorderTier(tier, -1)}
                          style={{ fontSize: 14, padding: '4px 10px', minHeight: 32, minWidth: 32 }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={busy || fileIdx < 0 || fileIdx >= fileOrdered.length - 1}
                          title="Move tier later in file (wins later)"
                          aria-label={`Move ${tier.label} down in file order`}
                          onClick={() => void reorderTier(tier, 1)}
                          style={{ fontSize: 14, padding: '4px 10px', minHeight: 32, minWidth: 32 }}
                        >
                          ↓
                        </button>
                      </span>
                    )}

                    {isWindow && canEdit && open && (
                      <button
                        type="button"
                        disabled={busy || tier.baseTypes.length === 0}
                        aria-label={`Duplicate ${tier.label}`}
                        onClick={() => void duplicateTierNow(tier)}
                        style={{ fontSize: 11, padding: '4px 8px' }}
                      >
                        Duplicate
                      </button>
                    )}

                    {canEdit && (
                    <button
                      type="button"
                      title="Edit style"
                      aria-label={`Edit style for ${tier.label}`}
                      disabled={busy}
                      onClick={() => setStyleBlock({ index: tier.blockIndex, label: tier.label })}
                      style={{ width: 30, height: 28, padding: 0, fontSize: 14 }}
                    >
                      🖌
                    </button>
                    )}

                    <div className="shrink-0 max-w-[180px] overflow-hidden" title={tier.previewLabel} style={{ opacity: shown ? 1 : 0.85 }}>
                      {shown ? (
                        <LootLabel block={{ actions: tier.previewActions }} label={tier.previewLabel} />
                      ) : (
                        <HiddenLootLabel label={tier.previewLabel} />
                      )}
                    </div>
                  </div>

                  {(tier.continueParents?.length ?? 0) > 0 && (
                    <div style={{ fontSize: 10, color: '#6b6b7a', marginTop: 4, marginLeft: 40 }}>
                      Styled by Continue: {tier.continueParents!.map((p) => p.label).join(', ')}
                    </div>
                  )}

                  {open && !canEdit && <ConditionSummaryChips tier={tier} />}

                  {open && canEdit && (
                    <TierConditionInspector tier={tier} busy={busy} onSaved={() => void refresh()} />
                  )}

                  {open && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      {tier.baseTypes.length === 0 ? (
                        <div style={{ fontSize: 11, color: '#9a9aab' }}>
                          {canEdit ? 'No BaseType list — drop items here or Add rule.' : 'No BaseType list.'}
                        </div>
                      ) : (
                        <TierBaseTypeRows
                          tier={tier}
                          tiers={tiers}
                          tierIdx={fileIdx >= 0 ? fileIdx : 0}
                          busy={busy || !canEdit}
                          dragging={dragging && canEdit}
                          isWindow={isWindow && canEdit}
                          selected={selected}
                          dropItemIndex={canEdit ? dropItemIndex : null}
                          prices={prices}
                          sortByPrice={isWindow && sortByPrice && canEdit}
                          onDragStart={onDragStart}
                          onDragEnd={onDragEnd}
                          onDragOverItem={onDragOverItem}
                          onDropItem={(e, t, before) => void onDropItem(e, t, before)}
                          onToggleSelect={toggleSelect}
                          onMoveBase={(base, from, to) => void moveBase(base, from, to)}
                        />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {canEdit && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              disabled={busy || !active}
              onClick={() => {
                setAddOpen((v) => !v)
                if (addOpen) {
                  setBulkNames([])
                  setAddName('')
                }
              }}
              style={{ fontSize: 12 }}
            >
              {addOpen ? 'Cancel' : 'Add rule'}
            </button>
          </div>
          )}

          {canEdit && addOpen && active && (
            <div
              style={{
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 6,
                padding: 10,
                background: '#0a0b10',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f0e6d2' }}>Add rule — {active.title}</div>
              {isWindow ? (
                <>
                  <BaseTypeTypeahead
                    value={addName}
                    onChange={setAddName}
                    onPick={addMode === 'existing' ? addBulkName : undefined}
                    disabled={busy}
                  />
                  {bulkNames.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {bulkNames.map((n) => (
                        <span
                          key={n}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 11,
                            padding: '2px 8px',
                            borderRadius: 999,
                            background: 'rgba(201,162,39,0.2)',
                            border: '1px solid rgba(201,162,39,0.45)',
                            color: '#f0e6d2',
                          }}
                        >
                          <BaseIcon name={n} size={14} />
                          {n}
                          <button
                            type="button"
                            onClick={() => setBulkNames((prev) => prev.filter((x) => x !== n))}
                            style={{
                              padding: 0,
                              margin: 0,
                              border: 'none',
                              background: 'transparent',
                              color: '#9a9aab',
                              cursor: 'pointer',
                              fontSize: 12,
                              lineHeight: 1,
                            }}
                            aria-label={`Remove ${n}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {addMode === 'existing' && (
                    <div style={{ fontSize: 10, color: '#9a9aab' }}>
                      Pick or press Enter to queue another BaseType, then Add all.
                    </div>
                  )}
                </>
              ) : (
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="BaseType name (e.g. Divine Orb)"
                  style={{
                    background: '#12131a',
                    color: '#f0e6d2',
                    border: '1px solid rgba(255,255,255,0.14)',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: 12,
                  }}
                />
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setAddMode('existing')}
                  style={{
                    fontSize: 11,
                    background: addMode === 'existing' ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                    color: addMode === 'existing' ? '#171821' : '#f0e6d2',
                  }}
                >
                  Add to tier
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode('new')}
                  disabled={active.typePath === '__untagged__'}
                  style={{
                    fontSize: 11,
                    background: addMode === 'new' ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                    color: addMode === 'new' ? '#171821' : '#f0e6d2',
                  }}
                >
                  New tier rule
                </button>
              </div>
              {addMode === 'existing' ? (
                <select
                  value={addTier}
                  onChange={(e) => setAddTier(e.target.value)}
                  style={{
                    background: '#12131a',
                    color: '#f0e6d2',
                    border: '1px solid rgba(255,255,255,0.14)',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: 12,
                  }}
                >
                  {tiers.map((t) => (
                    <option key={t.blockIndex} value={t.blockIndex}>
                      {t.label}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <input
                    type="text"
                    value={addNewTierId}
                    onChange={(e) => setAddNewTierId(e.target.value)}
                    placeholder="New tier id (e.g. custom)"
                    style={{
                      background: '#12131a',
                      color: '#f0e6d2',
                      border: '1px solid rgba(255,255,255,0.14)',
                      borderRadius: 6,
                      padding: '8px 10px',
                      fontSize: 12,
                    }}
                  />
                  <label style={{ fontSize: 11, color: '#9a9aab', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    Clone conditions & style from
                    <select
                      value={cloneFromBlock || String(active.tiers[0]?.blockIndex ?? '')}
                      onChange={(e) => setCloneFromBlock(e.target.value)}
                      style={{
                        background: '#12131a',
                        color: '#f0e6d2',
                        border: '1px solid rgba(255,255,255,0.14)',
                        borderRadius: 6,
                        padding: '8px 10px',
                        fontSize: 12,
                      }}
                    >
                      {active.tiers.map((t) => (
                        <option key={t.blockIndex} value={t.blockIndex}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                      color: '#c8c4bc',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={cloneConditions}
                      onChange={(e) => setCloneConditions(e.target.checked)}
                    />
                    Copy StackSize / Class / other conditions (not just style)
                  </label>
                </>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="primary" disabled={busy} onClick={() => void submitAddRule()} style={{ fontSize: 12 }}>
                  {busy
                    ? 'Adding…'
                    : isWindow && bulkNames.length > 0
                      ? `Add ${bulkNames.length + (addName.trim() && !bulkNames.includes(addName.trim()) ? 1 : 0)}`
                      : 'Add'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import type { FilterAction, FilterSection, FilterSectionTier, HistoryEntry, LootSimDrop } from '@shared/types'
import { HistoryMiniList, findBaseConflicts, type BaseConflict } from './filter-section-editor-helpers'
import { HiddenLootLabel, LootLabel } from '@renderer/shared/LootLabel'

const STYLE_TYPES = new Set([
  'SetTextColor',
  'SetBorderColor',
  'SetBackgroundColor',
  'SetFontSize',
  'PlayAlertSound',
  'CustomAlertSound',
  'CustomAlertSoundOptional',
  'PlayEffect',
  'MinimapIcon',
])

const panelStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6,
  padding: 10,
  background: '#0a0b10',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

export function MoveToPicker({
  sections,
  selectedCount,
  busy,
  onMove,
}: {
  sections: FilterSection[]
  selectedCount: number
  busy?: boolean
  onMove: (toBlockIndex: number) => void
}): JSX.Element {
  const [q, setQ] = useState('')
  const [typePath, setTypePath] = useState(sections[0]?.typePath ?? '')
  const section = sections.find((s) => s.typePath === typePath) ?? sections[0]
  const tiers = useMemo(() => {
    if (!section) return []
    const qq = q.trim().toLowerCase()
    if (!qq) return section.tiers
    return section.tiers.filter(
      (t) => t.label.toLowerCase().includes(qq) || t.tier.toLowerCase().includes(qq) || t.baseTypes.some((b) => b.toLowerCase().includes(qq)),
    )
  }, [section, q])

  return (
    <div style={panelStyle} role="region" aria-label="Move selected items to tier">
      <div style={{ fontSize: 12, fontWeight: 700, color: '#f0e6d2' }}>
        Move to… {selectedCount > 0 ? `(${selectedCount} selected)` : '(select items first)'}
      </div>
      <select
        value={section?.typePath ?? ''}
        onChange={(e) => setTypePath(e.target.value)}
        aria-label="Target section"
        style={{ background: '#12131a', color: '#f0e6d2', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 6, padding: 6, fontSize: 12 }}
      >
        {sections.map((s) => (
          <option key={s.typePath} value={s.typePath}>
            {s.title}
          </option>
        ))}
      </select>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter tiers…"
        aria-label="Filter target tiers"
        style={{ background: '#12131a', color: '#f0e6d2', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 6, padding: 6, fontSize: 12 }}
      />
      <div style={{ maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {tiers.map((t) => (
          <button
            key={t.blockIndex}
            type="button"
            disabled={busy || selectedCount === 0}
            onClick={() => onMove(t.blockIndex)}
            style={{ textAlign: 'left', fontSize: 11, padding: '5px 8px' }}
          >
            {t.label} · {t.itemCount} items · {t.visibility}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ComparePanel({
  sections,
  leftPath,
  rightPath,
  onLeft,
  onRight,
}: {
  sections: FilterSection[]
  leftPath: string
  rightPath: string
  onLeft: (p: string) => void
  onRight: (p: string) => void
}): JSX.Element {
  const left = sections.find((s) => s.typePath === leftPath)
  const right = sections.find((s) => s.typePath === rightPath)
  const leftSet = new Set(left?.tiers.flatMap((t) => t.baseTypes) ?? [])
  const rightSet = new Set(right?.tiers.flatMap((t) => t.baseTypes) ?? [])
  const onlyLeft = [...leftSet].filter((b) => !rightSet.has(b)).sort()
  const onlyRight = [...rightSet].filter((b) => !leftSet.has(b)).sort()
  const both = [...leftSet].filter((b) => rightSet.has(b)).sort()

  return (
    <div style={panelStyle} role="region" aria-label="Compare sections">
      <div style={{ fontSize: 12, fontWeight: 700, color: '#f0e6d2' }}>Compare sections</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <select
          value={leftPath}
          onChange={(e) => onLeft(e.target.value)}
          aria-label="Left section"
          style={{ flex: 1, background: '#12131a', color: '#f0e6d2', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 6, padding: 6, fontSize: 11 }}
        >
          {sections.map((s) => (
            <option key={s.typePath} value={s.typePath}>
              {s.title}
            </option>
          ))}
        </select>
        <select
          value={rightPath}
          onChange={(e) => onRight(e.target.value)}
          aria-label="Right section"
          style={{ flex: 1, background: '#12131a', color: '#f0e6d2', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 6, padding: 6, fontSize: 11 }}
        >
          {sections.map((s) => (
            <option key={s.typePath} value={s.typePath}>
              {s.title}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 11, color: '#f0e6d2' }}>
        <div>
          <div style={{ color: '#c9a227', fontWeight: 700, marginBottom: 4 }}>Only left ({onlyLeft.length})</div>
          <div style={{ maxHeight: 100, overflowY: 'auto' }}>{onlyLeft.slice(0, 40).map((b) => <div key={b}>{b}</div>)}</div>
        </div>
        <div>
          <div style={{ color: '#9a9aab', fontWeight: 700, marginBottom: 4 }}>Both ({both.length})</div>
          <div style={{ maxHeight: 100, overflowY: 'auto' }}>{both.slice(0, 40).map((b) => <div key={b}>{b}</div>)}</div>
        </div>
        <div>
          <div style={{ color: '#93c5fd', fontWeight: 700, marginBottom: 4 }}>Only right ({onlyRight.length})</div>
          <div style={{ maxHeight: 100, overflowY: 'auto' }}>{onlyRight.slice(0, 40).map((b) => <div key={b}>{b}</div>)}</div>
        </div>
      </div>
    </div>
  )
}

const CONFLICTS_COLLAPSED_KEY = 'scalpel.filterSectionEditor.conflictsCollapsed'

export function ConflictsPanel({ conflicts }: { conflicts: BaseConflict[] }): JSX.Element | null {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const v = localStorage.getItem(CONFLICTS_COLLAPSED_KEY)
      return v !== '0' // default collapsed
    } catch {
      return true
    }
  })

  if (conflicts.length === 0) return null

  const toggle = (): void => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(CONFLICTS_COLLAPSED_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return (
    <div
      style={{ ...panelStyle, borderColor: 'rgba(248,113,113,0.35)', padding: collapsed ? '6px 10px' : panelStyle.padding }}
      role="region"
      aria-label="BaseType conflicts"
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: '#fca5a5',
          fontSize: 12,
          fontWeight: 700,
          textAlign: 'left',
        }}
      >
        <span aria-hidden style={{ fontSize: 10, width: 12 }}>
          {collapsed ? '▸' : '▾'}
        </span>
        <span>
          Possible duplicates ({conflicts.length})
          {collapsed ? ' — click to expand' : ' — same $type/$tier only'}
        </span>
      </button>
      {!collapsed && (
        <div style={{ maxHeight: 120, overflowY: 'auto', fontSize: 11, color: '#f0e6d2', marginTop: 8 }}>
          {conflicts.slice(0, 30).map((c) => (
            <div key={c.baseType} style={{ marginBottom: 6 }}>
              <strong style={{ color: '#c9a227' }}>{c.baseType}</strong>
              <div style={{ color: '#9a9aab' }}>
                Show: {c.shows.map((s) => `${s.title}/${s.tierLabel}`).join(', ') || '—'}
                {c.hides.length > 0
                  ? ` · Hide: ${c.hides.map((s) => `${s.title}/${s.tierLabel}`).join(', ')}`
                  : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function EconomyBar({
  prices,
  sortByPrice,
  onToggleSort,
  loading,
}: {
  prices: Record<string, number | null>
  sortByPrice: boolean
  onToggleSort: () => void
  loading?: boolean
}): JSX.Element {
  const valued = Object.values(prices).filter((v): v is number => v != null)
  const sum = valued.reduce((a, b) => a + b, 0)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11, color: '#9a9aab' }}>
      <span>
        Economy: {loading ? 'loading…' : valued.length ? `${valued.length} priced · ~${sum.toFixed(0)}c section` : 'no prices'}
      </span>
      <button type="button" onClick={onToggleSort} style={{ fontSize: 11 }}>
        {sortByPrice ? 'Clear price sort' : 'Sort by price'}
      </button>
    </div>
  )
}

export function SectionLootSim({
  section,
  busy,
  onBusy,
}: {
  section: FilterSection | null
  busy?: boolean
  onBusy?: (b: boolean) => void
}): JSX.Element {
  const [drops, setDrops] = useState<LootSimDrop[]>([])
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<{ shown: number; hidden: number } | null>(null)

  const run = async (): Promise<void> => {
    if (!section) return
    onBusy?.(true)
    setError(null)
    try {
      const pool = section.tiers.flatMap((t) =>
        t.baseTypes.map((name) => ({
          name,
          baseType: name,
          itemClass: 'Stackable Currency',
          rarity: 'Normal' as const,
        })),
      )
      if (pool.length === 0) {
        setError('Section has no BaseTypes')
        return
      }
      const result = await window.api.simulateLootDrops({ pool: pool.slice(0, 80), count: 24 })
      if (!result.ok) {
        setError(result.error ?? 'Sim failed')
        return
      }
      setDrops(result.drops ?? [])
      setStats({ shown: result.shown ?? 0, hidden: result.hidden ?? 0 })
    } finally {
      onBusy?.(false)
    }
  }

  return (
    <div style={panelStyle} role="region" aria-label="Loot simulation">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#f0e6d2' }}>Loot sim — {section?.title ?? '—'}</div>
        <button type="button" disabled={busy || !section} onClick={() => void run()} style={{ fontSize: 11 }}>
          Simulate
        </button>
      </div>
      {error && <div style={{ color: '#f87171', fontSize: 11 }}>{error}</div>}
      {stats && (
        <div style={{ fontSize: 11, color: '#9a9aab' }}>
          Shown {stats.shown} · Hidden {stats.hidden}
        </div>
      )}
      <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {drops.slice(0, 24).map((d, i) =>
          d.hidden ? (
            <HiddenLootLabel key={`${d.name}-${i}`} label={d.name} />
          ) : (
            <LootLabel key={`${d.name}-${i}`} blocks={d.blocks ?? undefined} label={d.name} />
          ),
        )}
      </div>
    </div>
  )
}

export function SyncToolbar({
  busy,
  onMessage,
}: {
  busy?: boolean
  onMessage: (msg: string | null, err?: string | null) => void
}): JSX.Element {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <button
        type="button"
        disabled={busy}
        title="Pull NeverSink/FilterBlade online updates into local (keeps your edits where possible)"
        onClick={() => {
          void (async () => {
            onMessage('Syncing…')
            const r = await window.api.quickUpdateFilter()
            if (!r.ok) {
              onMessage(null, r.error ?? 'Sync failed')
              return
            }
            const s = r.stats
            onMessage(
              s
                ? `Synced — +${s.added} / −${s.removed} / both ${s.bothChanged} / user ${s.userOnly}`
                : 'Synced',
            )
          })()
        }}
        style={{ fontSize: 11 }}
      >
        Sync online
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          void window.api.filterBladeUrl().then((url) => window.api.openExternal(url))
        }}
        style={{ fontSize: 11 }}
      >
        Open FilterBlade
      </button>
    </div>
  )
}

export function UndoHistoryPanel({
  entries,
  busy,
  onRestore,
}: {
  entries: HistoryEntry[]
  busy?: boolean
  onRestore: (id: number) => void
}): JSX.Element {
  return (
    <div style={panelStyle} role="region" aria-label="Undo history">
      <div style={{ fontSize: 12, fontWeight: 700, color: '#f0e6d2' }}>Undo history</div>
      <HistoryMiniList entries={entries} busy={busy} onRestore={onRestore} />
    </div>
  )
}

export async function applyBatchStyleFrom(
  fromBlockIndex: number,
  toBlockIndexes: number[],
): Promise<{ ok: boolean; error?: string }> {
  const fromRes = await window.api.getFilterBlock(fromBlockIndex)
  if (!fromRes.ok || !fromRes.block) return { ok: false, error: fromRes.error ?? 'Source missing' }
  const styleActions: FilterAction[] = fromRes.block.actions
    .filter((a) => STYLE_TYPES.has(a.type))
    .map((a) => ({ type: a.type, values: [...a.values] }))
  for (const to of toBlockIndexes) {
    if (to === fromBlockIndex) continue
    const toRes = await window.api.getFilterBlock(to)
    if (!toRes.ok || !toRes.block) return { ok: false, error: toRes.error ?? 'Target missing' }
    const kept = toRes.block.actions.filter((a) => !STYLE_TYPES.has(a.type))
    const result = await window.api.saveBlockEdit(to, { ...toRes.block, actions: [...kept, ...styleActions] }, '')
    if (!result.ok) return result
  }
  return { ok: true }
}

export async function duplicateTier(
  tier: FilterSectionTier,
  typePath: string,
  newTierId: string,
): Promise<{ ok: boolean; error?: string }> {
  const first = tier.baseTypes[0]
  if (!first) return { ok: false, error: 'Tier has no BaseTypes to duplicate' }
  if (typePath === '__untagged__') return { ok: false, error: 'Cannot duplicate untagged blocks this way' }
  const insert = await window.api.insertSectionRule({
    typePath,
    tier: newTierId.trim() || `${tier.tier}-copy`,
    baseType: first,
    beforeBlockIndex: tier.blockIndex,
    visibility: tier.visibility,
    copyStyleFromIndex: tier.blockIndex,
  })
  if (!insert.ok) return insert
  // Remaining BaseTypes: refresh needed to find new block — caller should refresh then add.
  // Best-effort: add remaining into the same new rule by re-reading sections is caller's job.
  // For simplicity add remaining via getFilterSections after insert is awkward mid-call.
  // Insert only first; caller can batch-add rest after refresh by matching new tier id.
  return { ok: true, error: tier.baseTypes.length > 1 ? `Duplicated with ${first}; re-add remaining after refresh` : undefined }
}

export function useSectionConflicts(sections: FilterSection[]): BaseConflict[] {
  return useMemo(() => findBaseConflicts(sections), [sections])
}

export function useSectionPrices(section: FilterSection | null, league: string): {
  prices: Record<string, number | null>
  loading: boolean
} {
  const [prices, setPrices] = useState<Record<string, number | null>>({})
  const [loading, setLoading] = useState(false)
  const key = section?.tiers.map((t) => t.baseTypes.join(',')).join('|') ?? ''

  useEffect(() => {
    if (!section || !league) {
      setPrices({})
      return
    }
    const bases = [...new Set(section.tiers.flatMap((t) => t.baseTypes))].slice(0, 120)
    if (bases.length === 0) {
      setPrices({})
      return
    }
    let alive = true
    setLoading(true)
    void window.api.batchLookupPrices(bases, league).then((map) => {
      if (!alive) return
      const next: Record<string, number | null> = {}
      for (const b of bases) {
        next[b] = map[b]?.chaosValue ?? null
      }
      setPrices(next)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [key, league, section])

  return { prices, loading }
}

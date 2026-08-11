import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FilterSection, FilterSectionTier, ParsedClipboardItem } from '@shared/types'
import {
  addLootSuiteItem,
  clearLootSuite,
  loadLootSuite,
  removeLootSuiteItem,
  saveLootSuite,
  sectionTypePresetFor,
  type LootSuiteItem,
} from './filter-section-editor-helpers'

const panelStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6,
  padding: 10,
  background: '#0a0b10',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const inputStyle: React.CSSProperties = {
  background: '#12131a',
  color: '#f0e6d2',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 6,
  padding: '4px 8px',
  fontSize: 11,
}

/** Saved loot regression suite — pin items, re-run match, flag changes. */
export function LootRegressionPanel({
  busy,
  onInspect,
}: {
  busy?: boolean
  onInspect: (item: ParsedClipboardItem) => void
}): JSX.Element {
  const [suite, setSuite] = useState<LootSuiteItem[]>(() => loadLootSuite())
  const [results, setResults] = useState<
    Array<{ id: string; winner?: string; visibility?: string; changed: boolean; style?: string }>
  >([])
  const [running, setRunning] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const reload = (): void => setSuite(loadLootSuite())

  const pinFromGame = async (): Promise<void> => {
    const item = await window.api.getLastEvaluatedItem()
    if (!item.ok || !item.baseType) {
      setNote(item.error ?? 'No in-game item')
      return
    }
    const match = await window.api.matchFilterItem({
      baseType: item.baseType,
      itemClass: item.itemClass,
      rarity: item.rarity,
      stackSize: item.stackSize,
      includeShadowed: false,
    })
    const win = match.ok ? match.steps.find((s) => s.isWinner) : undefined
    addLootSuiteItem({
      label: item.name || item.baseType,
      baseType: item.baseType,
      itemClass: item.itemClass,
      rarity: item.rarity,
      stackSize: item.stackSize,
      itemLevel: item.itemLevel,
      quality: item.quality,
      areaLevel: item.areaLevel,
      corrupted: item.corrupted,
      identified: item.identified,
      expectedWinner: win?.label,
      expectedVisibility: win?.visibility,
    })
    reload()
    setNote(`Pinned ${item.name || item.baseType}`)
  }

  const pinRecent = async (): Promise<void> => {
    const items = await window.api.getRecentEvaluatedItems()
    let n = 0
    for (const item of items) {
      if (!item.ok || !item.baseType) continue
      const match = await window.api.matchFilterItem({
        baseType: item.baseType,
        itemClass: item.itemClass,
        rarity: item.rarity,
        stackSize: item.stackSize,
        includeShadowed: false,
      })
      const win = match.ok ? match.steps.find((s) => s.isWinner) : undefined
      addLootSuiteItem({
        label: item.name || item.baseType,
        baseType: item.baseType,
        itemClass: item.itemClass,
        rarity: item.rarity,
        stackSize: item.stackSize,
        itemLevel: item.itemLevel,
        quality: item.quality,
        areaLevel: item.areaLevel,
        corrupted: item.corrupted,
        identified: item.identified,
        expectedWinner: win?.label,
        expectedVisibility: win?.visibility,
      })
      n++
    }
    reload()
    setNote(`Pinned ${n} recent item(s)`)
  }

  const runSuite = async (): Promise<void> => {
    setRunning(true)
    setNote(null)
    try {
      const out: Array<{ id: string; winner?: string; visibility?: string; changed: boolean; style?: string }> = []
      for (const row of suite) {
        const match = await window.api.matchFilterItem({
          baseType: row.baseType,
          itemClass: row.itemClass,
          rarity: row.rarity,
          stackSize: row.stackSize,
          itemLevel: row.itemLevel,
          quality: row.quality,
          areaLevel: row.areaLevel,
          corrupted: row.corrupted,
          identified: row.identified,
          includeShadowed: false,
        })
        const win = match.ok ? match.steps.find((s) => s.isWinner) : undefined
        const changed =
          (row.expectedWinner != null && row.expectedWinner !== win?.label) ||
          (row.expectedVisibility != null && row.expectedVisibility !== win?.visibility)
        out.push({
          id: row.id,
          winner: win?.label,
          visibility: win?.visibility,
          changed: Boolean(changed),
          style: win?.styleSummary,
        })
      }
      setResults(out)
      const changes = out.filter((r) => r.changed).length
      setNote(changes ? `${changes} regression(s)` : `All ${out.length} passed`)
    } finally {
      setRunning(false)
    }
  }

  const acceptBaseline = (): void => {
    const map = new Map(results.map((r) => [r.id, r]))
    const next = suite.map((row) => {
      const r = map.get(row.id)
      if (!r) return row
      return { ...row, expectedWinner: r.winner, expectedVisibility: r.visibility }
    })
    saveLootSuite(next)
    setSuite(next)
    setNote('Baselines updated to current winners')
    void runSuite()
  }

  return (
    <div style={panelStyle} role="region" aria-label="Loot regression suite">
      <div style={{ fontSize: 12, fontWeight: 700, color: '#f0e6d2' }}>Loot regression suite</div>
      <div style={{ fontSize: 11, color: '#9a9aab' }}>
        Pin Ctrl+C samples, re-run after Strictness/migrate, flag winner changes.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button type="button" disabled={busy || running} style={{ fontSize: 10 }} onClick={() => void pinFromGame()}>
          Pin from game
        </button>
        <button type="button" disabled={busy || running} style={{ fontSize: 10 }} onClick={() => void pinRecent()}>
          Pin filmstrip
        </button>
        <button type="button" disabled={busy || running || suite.length === 0} style={{ fontSize: 10 }} onClick={() => void runSuite()}>
          {running ? '…' : 'Re-run suite'}
        </button>
        <button type="button" disabled={results.length === 0} style={{ fontSize: 10 }} onClick={acceptBaseline}>
          Accept as baseline
        </button>
        <button
          type="button"
          style={{ fontSize: 10, marginLeft: 'auto' }}
          onClick={() => {
            clearLootSuite()
            reload()
            setResults([])
          }}
        >
          Clear
        </button>
      </div>
      {note && <div style={{ fontSize: 11, color: note.includes('regression') ? '#fbbf24' : '#86efac' }}>{note}</div>}
      <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {suite.length === 0 && <div style={{ fontSize: 11, color: '#9a9aab' }}>No pinned items yet.</div>}
        {suite.map((row) => {
          const r = results.find((x) => x.id === row.id)
          return (
            <div key={row.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 10 }}>
              <span style={{ flex: 1, color: r?.changed ? '#fca5a5' : '#f0e6d2' }}>
                {row.label}
                {row.stackSize && row.stackSize > 1 ? ` ×${row.stackSize}` : ''} · expect {row.expectedVisibility ?? '?'}{' '}
                {row.expectedWinner ?? '—'}
                {r ? ` → now ${r.visibility ?? '?'} ${r.winner ?? '—'}` : ''}
              </span>
              <button
                type="button"
                style={{ fontSize: 10 }}
                onClick={() =>
                  onInspect({
                    ok: true,
                    baseType: row.baseType,
                    name: row.label,
                    itemClass: row.itemClass,
                    rarity: row.rarity,
                    stackSize: row.stackSize,
                    itemLevel: row.itemLevel,
                    quality: row.quality,
                    areaLevel: row.areaLevel,
                    corrupted: row.corrupted,
                    identified: row.identified,
                  })
                }
              >
                Inspect
              </button>
              <button
                type="button"
                style={{ fontSize: 10 }}
                onClick={() => {
                  removeLootSuiteItem(row.id)
                  reload()
                }}
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Export / import recorded intents as a portable edit pack. */
export function EditPackPanel({ busy }: { busy?: boolean }): JSX.Element {
  const [json, setJson] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')

  const doExport = async (): Promise<void> => {
    const res = await window.api.exportFilterIntents()
    if (!res.ok || !res.json) {
      setNote(res.error ?? 'Export failed')
      return
    }
    setJson(res.json)
    try {
      await navigator.clipboard.writeText(res.json)
      setNote(`Exported ${res.intentCount ?? 0} intent(s) — copied to clipboard`)
    } catch {
      setNote(`Exported ${res.intentCount ?? 0} intent(s)`)
    }
  }

  const doImport = async (): Promise<void> => {
    if (!json.trim()) return
    if (mode === 'replace' && !window.confirm('Replace your entire intent log with this pack?')) return
    const res = await window.api.importFilterIntents({ json, mode })
    if (!res.ok) {
      setNote(res.error ?? 'Import failed')
      return
    }
    setNote(`Imported ${res.imported ?? 0} intent(s) (${mode}). Use Re-apply to replay onto a Strictness copy.`)
  }

  return (
    <div style={panelStyle} role="region" aria-label="Edit pack">
      <div style={{ fontSize: 12, fontWeight: 700, color: '#f0e6d2' }}>Edit pack</div>
      <div style={{ fontSize: 11, color: '#9a9aab' }}>
        Portable intent JSON — your BaseType moves, visibility, conditions. Share across filters / machines.
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" disabled={busy} style={{ fontSize: 11 }} onClick={() => void doExport()}>
          Export
        </button>
        <select value={mode} onChange={(e) => setMode(e.target.value as 'merge' | 'replace')} style={inputStyle}>
          <option value="merge">Merge on import</option>
          <option value="replace">Replace on import</option>
        </select>
        <button type="button" disabled={busy || !json.trim()} style={{ fontSize: 11 }} onClick={() => void doImport()}>
          Import
        </button>
      </div>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={4}
        placeholder="Edit pack JSON…"
        style={{ ...inputStyle, width: '100%', resize: 'vertical', fontFamily: 'ui-monospace, monospace' }}
      />
      {note && <div style={{ fontSize: 11, color: '#86efac' }}>{note}</div>}
    </div>
  )
}

/** Economy auto-policy: hide/show/Minimal by chaos threshold. */
export function EconomyPolicyPanel({
  section,
  prices,
  busy,
  onDone,
}: {
  section: FilterSection | null
  prices: Record<string, number | null>
  busy?: boolean
  onDone: () => void
}): JSX.Element {
  const [threshold, setThreshold] = useState('1')
  const [action, setAction] = useState<'Hide' | 'Minimal' | 'Show'>('Hide')
  const [mode, setMode] = useState<'below' | 'above'>('below')
  const [preview, setPreview] = useState<Array<{ baseType: string; chaos: number; from: string; tier: FilterSectionTier }>>(
    [],
  )
  const [note, setNote] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  const buildPreview = (): void => {
    if (!section) return
    const t = parseFloat(threshold)
    if (Number.isNaN(t)) {
      setNote('Invalid threshold')
      return
    }
    const rows: Array<{ baseType: string; chaos: number; from: string; tier: FilterSectionTier }> = []
    for (const tier of section.tiers) {
      for (const b of tier.baseTypes) {
        const chaos = prices[b]
        if (chaos == null) continue
        const hit = mode === 'below' ? chaos < t : chaos >= t
        if (!hit) continue
        if (tier.visibility === action) continue
        rows.push({ baseType: b, chaos, from: tier.label, tier })
      }
    }
    setPreview(rows.sort((a, b) => a.chaos - b.chaos).slice(0, 80))
    setNote(`${rows.length} item(s) would affect ${new Set(rows.map((r) => r.tier.blockIndex)).size} tier(s) → ${action}`)
  }

  const apply = async (): Promise<void> => {
    if (!section || preview.length === 0) return
    const blocks = new Set(preview.map((p) => p.tier.blockIndex))
    if (!window.confirm(`Set ${blocks.size} tier(s) to ${action}? (whole-tier visibility based on matched items)`)) {
      return
    }
    setWorking(true)
    try {
      let n = 0
      for (const blockIndex of blocks) {
        const r = await window.api.setSectionTierVisibility(blockIndex, action)
        if (r.ok) n++
      }
      setNote(`Updated ${n} tier(s)`)
      onDone()
      buildPreview()
    } finally {
      setWorking(false)
    }
  }

  return (
    <div style={panelStyle} role="region" aria-label="Economy policy">
      <div style={{ fontSize: 12, fontWeight: 700, color: '#f0e6d2' }}>Economy policy</div>
      <div style={{ fontSize: 11, color: '#9a9aab' }}>
        Preview then apply Show/Hide/Minimal for tiers holding items {mode === 'below' ? 'below' : 'at/above'} a chaos
        threshold.
      </div>
      {!section ? (
        <div style={{ fontSize: 11, color: '#9a9aab' }}>Open a section.</div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <select value={mode} onChange={(e) => setMode(e.target.value as 'below' | 'above')} style={inputStyle}>
              <option value="below">Chaos below</option>
              <option value="above">Chaos ≥</option>
            </select>
            <input
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              style={{ ...inputStyle, width: 64 }}
              aria-label="Chaos threshold"
            />
            <select value={action} onChange={(e) => setAction(e.target.value as 'Hide' | 'Minimal' | 'Show')} style={inputStyle}>
              <option value="Hide">→ Hide</option>
              <option value="Minimal">→ Minimal</option>
              <option value="Show">→ Show</option>
            </select>
            <button type="button" disabled={busy} style={{ fontSize: 11 }} onClick={buildPreview}>
              Preview
            </button>
            <button
              type="button"
              disabled={busy || working || preview.length === 0}
              style={{ fontSize: 11, background: 'rgba(201,162,39,0.3)', borderColor: '#c9a227' }}
              onClick={() => void apply()}
            >
              Apply
            </button>
          </div>
          {note && <div style={{ fontSize: 11, color: '#86efac' }}>{note}</div>}
          <div style={{ maxHeight: 120, overflowY: 'auto', fontSize: 10, color: '#9a9aab' }}>
            {preview.slice(0, 30).map((p) => (
              <div key={`${p.baseType}-${p.tier.blockIndex}`}>
                {p.baseType} · {p.chaos.toFixed(1)}c · {p.from}
              </div>
            ))}
            {preview.length > 30 && <div>…and {preview.length - 30} more</div>}
          </div>
        </>
      )}
    </div>
  )
}

/** Continue chain graph for the active section. */
export function ContinueChainPanel({
  section,
  onJump,
}: {
  section: FilterSection | null
  onJump: (blockIndex: number) => void
}): JSX.Element {
  if (!section) {
    return (
      <div style={panelStyle}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#f0e6d2' }}>Continue chain</div>
        <div style={{ fontSize: 11, color: '#9a9aab' }}>Open a section.</div>
      </div>
    )
  }

  const ordered = [...section.tiers].sort((a, b) => a.blockIndex - b.blockIndex)

  return (
    <div style={panelStyle} role="region" aria-label="Continue chain">
      <div style={{ fontSize: 12, fontWeight: 700, color: '#f0e6d2' }}>Continue chain</div>
      <div style={{ fontSize: 11, color: '#9a9aab' }}>File order for {section.title} — who feeds whom.</div>
      <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {ordered.map((t) => (
          <div
            key={t.blockIndex}
            style={{
              padding: '6px 8px',
              borderLeft: t.continue ? '3px solid rgba(147,197,253,0.7)' : '3px solid rgba(255,255,255,0.12)',
              background: 'rgba(0,0,0,0.25)',
              fontSize: 11,
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <strong style={{ color: '#f0e6d2' }}>
                #{t.blockIndex + 1} {t.label}
              </strong>
              <span style={{ color: '#9a9aab' }}>{t.visibility}</span>
              {t.continue && <span style={{ color: '#93c5fd', fontSize: 10 }}>Continue →</span>}
              <button type="button" style={{ fontSize: 10, marginLeft: 'auto' }} onClick={() => onJump(t.blockIndex)}>
                Jump
              </button>
            </div>
            {t.continueParents && t.continueParents.length > 0 && (
              <div style={{ fontSize: 10, color: '#6b6b7a', marginTop: 2 }}>
                ← from {t.continueParents.map((p) => p.label).join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Find rules by condition / missing action. */
export function FindConditionPanel({
  busy,
  activeTypePath,
  onJump,
}: {
  busy?: boolean
  activeTypePath?: string | null
  onJump: (blockIndex: number) => void
}): JSX.Element {
  const [condType, setCondType] = useState('StackSize')
  const [valueContains, setValueContains] = useState('')
  const [missingAction, setMissingAction] = useState('')
  const [scopeSection, setScopeSection] = useState(true)
  const [hits, setHits] = useState<Array<{ blockIndex: number; label: string; visibility: string; match: string }>>([])
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  const run = async (): Promise<void> => {
    setWorking(true)
    setError(null)
    try {
      const res = await window.api.findFilterConditions({
        conditionType: missingAction ? undefined : condType || undefined,
        valueContains: valueContains || undefined,
        missingAction: missingAction || undefined,
        typePath: scopeSection && activeTypePath ? activeTypePath : undefined,
      })
      if (!res.ok) setError(res.error ?? 'Search failed')
      setHits(res.hits)
    } finally {
      setWorking(false)
    }
  }

  return (
    <div style={panelStyle} role="region" aria-label="Find by condition">
      <div style={{ fontSize: 12, fontWeight: 700, color: '#f0e6d2' }}>Find by condition</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <select
          value={condType}
          onChange={(e) => setCondType(e.target.value)}
          disabled={!!missingAction}
          style={inputStyle}
          aria-label="Condition type"
        >
          {['StackSize', 'AreaLevel', 'ItemLevel', 'Quality', 'Class', 'Rarity', 'Corrupted', 'BaseType'].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          value={valueContains}
          onChange={(e) => setValueContains(e.target.value)}
          placeholder="Value contains…"
          disabled={!!missingAction}
          style={{ ...inputStyle, width: 100 }}
        />
        <select value={missingAction} onChange={(e) => setMissingAction(e.target.value)} style={inputStyle}>
          <option value="">(or missing action)</option>
          <option value="MinimapIcon">Missing MinimapIcon</option>
          <option value="PlayEffect">Missing PlayEffect</option>
          <option value="PlayAlertSound">Missing PlayAlertSound</option>
          <option value="CustomAlertSound">Missing CustomAlertSound</option>
        </select>
        <label style={{ fontSize: 10, color: '#9a9aab', display: 'flex', gap: 4, alignItems: 'center' }}>
          <input type="checkbox" checked={scopeSection} onChange={(e) => setScopeSection(e.target.checked)} />
          This section
        </label>
        <button type="button" disabled={busy || working} style={{ fontSize: 11 }} onClick={() => void run()}>
          Find
        </button>
      </div>
      {error && <div style={{ fontSize: 11, color: '#f87171' }}>{error}</div>}
      <div style={{ maxHeight: 140, overflowY: 'auto', fontSize: 10 }}>
        {hits.length === 0 ? (
          <div style={{ color: '#9a9aab' }}>No hits yet.</div>
        ) : (
          hits.map((h) => (
            <div key={`${h.blockIndex}-${h.match}`} style={{ display: 'flex', gap: 6, alignItems: 'center', color: '#f0e6d2' }}>
              <span style={{ flex: 1 }}>
                {h.label} · {h.visibility} · {h.match}
              </span>
              <button type="button" style={{ fontSize: 10 }} onClick={() => onJump(h.blockIndex)}>
                Jump
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/** Named checkpoints with custom labels. */
export function NamedCheckpointsPanel({ busy, onDone }: { busy?: boolean; onDone: () => void }): JSX.Element {
  const [label, setLabel] = useState('')
  const [versions, setVersions] = useState<Array<{ filename: string; label?: string; isCheckpoint: boolean; timestamp: number }>>(
    [],
  )
  const [note, setNote] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  const refresh = useCallback(async () => {
    const list = await window.api.listVersions()
    setVersions(list.filter((v) => v.isCheckpoint).slice(0, 30))
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const create = async (): Promise<void> => {
    const name = label.trim() || `Checkpoint ${new Date().toLocaleString()}`
    setWorking(true)
    setNote(null)
    try {
      const res = await window.api.createCheckpoint(name)
      if (!res.ok) {
        setNote(res.error ?? 'Failed')
        return
      }
      setLabel('')
      setNote(`Saved “${name}”`)
      await refresh()
    } finally {
      setWorking(false)
    }
  }

  const restore = async (filename: string, name?: string): Promise<void> => {
    if (!window.confirm(`Restore checkpoint “${name || filename}”? Current filter is auto-saved first.`)) return
    setWorking(true)
    try {
      const res = await window.api.restoreVersion(filename)
      if (!res.ok) {
        setNote(res.error ?? 'Restore failed')
        return
      }
      setNote('Restored')
      onDone()
      await refresh()
    } finally {
      setWorking(false)
    }
  }

  return (
    <div style={panelStyle} role="region" aria-label="Named checkpoints">
      <div style={{ fontSize: 12, fontWeight: 700, color: '#f0e6d2' }}>Named checkpoints</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. pre-Soft migrate"
          style={{ ...inputStyle, flex: 1, minWidth: 140 }}
        />
        <button type="button" disabled={busy || working} style={{ fontSize: 11 }} onClick={() => void create()}>
          Save
        </button>
      </div>
      {note && <div style={{ fontSize: 11, color: '#86efac' }}>{note}</div>}
      <div style={{ maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {versions.length === 0 && <div style={{ fontSize: 11, color: '#9a9aab' }}>No checkpoints yet.</div>}
        {versions.map((v) => (
          <div key={v.filename} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11 }}>
            <span style={{ flex: 1, color: '#f0e6d2' }}>
              {v.label || v.filename} · {new Date(v.timestamp).toLocaleString()}
            </span>
            <button type="button" disabled={busy || working} style={{ fontSize: 10 }} onClick={() => void restore(v.filename, v.label)}>
              Restore
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Section-type tool suggestions. */
export function SectionTypePresetPanel({
  section,
  busy,
  onOpenTools,
  onApplyHideLow,
}: {
  section: FilterSection | null
  busy?: boolean
  onOpenTools: (tools: string[]) => void
  onApplyHideLow: () => void
}): JSX.Element {
  const preset = useMemo(() => (section ? sectionTypePresetFor(section.typePath) : null), [section])

  return (
    <div style={panelStyle} role="region" aria-label="Section type preset">
      <div style={{ fontSize: 12, fontWeight: 700, color: '#f0e6d2' }}>Section toolkit</div>
      {!section ? (
        <div style={{ fontSize: 11, color: '#9a9aab' }}>Open a section.</div>
      ) : !preset ? (
        <div style={{ fontSize: 11, color: '#9a9aab' }}>
          No specialized preset for <code>{section.typePath}</code> — use Advanced tools freely.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 11, color: '#f0e6d2' }}>
            <strong style={{ color: '#c9a227' }}>{preset.label}</strong> — {preset.hint}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" style={{ fontSize: 11 }} onClick={() => onOpenTools(preset.suggestedTools)}>
              Open suggested tools
            </button>
            {preset.hideLowTiers && (
              <button type="button" disabled={busy} style={{ fontSize: 11 }} onClick={onApplyHideLow}>
                Hide ≤C tiers
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

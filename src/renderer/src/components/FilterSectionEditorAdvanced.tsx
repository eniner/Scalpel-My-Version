import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  ComparisonOperator,
  ConditionPreset,
  FilterBlock,
  FilterChange,
  FilterCondition,
  FilterMatchResponse,
  FilterPreflightIssue,
  FilterReapplyPreview,
  FilterSection,
  FilterSectionTier,
  FilterVersion,
  FilterVersionDiff,
  ParsedClipboardItem,
} from '@shared/types'
import {
  deleteConditionPreset,
  deleteSectionTemplate,
  exportSectionTemplatesJson,
  importSectionTemplatesJson,
  loadConditionPresets,
  loadSectionTemplates,
  upsertConditionPreset,
  upsertSectionTemplate,
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

const OPS: ComparisonOperator[] = ['==', '>=', '<=', '>', '<', '=']

const ADDABLE_CONDITIONS = [
  'StackSize',
  'AreaLevel',
  'ItemLevel',
  'Quality',
  'Class',
  'Rarity',
  'Corrupted',
  'Identified',
  'LinkedSockets',
  'Sockets',
  'MemoryStrands',
  'WaystoneTier',
]

function formatCond(c: FilterCondition): string {
  const op = c.operator && c.operator !== '==' ? ` ${c.operator}` : ''
  const vals = c.values.map((v) => (v.includes(' ') ? `"${v}"` : v)).join(' ')
  return `${c.type}${op}${vals ? ` ${vals}` : ''}`
}

const RARITY_OPTIONS = ['Normal', 'Magic', 'Rare', 'Unique']
const BOOL_OPTIONS = ['True', 'False']
const NUMERIC_TYPES = new Set([
  'StackSize',
  'AreaLevel',
  'ItemLevel',
  'Quality',
  'LinkedSockets',
  'Sockets',
  'MemoryStrands',
  'WaystoneTier',
])
const BOOL_TYPES = new Set(['Corrupted', 'Identified', 'Mirrored', 'SynthesisedItem', 'FracturedItem'])

const COMMON_CLASSES = [
  'Stackable Currency',
  'Currency',
  'Divination Cards',
  'Maps',
  'Map Fragments',
  'Jewels',
  'Gems',
  'Active Skill Gems',
  'Support Skill Gems',
  'Amulets',
  'Rings',
  'Belts',
  'Gloves',
  'Boots',
  'Helmets',
  'Body Armours',
  'One Hand Swords',
  'Two Hand Swords',
  'Bows',
  'Wands',
  'Staves',
  'Quivers',
  'Shields',
  'Flasks',
  'Life Flasks',
  'Mana Flasks',
  'Hybrid Flasks',
  'Utility Flasks',
]

function ConditionValueEditor({
  cond,
  disabled,
  onChange,
}: {
  cond: FilterCondition
  disabled?: boolean
  onChange: (values: string[], operator?: ComparisonOperator) => void
}): JSX.Element {
  if (BOOL_TYPES.has(cond.type)) {
    return (
      <select
        value={cond.values[0] ?? 'True'}
        disabled={disabled}
        onChange={(e) => onChange([e.target.value], '==')}
        style={{ ...inputStyle, flex: 1, minWidth: 80 }}
        aria-label={`${cond.type} value`}
      >
        {BOOL_OPTIONS.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    )
  }
  if (cond.type === 'Rarity') {
    return (
      <select
        value={cond.values[0] ?? 'Normal'}
        disabled={disabled}
        onChange={(e) => onChange([e.target.value])}
        style={{ ...inputStyle, flex: 1, minWidth: 80 }}
        aria-label="Rarity value"
      >
        {RARITY_OPTIONS.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    )
  }
  if (cond.type === 'Class') {
    return (
      <input
        list="filter-class-options"
        value={cond.values.join(' ')}
        disabled={disabled}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(/\s+/)
              .map((v) => v.replace(/^"|"$/g, ''))
              .filter(Boolean),
          )
        }
        style={{ ...inputStyle, flex: 1, minWidth: 100 }}
        aria-label="Class value"
      />
    )
  }
  if (NUMERIC_TYPES.has(cond.type)) {
    return (
      <input
        type="number"
        value={cond.values[0] ?? '1'}
        disabled={disabled}
        onChange={(e) => onChange([e.target.value || '0'])}
        style={{ ...inputStyle, width: 72 }}
        aria-label={`${cond.type} value`}
      />
    )
  }
  return (
    <input
      value={cond.values.join(' ')}
      disabled={disabled}
      onChange={(e) =>
        onChange(
          e.target.value
            .split(/\s+/)
            .map((v) => v.replace(/^"|"$/g, ''))
            .filter(Boolean),
        )
      }
      style={{ ...inputStyle, flex: 1, minWidth: 80 }}
      aria-label={`${cond.type} values`}
    />
  )
}

/** 1. Condition inspector for an expanded tier. */
export function TierConditionInspector({
  tier,
  busy,
  onSaved,
}: {
  tier: FilterSectionTier
  busy?: boolean
  onSaved: () => void
}): JSX.Element {
  const [block, setBlock] = useState<FilterBlock | null>(null)
  const [parentConds, setParentConds] = useState<Array<{ label: string; lines: string[] }>>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [addType, setAddType] = useState('StackSize')
  const [presets, setPresets] = useState<ConditionPreset[]>(() => loadConditionPresets())
  const [presetName, setPresetName] = useState('')

  const reloadPresets = (): void => setPresets(loadConditionPresets())

  const load = useCallback(async () => {
    setError(null)
    const res = await window.api.getFilterBlock(tier.blockIndex)
    if (!res.ok || !res.block) {
      setError(res.error ?? 'Failed to load block')
      setBlock(null)
      return
    }
    setBlock(structuredClone(res.block))

    const parents = tier.continueParents ?? []
    if (parents.length === 0) {
      setParentConds([])
      return
    }
    const rows: Array<{ label: string; lines: string[] }> = []
    for (const p of parents) {
      const pr = await window.api.getFilterBlock(p.blockIndex)
      if (!pr.ok || !pr.block) continue
      rows.push({
        label: p.label,
        lines: pr.block.conditions.filter((c) => c.type !== 'BaseType').map(formatCond),
      })
    }
    setParentConds(rows)
  }, [tier.blockIndex, tier.continueParents])

  useEffect(() => {
    void load()
  }, [load])

  const nonBase = block?.conditions.filter((c) => c.type !== 'BaseType') ?? []
  const baseCond = block?.conditions.find((c) => c.type === 'BaseType')

  const updateCond = (indexInAll: number, patch: Partial<FilterCondition>): void => {
    if (!block) return
    const next = block.conditions.map((c, i) => (i === indexInAll ? { ...c, ...patch } : c))
    setBlock({ ...block, conditions: next })
  }

  const removeCond = (indexInAll: number): void => {
    if (!block) return
    const cond = block.conditions[indexInAll]
    if (cond?.type === 'BaseType') return
    setBlock({ ...block, conditions: block.conditions.filter((_, i) => i !== indexInAll) })
  }

  const addCond = (): void => {
    if (!block) return
    const type = addType
    const numeric = NUMERIC_TYPES.has(type)
    const bool = BOOL_TYPES.has(type)
    const newCond: FilterCondition = {
      type,
      operator: numeric ? '>=' : type === 'Rarity' ? '>=' : '==',
      values: bool
        ? ['True']
        : type === 'Rarity'
          ? ['Normal']
          : numeric
            ? ['1']
            : type === 'Class'
              ? ['Stackable Currency']
              : [''],
      explicitOperator: numeric || type === 'Rarity',
    }
    const baseIdx = block.conditions.findIndex((c) => c.type === 'BaseType')
    const conditions =
      baseIdx >= 0
        ? [...block.conditions.slice(0, baseIdx), newCond, ...block.conditions.slice(baseIdx)]
        : [...block.conditions, newCond]
    setBlock({ ...block, conditions })
  }

  const save = async (): Promise<void> => {
    if (!block) return
    setSaving(true)
    setError(null)
    try {
      const res = await window.api.saveBlockEdit(tier.blockIndex, block, '')
      if (!res.ok) {
        setError(res.error ?? 'Save failed')
        return
      }
      onSaved()
      await load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        marginTop: 8,
        padding: 8,
        borderRadius: 6,
        border: '1px solid rgba(201,162,39,0.25)',
        background: 'rgba(201,162,39,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
      role="region"
      aria-label={`Conditions for ${tier.label}`}
    >
      <datalist id="filter-class-options">
        {COMMON_CLASSES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#c9a227' }}>
        Conditions · {tier.label}
        {block?.continue ? ' · Continue' : ''}
      </div>
      {error && <div style={{ fontSize: 11, color: '#f87171' }}>{error}</div>}
      {!block && !error && <div style={{ fontSize: 11, color: '#9a9aab' }}>Loading…</div>}
      {block && (
        <>
          {baseCond && (
            <div style={{ fontSize: 10, color: '#9a9aab' }}>
              BaseType ({baseCond.values.length}): edit via drag / Add rule
            </div>
          )}
          {parentConds.length > 0 && (
            <div
              style={{
                fontSize: 10,
                color: '#9a9aab',
                padding: 6,
                borderRadius: 4,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div style={{ fontWeight: 600, color: '#c8c4bc', marginBottom: 4 }}>Effective via Continue parents</div>
              {parentConds.map((p) => (
                <div key={p.label} style={{ marginBottom: 4 }}>
                  <span style={{ color: '#c9a227' }}>{p.label}</span>
                  {p.lines.length > 0 ? `: ${p.lines.join(' · ')}` : ' (no extra conditions)'}
                </div>
              ))}
            </div>
          )}
          {nonBase.length === 0 && (
            <div style={{ fontSize: 11, color: '#9a9aab' }}>No non-BaseType conditions on this rule.</div>
          )}
          {block.conditions.map((c, i) => {
            if (c.type === 'BaseType') return null
            return (
              <div key={`${c.type}-${i}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#f0e6d2', minWidth: 90, fontWeight: 600 }}>{c.type}</span>
                {!BOOL_TYPES.has(c.type) && (
                  <select
                    value={c.operator}
                    disabled={busy || saving}
                    onChange={(e) =>
                      updateCond(i, { operator: e.target.value as ComparisonOperator, explicitOperator: true })
                    }
                    style={{ ...inputStyle, width: 56 }}
                    aria-label={`${c.type} operator`}
                  >
                    {OPS.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                )}
                <ConditionValueEditor
                  cond={c}
                  disabled={busy || saving}
                  onChange={(values, operator) =>
                    updateCond(i, {
                      values,
                      ...(operator ? { operator, explicitOperator: true } : {}),
                    })
                  }
                />
                <button type="button" disabled={busy || saving} onClick={() => removeCond(i)} style={{ fontSize: 10 }}>
                  Remove
                </button>
              </div>
            )
          })}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 4 }}>
            <select
              value={addType}
              onChange={(e) => setAddType(e.target.value)}
              style={inputStyle}
              aria-label="Add condition type"
            >
              {ADDABLE_CONDITIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button type="button" disabled={busy || saving} onClick={addCond} style={{ fontSize: 11 }}>
              Add condition
            </button>
            <button
              type="button"
              disabled={busy || saving}
              onClick={() => void save()}
              style={{ fontSize: 11, background: 'rgba(201,162,39,0.35)', borderColor: '#c9a227' }}
            >
              {saving ? 'Saving…' : 'Save conditions'}
            </button>
            <button type="button" disabled={busy || saving} onClick={() => void load()} style={{ fontSize: 11 }}>
              Reset
            </button>
          </div>
          <div
            style={{
              marginTop: 6,
              paddingTop: 6,
              borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 600, color: '#c9a227' }}>Condition presets</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
              <input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Preset name…"
                style={{ ...inputStyle, flex: 1, minWidth: 100 }}
              />
              <button
                type="button"
                disabled={busy || saving || nonBase.length === 0}
                onClick={() => {
                  if (!block) return
                  upsertConditionPreset(presetName || 'Preset', block.conditions)
                  setPresetName('')
                  reloadPresets()
                }}
                style={{ fontSize: 10 }}
              >
                Save current
              </button>
            </div>
            {presets.length === 0 ? (
              <div style={{ fontSize: 10, color: '#6b6b7a' }}>No saved presets yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {presets.slice(0, 12).map((p) => (
                  <div key={p.id} style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: '#f0e6d2', flex: 1 }}>{p.name}</span>
                    <span style={{ fontSize: 9, color: '#6b6b7a' }}>{p.conditions.length} cond</span>
                    <button
                      type="button"
                      disabled={busy || saving || !block}
                      style={{ fontSize: 10 }}
                      onClick={() => {
                        if (!block) return
                        const withoutNonBase = block.conditions.filter((c) => c.type === 'BaseType')
                        const applied: FilterCondition[] = p.conditions.map((c) => ({
                          type: c.type,
                          operator: c.operator as ComparisonOperator,
                          values: [...c.values],
                          explicitOperator: c.explicitOperator,
                        }))
                        const baseIdx = withoutNonBase.findIndex((c) => c.type === 'BaseType')
                        const conditions =
                          baseIdx >= 0 ? [...applied, ...withoutNonBase] : [...withoutNonBase, ...applied]
                        setBlock({ ...block, conditions })
                      }}
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      style={{ fontSize: 10 }}
                      onClick={() => {
                        deleteConditionPreset(p.id)
                        reloadPresets()
                      }}
                    >
                      Del
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/** Compact condition chips on tier header. */
export function ConditionSummaryChips({ tier }: { tier: FilterSectionTier }): JSX.Element | null {
  const [chips, setChips] = useState<string[]>([])
  useEffect(() => {
    let cancelled = false
    void window.api.getFilterBlock(tier.blockIndex).then((res) => {
      if (cancelled || !res.ok || !res.block) return
      setChips(
        res.block.conditions
          .filter((c) => c.type !== 'BaseType')
          .map(formatCond)
          .slice(0, 6),
      )
    })
    return () => {
      cancelled = true
    }
  }, [tier.blockIndex, tier.itemCount, tier.visibility])
  if (chips.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, marginLeft: 40 }}>
      {chips.map((c) => (
        <span
          key={c}
          style={{
            fontSize: 9,
            padding: '1px 6px',
            borderRadius: 4,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#9a9aab',
          }}
        >
          {c}
        </span>
      ))}
    </div>
  )
}

/** 2. Match debugger — what wins for an item. */
export function MatchDebuggerPanel({
  sections,
  busy,
  onJump,
  onRefresh,
}: {
  sections: FilterSection[]
  busy?: boolean
  onJump?: (blockIndex: number) => void
  onRefresh?: () => void
}): JSX.Element {
  const [baseType, setBaseType] = useState('')
  const [stackSize, setStackSize] = useState('1')
  const [itemClass, setItemClass] = useState('')
  const [rarity, setRarity] = useState('')
  const [clipboardText, setClipboardText] = useState('')
  const [pasteNote, setPasteNote] = useState<string | null>(null)
  const [result, setResult] = useState<FilterMatchResponse | null>(null)
  const [running, setRunning] = useState(false)
  const [fixNote, setFixNote] = useState<string | null>(null)

  useEffect(() => {
    const onInspect = (ev: Event): void => {
      const detail = (ev as CustomEvent<ParsedClipboardItem>).detail
      if (!detail?.ok) return
      if (detail.baseType) setBaseType(detail.baseType)
      if (detail.itemClass) setItemClass(detail.itemClass)
      if (detail.rarity) setRarity(detail.rarity)
      if (detail.stackSize) setStackSize(String(detail.stackSize))
      setPasteNote(`Using ${detail.name || detail.baseType || 'item'} (filmstrip)`)
      setClipboardText('')
      void (async () => {
        setRunning(true)
        setFixNote(null)
        try {
          const res = await window.api.matchFilterItem({
            baseType: detail.baseType ?? '',
            itemClass: detail.itemClass,
            rarity: detail.rarity,
            stackSize: detail.stackSize,
            itemLevel: detail.itemLevel,
            quality: detail.quality,
            areaLevel: detail.areaLevel,
            corrupted: detail.corrupted,
            identified: detail.identified,
            includeShadowed: true,
          })
          setResult(res)
        } finally {
          setRunning(false)
        }
      })()
    }
    window.addEventListener('scalpel-inspect-item', onInspect)
    return () => window.removeEventListener('scalpel-inspect-item', onInspect)
  }, [])

  const catalogHint = useMemo(() => {
    const q = baseType.trim().toLowerCase()
    if (q.length < 2) return []
    const hits: string[] = []
    for (const s of sections) {
      for (const t of s.tiers) {
        for (const b of t.baseTypes) {
          if (b.toLowerCase().includes(q) && !hits.includes(b)) hits.push(b)
          if (hits.length >= 8) return hits
        }
      }
    }
    return hits
  }, [baseType, sections])

  const applyParsed = (parsed: {
    baseType?: string
    name?: string
    itemClass?: string
    rarity?: string
    stackSize?: number
  }): void => {
    if (parsed.baseType) setBaseType(parsed.baseType)
    if (parsed.itemClass) setItemClass(parsed.itemClass)
    if (parsed.rarity) setRarity(parsed.rarity)
    if (parsed.stackSize) setStackSize(String(parsed.stackSize))
    setPasteNote(
      `Using ${parsed.name || parsed.baseType || 'item'}${parsed.itemClass ? ` · ${parsed.itemClass}` : ''}${
        parsed.rarity ? ` · ${parsed.rarity}` : ''
      }`,
    )
  }

  const fromGame = async (): Promise<void> => {
    setPasteNote(null)
    try {
      const parsed = await window.api.getLastEvaluatedItem()
      if (!parsed.ok) {
        setPasteNote(parsed.error ?? 'No in-game item yet')
        return
      }
      applyParsed(parsed)
      setClipboardText('')
      setRunning(true)
      try {
        const res = await window.api.matchFilterItem({
          baseType: parsed.baseType ?? '',
          itemClass: parsed.itemClass,
          rarity: parsed.rarity,
          stackSize: parsed.stackSize,
          itemLevel: parsed.itemLevel,
          quality: parsed.quality,
          areaLevel: parsed.areaLevel,
          corrupted: parsed.corrupted,
          identified: parsed.identified,
          includeShadowed: true,
        })
        setResult(res)
      } finally {
        setRunning(false)
      }
    } catch (err) {
      setPasteNote(String(err))
    }
  }

  const pasteFromClipboard = async (): Promise<void> => {
    setPasteNote(null)
    try {
      let text = ''
      try {
        text = await navigator.clipboard.readText()
      } catch {
        /* fall through */
      }
      if (!text && window.api.pluginReadClipboardText) {
        text = (await window.api.pluginReadClipboardText()) ?? ''
      }
      if (!text.trim()) {
        setPasteNote('Clipboard empty — Ctrl+C an item in PoE first')
        return
      }
      setClipboardText(text)
      const parsed = await window.api.parseItemText(text)
      if (!parsed.ok) {
        setPasteNote(parsed.error ?? 'Not a PoE item')
        return
      }
      applyParsed(parsed)
    } catch (err) {
      setPasteNote(String(err))
    }
  }

  const onPasteArea = async (text: string): Promise<void> => {
    setClipboardText(text)
    if (!text.includes('--------')) {
      setPasteNote(null)
      return
    }
    const parsed = await window.api.parseItemText(text)
    if (parsed.ok) applyParsed(parsed)
    else setPasteNote(parsed.error ?? 'Parse failed')
  }

  const run = async (): Promise<void> => {
    setRunning(true)
    setFixNote(null)
    try {
      const res = await window.api.matchFilterItem(
        clipboardText.includes('--------')
          ? { baseType: baseType.trim() || 'x', clipboardText, includeShadowed: true }
          : {
              baseType: baseType.trim(),
              stackSize: Math.max(1, parseInt(stackSize, 10) || 1),
              itemClass: itemClass.trim() || undefined,
              rarity: rarity.trim() || undefined,
              includeShadowed: true,
            },
      )
      setResult(res)
    } finally {
      setRunning(false)
    }
  }

  const makeThisWin = async (step: NonNullable<FilterMatchResponse['steps']>[number]): Promise<void> => {
    const winner = result?.steps.find((s) => s.isWinner)
    const bt = baseType.trim()
    if (!winner || !bt || step.isWinner) return
    let typePath = step.typePath
    let tier = step.tier || 'promoted'
    if (!typePath) {
      const hit = sections.find((s) => s.tiers.some((t) => t.baseTypes.includes(bt)))
      typePath = hit?.typePath
      if (!tier || tier === 'promoted') {
        const t = hit?.tiers.find((x) => x.baseTypes.includes(bt))
        if (t) tier = t.tier
      }
    }
    if (!typePath) {
      setFixNote('Need a $type section for this rule — open a NeverSink-tagged tier')
      return
    }
    setRunning(true)
    setFixNote(null)
    try {
      const res = await window.api.insertSectionRule({
        typePath,
        tier: `${tier}-win`.replace(/\s+/g, '').toLowerCase(),
        baseType: bt,
        beforeBlockIndex: winner.blockIndex,
        visibility: 'Show',
        copyStyleFromIndex: step.blockIndex,
        cloneConditions: true,
      })
      if (!res.ok) {
        setFixNote(res.error ?? 'Insert failed')
        return
      }
      setFixNote(`Inserted Show rule above winner (cloned style from ${step.label})`)
      onRefresh?.()
      await run()
    } finally {
      setRunning(false)
    }
  }

  return (
    <div style={panelStyle} role="region" aria-label="Match debugger">
      <div style={{ fontSize: 12, fontWeight: 700, color: '#f0e6d2' }}>What wins?</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <button
          type="button"
          disabled={busy || running}
          onClick={() => void pasteFromClipboard()}
          style={{ fontSize: 11 }}
        >
          Paste PoE item
        </button>
        <button
          type="button"
          disabled={busy || running}
          onClick={() => void fromGame()}
          style={{ fontSize: 11, background: 'rgba(201,162,39,0.25)', borderColor: '#c9a227' }}
          title="Use the last item Scalpel evaluated from Ctrl+C in-game"
        >
          From game
        </button>
        <span style={{ fontSize: 10, color: '#6b6b7a' }}>or paste into the box below</span>
      </div>
      <textarea
        value={clipboardText}
        onChange={(e) => void onPasteArea(e.target.value)}
        placeholder="Paste Ctrl+C item text here…"
        rows={3}
        aria-label="PoE item clipboard text"
        style={{ ...inputStyle, width: '100%', resize: 'vertical', fontFamily: 'ui-monospace, monospace' }}
      />
      {pasteNote && <div style={{ fontSize: 11, color: '#86efac' }}>{pasteNote}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <input
          list="match-debugger-bases"
          value={baseType}
          onChange={(e) => {
            setBaseType(e.target.value)
            setClipboardText('')
          }}
          placeholder="BaseType…"
          style={{ ...inputStyle, flex: 1, minWidth: 140 }}
          aria-label="BaseType to match"
        />
        <datalist id="match-debugger-bases">
          {catalogHint.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <input
          value={stackSize}
          onChange={(e) => setStackSize(e.target.value)}
          placeholder="Stack"
          style={{ ...inputStyle, width: 56 }}
          aria-label="Stack size"
          title="Stack size"
        />
        <input
          value={itemClass}
          onChange={(e) => setItemClass(e.target.value)}
          placeholder="Class (opt)"
          style={{ ...inputStyle, width: 110 }}
          aria-label="Item class"
        />
        <select
          value={rarity}
          onChange={(e) => setRarity(e.target.value)}
          style={{ ...inputStyle, width: 90 }}
          aria-label="Rarity"
        >
          <option value="">Rarity…</option>
          {RARITY_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy || running || (!baseType.trim() && !clipboardText.includes('--------'))}
          onClick={() => void run()}
          style={{ fontSize: 11 }}
        >
          {running ? '…' : 'Match'}
        </button>
      </div>
      {fixNote && <div style={{ fontSize: 11, color: '#86efac' }}>{fixNote}</div>}
      {result && !result.ok && <div style={{ fontSize: 11, color: '#f87171' }}>{result.error}</div>}
      {result?.ok && result.steps.length === 0 && (
        <div style={{ fontSize: 11, color: '#9a9aab' }}>No matching rules — item would use default / fallthrough.</div>
      )}
      {result?.ok && result.steps.length > 0 && (
        <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ fontSize: 10, color: '#6b6b7a', marginBottom: 4 }}>
            File order · Continue → ★ winner · later matches are shadowed · Make this win inserts above ★
          </div>
          {result.steps.map((step, idx) => (
            <div
              key={`${step.blockIndex}-${step.isWinner}-${idx}`}
              style={{
                padding: '6px 6px 6px 10px',
                borderLeft: step.isWinner
                  ? '3px solid #c9a227'
                  : step.shadowed
                    ? '3px solid rgba(248,113,113,0.55)'
                    : step.continue
                      ? '3px solid rgba(147,197,253,0.55)'
                      : '3px solid rgba(255,255,255,0.12)',
                background: step.isWinner
                  ? 'rgba(201,162,39,0.12)'
                  : step.shadowed
                    ? 'rgba(248,113,113,0.06)'
                    : 'transparent',
                opacity: step.shadowed ? 0.75 : 1,
                marginBottom: 4,
                borderRadius: 2,
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong
                  style={{ fontSize: 11, color: step.isWinner ? '#c9a227' : step.shadowed ? '#fca5a5' : '#f0e6d2' }}
                >
                  {step.isWinner ? '★ Winner' : step.shadowed ? 'Shadowed' : step.continue ? 'Continue' : 'Match'} ·{' '}
                  {step.visibility}
                </strong>
                <span style={{ fontSize: 11, color: '#9a9aab' }}>{step.label}</span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                  {!step.isWinner && baseType.trim() && (
                    <button
                      type="button"
                      disabled={busy || running}
                      style={{ fontSize: 10, background: 'rgba(201,162,39,0.25)', borderColor: '#c9a227' }}
                      title="Insert a Show rule for this item above the current winner, cloning this step’s style"
                      onClick={() => void makeThisWin(step)}
                    >
                      Make this win
                    </button>
                  )}
                  {onJump && (
                    <button type="button" style={{ fontSize: 10 }} onClick={() => onJump(step.blockIndex)}>
                      Jump
                    </button>
                  )}
                </span>
              </div>
              <div style={{ fontSize: 10, color: '#6b6b7a', marginTop: 2 }}>{step.styleSummary}</div>
              <div style={{ fontSize: 10, color: '#9a9aab', marginTop: 2 }}>
                {step.conditions
                  .map(
                    (c) =>
                      `${c.result === 'pass' ? '✓' : '✗'} ${c.type}${c.operator !== '==' ? c.operator : ''} ${c.values.join(' ')}`,
                  )
                  .join(' · ')}
              </div>
            </div>
          ))}
        </div>
      )}
      {result?.ok && result.breakpoints && result.breakpoints.length > 0 && (
        <div style={{ fontSize: 10, color: '#9a9aab' }}>
          Stack ranges:{' '}
          {result.breakpoints.map((bp) => `${bp.min}–${bp.max === 9999 ? '∞' : bp.max}: ${bp.label}`).join(' · ')}
        </div>
      )}
    </div>
  )
}

/** 3. Safe re-apply onto updated online Strictness. */
export function ReapplyPanel({ busy, onDone }: { busy?: boolean; onDone: () => void }): JSX.Element {
  const [preview, setPreview] = useState<FilterReapplyPreview | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [preflightWarn, setPreflightWarn] = useState<string | null>(null)

  const loadPreview = async (): Promise<void> => {
    setWorking(true)
    setMsg(null)
    try {
      const res = await window.api.previewFilterReapply()
      setPreview(res)
      if (!res.ok) setMsg(res.error ?? 'Preview failed')
    } finally {
      setWorking(false)
    }
  }

  const apply = async (): Promise<void> => {
    if (!preview?.ok) return
    setWorking(true)
    setPreflightWarn(null)
    try {
      const pf = await window.api.preflightFilterCheck()
      const errors = pf.issues.filter((i) => i.severity === 'error')
      const warns = pf.issues.filter((i) => i.severity === 'warn')
      if (errors.length > 0) {
        setPreflightWarn(
          `Preflight blocked: ${errors.length} error(s) — ${errors
            .slice(0, 2)
            .map((e) => e.message)
            .join('; ')}. Fix via Preflight panel.`,
        )
        return
      }
      if (warns.length > 0) {
        if (
          !window.confirm(
            `Preflight found ${warns.length} warning(s).\n\nContinue re-apply onto “${preview.onlineFilterName}”?`,
          )
        ) {
          return
        }
      } else if (
        !window.confirm(
          `Re-apply ${preview.intentCount} recorded edit(s) onto “${preview.onlineFilterName}”?\n\nThis updates your local filter file only — it will NOT switch the in-game filter.`,
        )
      ) {
        return
      }
      const res = await window.api.applyFilterReapply()
      if (!res.ok) {
        setMsg(res.error ?? 'Apply failed')
        return
      }
      setMsg(
        `Applied ${res.applied ?? 0} · skipped ${res.skipped ?? 0}${
          res.skippedForValidity ? ` · ${res.skippedForValidity} dropped for validity` : ''
        }`,
      )
      onDone()
      await loadPreview()
    } finally {
      setWorking(false)
    }
  }

  useEffect(() => {
    void loadPreview()
  }, [])

  return (
    <div style={panelStyle} role="region" aria-label="Re-apply edits onto upstream">
      <div style={{ fontSize: 12, fontWeight: 700, color: '#f0e6d2' }}>Re-apply onto updated filter</div>
      <div style={{ fontSize: 11, color: '#9a9aab' }}>
        Replays your recorded section edits onto the matching OnlineFilters copy. Does not switch in-game. Runs
        preflight first.
      </div>
      {preflightWarn && <div style={{ fontSize: 11, color: '#fbbf24' }}>{preflightWarn}</div>}
      {msg && (
        <div style={{ fontSize: 11, color: msg.includes('fail') || msg.includes('No ') ? '#f87171' : '#86efac' }}>
          {msg}
        </div>
      )}
      {preview?.ok && (
        <div style={{ fontSize: 11, color: '#f0e6d2' }}>
          Source: <strong style={{ color: '#c9a227' }}>{preview.onlineFilterName ?? '—'}</strong>
          {' · '}
          {preview.intentCount} intent{preview.intentCount === 1 ? '' : 's'}
          {' · '}
          preview apply {preview.applied} / skip {preview.skipped}
        </div>
      )}
      {preview?.ok && preview.conflicts.length > 0 && (
        <div style={{ maxHeight: 100, overflowY: 'auto', fontSize: 10, color: '#fca5a5' }}>
          {preview.conflicts.slice(0, 20).map((c, i) => (
            <div key={`${c.description}-${i}`}>{c.description}</div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" disabled={busy || working} onClick={() => void loadPreview()} style={{ fontSize: 11 }}>
          Refresh preview
        </button>
        <button
          type="button"
          disabled={busy || working || !preview?.ok || (preview.intentCount === 0 && !preview.onlineFilterName)}
          onClick={() => void apply()}
          style={{ fontSize: 11, background: 'rgba(201,162,39,0.3)', borderColor: '#c9a227' }}
        >
          Apply re-apply
        </button>
      </div>
    </div>
  )
}

/** 4. Diff vs checkpoint + session edits + restore. */
export function DiffRollbackPanel({ busy, onRestored }: { busy?: boolean; onRestored: () => void }): JSX.Element {
  const [changes, setChanges] = useState<FilterChange[]>([])
  const [versions, setVersions] = useState<FilterVersion[]>([])
  const [selected, setSelected] = useState('')
  const [diff, setDiff] = useState<FilterVersionDiff | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const [ch, vers] = await Promise.all([window.api.getFilterChanges(), window.api.listVersions()])
    setChanges(ch)
    setVersions(vers)
    if (!selected && vers[0]) setSelected(vers[0].filename)
  }, [selected])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const runDiff = async (): Promise<void> => {
    if (!selected) return
    setWorking(true)
    setError(null)
    try {
      const res = await window.api.diffFilterVsVersion(selected)
      setDiff(res)
      if (!res.ok) setError(res.error ?? 'Diff failed')
    } finally {
      setWorking(false)
    }
  }

  const restore = async (): Promise<void> => {
    if (!selected) return
    if (!window.confirm('Restore this version? Current filter will be auto-saved first.')) return
    setWorking(true)
    setError(null)
    try {
      const res = await window.api.restoreVersion(selected, '')
      if (!res.ok) {
        setError(res.error ?? 'Restore failed')
        return
      }
      onRestored()
      await refresh()
      setDiff(null)
    } finally {
      setWorking(false)
    }
  }

  const checkpoints = versions.filter((v) => v.isCheckpoint)
  const recent = versions.slice(0, 12)

  return (
    <div style={panelStyle} role="region" aria-label="Diff and rollback">
      <div style={{ fontSize: 12, fontWeight: 700, color: '#f0e6d2' }}>Diff & rollback</div>

      <div style={{ fontSize: 11, fontWeight: 600, color: '#c9a227' }}>Session edits ({changes.length})</div>
      <div style={{ maxHeight: 90, overflowY: 'auto', fontSize: 10, color: '#9a9aab' }}>
        {changes.length === 0 ? (
          <div>No recorded intents yet — edits that record intents will appear here.</div>
        ) : (
          changes.slice(0, 25).map((c) => (
            <div key={c.id}>
              {c.description}
              {c.itemName ? ` · ${c.itemName}` : ''}
            </div>
          ))
        )}
      </div>

      <div style={{ fontSize: 11, fontWeight: 600, color: '#c9a227' }}>Compare to version</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 160 }}
          aria-label="Version to compare"
        >
          {recent.length === 0 && <option value="">No versions</option>}
          {recent.map((v) => (
            <option key={v.filename} value={v.filename}>
              {v.isCheckpoint ? '★ ' : ''}
              {v.label || (v.isCheckpoint ? 'Checkpoint' : 'Auto')} · {new Date(v.timestamp).toLocaleString()}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy || working || !selected}
          onClick={() => void runDiff()}
          style={{ fontSize: 11 }}
        >
          Diff
        </button>
        <button
          type="button"
          disabled={busy || working || !selected}
          onClick={() => void restore()}
          style={{ fontSize: 11 }}
        >
          Restore
        </button>
      </div>
      {checkpoints.length > 0 && (
        <div style={{ fontSize: 10, color: '#6b6b7a' }}>{checkpoints.length} checkpoint(s) available</div>
      )}
      {error && <div style={{ fontSize: 11, color: '#f87171' }}>{error}</div>}
      {diff?.ok && (
        <div style={{ maxHeight: 140, overflowY: 'auto', fontSize: 10, color: '#f0e6d2' }}>
          <div style={{ color: '#9a9aab', marginBottom: 4 }}>
            {diff.changedSectionCount === 0
              ? 'No section differences'
              : `${diff.changedSectionCount} section(s) differ`}
          </div>
          {diff.sections.slice(0, 20).map((s) => (
            <div key={s.typePath} style={{ marginBottom: 6 }}>
              <strong style={{ color: '#c9a227' }}>{s.title}</strong>
              {s.onlyCurrent.length > 0 && (
                <div style={{ color: '#86efac' }}>
                  + {s.onlyCurrent.slice(0, 8).join(', ')}
                  {s.onlyCurrent.length > 8 ? '…' : ''}
                </div>
              )}
              {s.onlyOther.length > 0 && (
                <div style={{ color: '#fca5a5' }}>
                  − {s.onlyOther.slice(0, 8).join(', ')}
                  {s.onlyOther.length > 8 ? '…' : ''}
                </div>
              )}
              {s.visibilityChanges.map((v) => (
                <div key={v.tier} style={{ color: '#fcd34d' }}>
                  {v.tier}: {v.other} → {v.current}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export type EditorWorkbenchMode = 'browse' | 'edit' | 'advanced' | 'guide'

/** 5. Strictness / profile filter-to-filter section diff. */
export function StrictnessDiffPanel({ busy, onDone }: { busy?: boolean; onDone?: () => void }): JSX.Element {
  const [entries, setEntries] = useState<Array<{ path: string; name: string; online: boolean }>>([])
  const [leftPath, setLeftPath] = useState('')
  const [rightPath, setRightPath] = useState('')
  const [diff, setDiff] = useState<FilterVersionDiff | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [addMissing, setAddMissing] = useState(true)
  const [applyVis, setApplyVis] = useState(true)
  const [removeExtras, setRemoveExtras] = useState(false)
  const [applyNote, setApplyNote] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const settings = await window.api.getSettings()
        const dir = settings.activeProfile?.filterDir
        if (!dir) return
        const list = await window.api.scanFilterDir(dir)
        setEntries(list)
        const local = list.filter((e) => !e.online)
        const online = list.filter((e) => e.online)
        const current = settings.activeProfile?.filterPath
        if (current) setLeftPath(current)
        else if (local[0]) setLeftPath(local[0].path)
        const soft =
          online.find((e) => /soft/i.test(e.name)) ||
          local.find((e) => e.path !== current && /soft/i.test(e.name)) ||
          online[0] ||
          local.find((e) => e.path !== (current || local[0]?.path))
        if (soft) setRightPath(soft.path)
      } catch {
        /* ignore */
      }
    })()
  }, [])

  const run = async (): Promise<void> => {
    if (!leftPath || !rightPath) return
    setWorking(true)
    setError(null)
    setApplyNote(null)
    try {
      const res = await window.api.diffFilterFiles(leftPath, rightPath)
      setDiff(res)
      if (!res.ok) setError(res.error ?? 'Diff failed')
      else setSelected(new Set(res.sections.map((s) => s.typePath)))
    } finally {
      setWorking(false)
    }
  }

  const toggleSel = (typePath: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(typePath)) next.delete(typePath)
      else next.add(typePath)
      return next
    })
  }

  const applySelected = async (): Promise<void> => {
    if (!diff?.ok || selected.size === 0) return
    if (!addMissing && !applyVis && !removeExtras) {
      setApplyNote('Pick at least one apply option')
      return
    }
    if (
      !window.confirm(
        `Apply deltas from right → left for ${selected.size} section(s)?\n\nAdds: ${addMissing ? 'yes' : 'no'} · Visibility: ${
          applyVis ? 'yes' : 'no'
        } · Remove extras: ${removeExtras ? 'yes' : 'no'}`,
      )
    ) {
      return
    }
    setWorking(true)
    setApplyNote(null)
    try {
      let added = 0
      let removed = 0
      let visibilityChanged = 0
      const fails: string[] = []
      for (const typePath of selected) {
        const res = await window.api.applySectionDelta({
          typePath,
          sourcePath: rightPath,
          addMissingFromSource: addMissing,
          applyVisibilityFromSource: applyVis,
          removeExtrasNotInSource: removeExtras,
        })
        if (!res.ok) fails.push(`${typePath}: ${res.error}`)
        else {
          added += res.added
          removed += res.removed
          visibilityChanged += res.visibilityChanged
        }
      }
      setApplyNote(
        fails.length
          ? `Partial: +${added} −${removed} vis ${visibilityChanged}. Failures: ${fails.slice(0, 2).join('; ')}`
          : `Applied +${added} BaseTypes · −${removed} · ${visibilityChanged} visibility change(s)`,
      )
      onDone?.()
      await run()
    } finally {
      setWorking(false)
    }
  }

  return (
    <div style={panelStyle} role="region" aria-label="Strictness filter diff">
      <div style={{ fontSize: 12, fontWeight: 700, color: '#f0e6d2' }}>Strictness / filter diff</div>
      <div style={{ fontSize: 11, color: '#9a9aab' }}>
        Compare two filters, then apply selected section deltas from right → left (usually Soft → your filter).
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <select
          value={leftPath}
          onChange={(e) => setLeftPath(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 140 }}
          aria-label="Left filter"
        >
          <option value="">Left…</option>
          {entries.map((e) => (
            <option key={`L-${e.path}`} value={e.path}>
              {e.online ? '☁ ' : ''}
              {e.name}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 11, color: '#6b6b7a' }}>vs</span>
        <select
          value={rightPath}
          onChange={(e) => setRightPath(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 140 }}
          aria-label="Right filter"
        >
          <option value="">Right…</option>
          {entries.map((e) => (
            <option key={`R-${e.path}`} value={e.path}>
              {e.online ? '☁ ' : ''}
              {e.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy || working || !leftPath || !rightPath}
          onClick={() => void run()}
          style={{ fontSize: 11 }}
        >
          Diff
        </button>
      </div>
      {error && <div style={{ fontSize: 11, color: '#f87171' }}>{error}</div>}
      {applyNote && <div style={{ fontSize: 11, color: '#86efac' }}>{applyNote}</div>}
      {diff?.ok && (
        <>
          <div
            style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', fontSize: 11, color: '#f0e6d2' }}
          >
            <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="checkbox" checked={addMissing} onChange={(e) => setAddMissing(e.target.checked)} />
              Add BaseTypes from right
            </label>
            <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="checkbox" checked={applyVis} onChange={(e) => setApplyVis(e.target.checked)} />
              Match visibility
            </label>
            <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="checkbox" checked={removeExtras} onChange={(e) => setRemoveExtras(e.target.checked)} />
              Remove left-only
            </label>
            <button
              type="button"
              disabled={busy || working || selected.size === 0}
              onClick={() => void applySelected()}
              style={{ fontSize: 11, background: 'rgba(201,162,39,0.3)', borderColor: '#c9a227' }}
            >
              Apply selected ({selected.size})
            </button>
          </div>
          <div style={{ maxHeight: 180, overflowY: 'auto', fontSize: 10, color: '#f0e6d2' }}>
            <div style={{ color: '#9a9aab', marginBottom: 4 }}>
              {diff.leftLabel} vs {diff.rightLabel} ·{' '}
              {diff.changedSectionCount === 0 ? 'identical sections' : `${diff.changedSectionCount} section(s) differ`}
            </div>
            {diff.sections.slice(0, 40).map((s) => (
              <div key={s.typePath} style={{ marginBottom: 6 }}>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" checked={selected.has(s.typePath)} onChange={() => toggleSel(s.typePath)} />
                  <strong style={{ color: '#c9a227' }}>{s.title}</strong>
                </label>
                {s.onlyCurrent.length > 0 && (
                  <div style={{ color: '#86efac', paddingLeft: 22 }}>
                    only left: {s.onlyCurrent.slice(0, 8).join(', ')}
                    {s.onlyCurrent.length > 8 ? '…' : ''}
                  </div>
                )}
                {s.onlyOther.length > 0 && (
                  <div style={{ color: '#fca5a5', paddingLeft: 22 }}>
                    only right: {s.onlyOther.slice(0, 8).join(', ')}
                    {s.onlyOther.length > 8 ? '…' : ''}
                  </div>
                )}
                {s.visibilityChanges.map((v) => (
                  <div key={v.tier} style={{ color: '#fcd34d', paddingLeft: 22 }}>
                    {v.tier}: {v.other} → {v.current}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** 4b. Per-section change summary from recorded intents. */
export function SectionChangesPanel({
  sections,
  busy,
  activeTypePath,
  onJumpSection,
  onUndoLast,
  onUndoSection,
}: {
  sections: FilterSection[]
  busy?: boolean
  activeTypePath?: string | null
  onJumpSection: (typePath: string) => void
  onUndoLast: () => void
  onUndoSection?: (typePath: string) => void
}): JSX.Element {
  const [changes, setChanges] = useState<FilterChange[]>([])
  const titleOf = useMemo(() => {
    const m = new Map(sections.map((s) => [s.typePath, s.title]))
    return (path: string) => m.get(path) ?? path
  }, [sections])

  const refresh = useCallback(async () => {
    setChanges(await window.api.getFilterChanges())
  }, [])

  useEffect(() => {
    void refresh()
    const t = window.setInterval(() => void refresh(), 4000)
    return () => window.clearInterval(t)
  }, [refresh])

  const grouped = useMemo(() => {
    const map = new Map<string, FilterChange[]>()
    for (const c of changes) {
      const key = c.typePath || '__unknown__'
      const list = map.get(key) ?? []
      list.push(c)
      map.set(key, list)
    }
    return [...map.entries()].sort((a, b) => titleOf(a[0]).localeCompare(titleOf(b[0])))
  }, [changes, titleOf])

  const activeCount = activeTypePath ? (grouped.find(([p]) => p === activeTypePath)?.[1].length ?? 0) : 0

  return (
    <div style={panelStyle} role="region" aria-label="Section changes">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#f0e6d2' }}>What I changed</div>
        <button type="button" disabled={busy} onClick={() => void refresh()} style={{ fontSize: 10 }}>
          Refresh
        </button>
        <button
          type="button"
          disabled={busy || changes.length === 0}
          onClick={onUndoLast}
          style={{ fontSize: 10, marginLeft: 'auto' }}
        >
          Undo last
        </button>
        {activeTypePath && onUndoSection && (
          <button
            type="button"
            disabled={busy || activeCount === 0}
            onClick={() => onUndoSection(activeTypePath)}
            style={{ fontSize: 10 }}
            title="Undo recent history snapshots while this section still has recorded intents (approximate)"
          >
            Undo section ({activeCount})
          </button>
        )}
      </div>
      {grouped.length === 0 ? (
        <div style={{ fontSize: 11, color: '#9a9aab' }}>No recorded section edits yet.</div>
      ) : (
        <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {grouped.map(([typePath, rows]) => (
            <div key={typePath}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <strong style={{ fontSize: 11, color: typePath === activeTypePath ? '#f0e6d2' : '#c9a227' }}>
                  {titleOf(typePath)} ({rows.length})
                </strong>
                {typePath !== '__unknown__' && (
                  <button type="button" style={{ fontSize: 10 }} onClick={() => onJumpSection(typePath)}>
                    Jump
                  </button>
                )}
              </div>
              {rows.slice(0, 8).map((c) => (
                <div key={c.id} style={{ fontSize: 10, color: '#9a9aab', paddingLeft: 4 }}>
                  {c.tier ? `${c.tier}: ` : ''}
                  {c.description}
                  {c.itemName ? ` · ${c.itemName}` : ''}
                </div>
              ))}
              {rows.length > 8 && (
                <div style={{ fontSize: 10, color: '#6b6b7a', paddingLeft: 4 }}>…and {rows.length - 8} more</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Batch apply preset / visibility across selected tiers. */
export function BatchConditionPanel({
  section,
  busy,
  onDone,
}: {
  section: FilterSection | null
  busy?: boolean
  onDone: () => void
}): JSX.Element {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [presetId, setPresetId] = useState('')
  const [vis, setVis] = useState<'' | 'Show' | 'Hide'>('')
  const [stackOp, setStackOp] = useState('>=')
  const [stackVal, setStackVal] = useState('')
  const [presets, setPresets] = useState(() => loadConditionPresets())
  const [note, setNote] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    setSelected(new Set())
    setNote(null)
    setPresets(loadConditionPresets())
  }, [section?.typePath])

  if (!section) {
    return (
      <div style={panelStyle}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#f0e6d2' }}>Batch apply</div>
        <div style={{ fontSize: 11, color: '#9a9aab' }}>Open a section first.</div>
      </div>
    )
  }

  const toggle = (blockIndex: number): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(blockIndex)) next.delete(blockIndex)
      else next.add(blockIndex)
      return next
    })
  }

  const selectAll = (): void => setSelected(new Set(section.tiers.map((t) => t.blockIndex)))

  const apply = async (): Promise<void> => {
    if (selected.size === 0) return
    const preset = presets.find((p) => p.id === presetId)
    if (!preset && !vis && !stackVal.trim()) {
      setNote('Choose a preset, visibility, and/or StackSize')
      return
    }
    setWorking(true)
    setNote(null)
    try {
      let n = 0
      for (const blockIndex of selected) {
        if (vis) {
          const r = await window.api.setSectionTierVisibility(blockIndex, vis)
          if (r.ok) n++
        }
        const res = await window.api.getFilterBlock(blockIndex)
        if (!res.ok || !res.block) continue
        let block = { ...res.block, conditions: [...res.block.conditions], actions: [...res.block.actions] }
        let changed = false
        if (preset) {
          const base = block.conditions.filter((c) => c.type === 'BaseType')
          const nonBase = preset.conditions
            .filter((c) => c.type !== 'BaseType')
            .map((c) => ({ ...c, values: [...c.values] })) as FilterCondition[]
          block = { ...block, conditions: [...nonBase, ...base] }
          changed = true
        }
        if (stackVal.trim()) {
          const v = stackVal.trim()
          const withoutStack = block.conditions.filter((c) => c.type !== 'StackSize')
          const baseIdx = withoutStack.findIndex((c) => c.type === 'BaseType')
          const stackCond: FilterCondition = {
            type: 'StackSize',
            operator: stackOp as ComparisonOperator,
            values: [v],
            explicitOperator: true,
          }
          const conditions =
            baseIdx >= 0
              ? [...withoutStack.slice(0, baseIdx), stackCond, ...withoutStack.slice(baseIdx)]
              : [...withoutStack, stackCond]
          block = { ...block, conditions }
          changed = true
        }
        if (changed) {
          const save = await window.api.saveBlockEdit(blockIndex, block, '')
          if (save.ok) n++
        }
      }
      setNote(`Updated ${n} tier action(s)`)
      onDone()
    } finally {
      setWorking(false)
    }
  }

  return (
    <div style={panelStyle} role="region" aria-label="Batch condition apply">
      <div style={{ fontSize: 12, fontWeight: 700, color: '#f0e6d2' }}>Batch apply</div>
      <div style={{ fontSize: 11, color: '#9a9aab' }}>
        Apply a preset, StackSize, and/or Show/Hide to many tiers at once.
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" style={{ fontSize: 10 }} onClick={selectAll}>
          Select all tiers
        </button>
        <button type="button" style={{ fontSize: 10 }} onClick={() => setSelected(new Set())}>
          Clear
        </button>
      </div>
      <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {section.tiers.map((t) => (
          <label
            key={t.blockIndex}
            style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: '#f0e6d2' }}
          >
            <input type="checkbox" checked={selected.has(t.blockIndex)} onChange={() => toggle(t.blockIndex)} />
            {t.label} · {t.visibility}
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <select
          value={presetId}
          onChange={(e) => setPresetId(e.target.value)}
          style={{ ...inputStyle, minWidth: 120 }}
          aria-label="Preset"
        >
          <option value="">Preset…</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={vis}
          onChange={(e) => setVis(e.target.value as '' | 'Show' | 'Hide')}
          style={inputStyle}
          aria-label="Visibility"
        >
          <option value="">Visibility…</option>
          <option value="Show">Show</option>
          <option value="Hide">Hide</option>
        </select>
        <select
          value={stackOp}
          onChange={(e) => setStackOp(e.target.value)}
          style={{ ...inputStyle, width: 56 }}
          aria-label="Stack op"
        >
          {OPS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <input
          value={stackVal}
          onChange={(e) => setStackVal(e.target.value)}
          placeholder="StackSize"
          style={{ ...inputStyle, width: 70 }}
          aria-label="StackSize value"
        />
        <button
          type="button"
          disabled={busy || working || selected.size === 0}
          onClick={() => void apply()}
          style={{ fontSize: 11, background: 'rgba(201,162,39,0.3)', borderColor: '#c9a227' }}
        >
          Apply ({selected.size})
        </button>
      </div>
      {note && <div style={{ fontSize: 11, color: '#86efac' }}>{note}</div>}
    </div>
  )
}

/** Recent evaluated loot filmstrip. */
export function LootFilmstripPanel({
  busy,
  onInspect,
}: {
  busy?: boolean
  onInspect: (item: ParsedClipboardItem) => void
}): JSX.Element {
  const [rows, setRows] = useState<
    Array<{ item: ParsedClipboardItem; winner?: string; style?: string; visibility?: string }>
  >([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const items = await window.api.getRecentEvaluatedItems()
      const out: Array<{ item: ParsedClipboardItem; winner?: string; style?: string; visibility?: string }> = []
      for (const item of items.slice().reverse()) {
        if (!item.ok || !item.baseType) continue
        const match = await window.api.matchFilterItem({
          baseType: item.baseType,
          itemClass: item.itemClass,
          rarity: item.rarity,
          stackSize: item.stackSize,
          itemLevel: item.itemLevel,
          quality: item.quality,
          areaLevel: item.areaLevel,
          corrupted: item.corrupted,
          identified: item.identified,
          includeShadowed: false,
        })
        const win = match.ok ? match.steps.find((s) => s.isWinner) : undefined
        out.push({
          item,
          winner: win?.label,
          style: win?.styleSummary,
          visibility: win?.visibility,
        })
      }
      setRows(out)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <div style={panelStyle} role="region" aria-label="Loot filmstrip">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#f0e6d2' }}>Loot filmstrip</div>
        <button type="button" disabled={busy || loading} onClick={() => void refresh()} style={{ fontSize: 10 }}>
          {loading ? '…' : 'Refresh'}
        </button>
      </div>
      <div style={{ fontSize: 11, color: '#9a9aab' }}>
        Last Ctrl+C items Scalpel evaluated — click to open What wins?
      </div>
      {error && <div style={{ fontSize: 11, color: '#f87171' }}>{error}</div>}
      {rows.length === 0 && !loading ? (
        <div style={{ fontSize: 11, color: '#9a9aab' }}>No recent items yet.</div>
      ) : (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {rows.map((r, i) => (
            <button
              key={`${r.item.baseType}-${i}`}
              type="button"
              onClick={() => onInspect(r.item)}
              style={{
                minWidth: 140,
                maxWidth: 180,
                textAlign: 'left',
                padding: 8,
                background: 'rgba(0,0,0,0.35)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 6,
                color: '#f0e6d2',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700 }}>{r.item.name || r.item.baseType}</div>
              <div style={{ fontSize: 10, color: '#9a9aab' }}>
                {r.visibility ?? '?'} · {r.winner ?? 'no match'}
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: '#6b6b7a',
                  marginTop: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.style || '—'}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Preflight guardrails. */
export function PreflightPanel({
  busy,
  onJump,
}: {
  busy?: boolean
  onJump?: (blockIndex: number) => void
}): JSX.Element {
  const [issues, setIssues] = useState<FilterPreflightIssue[]>([])
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  const run = async (): Promise<void> => {
    setWorking(true)
    setError(null)
    try {
      const res = await window.api.preflightFilterCheck()
      if (!res.ok) setError(res.error ?? 'Preflight failed')
      setIssues(res.issues)
    } finally {
      setWorking(false)
    }
  }

  useEffect(() => {
    void run()
  }, [])

  const errors = issues.filter((i) => i.severity === 'error')
  const warns = issues.filter((i) => i.severity === 'warn')

  return (
    <div style={panelStyle} role="region" aria-label="Preflight">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#f0e6d2' }}>Preflight</div>
        <button type="button" disabled={busy || working} onClick={() => void run()} style={{ fontSize: 10 }}>
          {working ? '…' : 'Scan'}
        </button>
        <span style={{ fontSize: 10, color: errors.length ? '#f87171' : warns.length ? '#fbbf24' : '#86efac' }}>
          {errors.length} error · {warns.length} warn
        </span>
      </div>
      <div style={{ fontSize: 11, color: '#9a9aab' }}>Empty BaseTypes, catch-alls, identical adjacent minimaps.</div>
      {error && <div style={{ fontSize: 11, color: '#f87171' }}>{error}</div>}
      <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {issues.length === 0 && !working && <div style={{ fontSize: 11, color: '#86efac' }}>No issues found.</div>}
        {issues.map((iss) => (
          <div
            key={iss.id}
            style={{
              fontSize: 10,
              color: iss.severity === 'error' ? '#fca5a5' : '#fcd34d',
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <span style={{ flex: 1 }}>
              [{iss.severity}] {iss.message}
              {iss.typePath ? ` · ${iss.typePath}` : ''}
              {iss.tier ? `/${iss.tier}` : ''}
            </span>
            {onJump && iss.blockIndex != null && (
              <button type="button" style={{ fontSize: 10 }} onClick={() => onJump(iss.blockIndex!)}>
                Jump
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Economy nudge: pricey bases sitting in low / hidden tiers. */
export function EconomyNudgesPanel({
  section,
  prices,
  busy,
  onBump,
}: {
  section: FilterSection | null
  prices: Record<string, number | null>
  busy?: boolean
  onBump: (baseType: string, fromBlockIndex: number, toBlockIndex: number) => void
}): JSX.Element {
  const nudges = useMemo(() => {
    if (!section) return []
    const ranked = [...section.tiers].sort((a, b) => a.blockIndex - b.blockIndex)
    const top = ranked.slice(0, Math.min(2, ranked.length))
    const low = ranked.filter((t) => {
      const id = t.tier.toLowerCase()
      return (
        t.visibility !== 'Show' ||
        /[c-z]$/.test(id) ||
        id.includes('c') ||
        id.includes('d') ||
        id.includes('e') ||
        id.includes('f')
      )
    })
    const out: Array<{ baseType: string; chaos: number; from: FilterSectionTier; to: FilterSectionTier }> = []
    for (const t of low.length ? low : ranked.slice(2)) {
      for (const b of t.baseTypes) {
        const chaos = prices[b]
        if (chaos == null || chaos < 5) continue
        const dest = top.find((x) => x.blockIndex !== t.blockIndex) ?? ranked[0]
        if (!dest || dest.blockIndex === t.blockIndex) continue
        out.push({ baseType: b, chaos, from: t, to: dest })
      }
    }
    return out.sort((a, b) => b.chaos - a.chaos).slice(0, 12)
  }, [section, prices])

  return (
    <div style={panelStyle} role="region" aria-label="Economy nudges">
      <div style={{ fontSize: 12, fontWeight: 700, color: '#f0e6d2' }}>Economy nudges</div>
      <div style={{ fontSize: 11, color: '#9a9aab' }}>
        Priced items in lower/hidden tiers — one-click bump toward top Show tiers.
      </div>
      {!section ? (
        <div style={{ fontSize: 11, color: '#9a9aab' }}>Open a section.</div>
      ) : nudges.length === 0 ? (
        <div style={{ fontSize: 11, color: '#9a9aab' }}>No nudges (need league prices + low-tier items ≥5c).</div>
      ) : (
        <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {nudges.map((n) => (
            <div
              key={`${n.baseType}-${n.from.blockIndex}`}
              style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11 }}
            >
              <span style={{ flex: 1, color: '#f0e6d2' }}>
                {n.baseType} · {n.chaos.toFixed(1)}c · {n.from.label} → {n.to.label}
              </span>
              <button
                type="button"
                disabled={busy}
                style={{ fontSize: 10 }}
                onClick={() => onBump(n.baseType, n.from.blockIndex, n.to.blockIndex)}
              >
                Bump
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Section templates export/import. */
export function SectionTemplatesPanel({
  section,
  busy,
  onDone,
}: {
  section: FilterSection | null
  busy?: boolean
  onDone: () => void
}): JSX.Element {
  const [templates, setTemplates] = useState(() => loadSectionTemplates())
  const [name, setName] = useState('')
  const [importJson, setImportJson] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  const reload = (): void => setTemplates(loadSectionTemplates())

  const saveCurrent = async (): Promise<void> => {
    if (!section) return
    setWorking(true)
    setNote(null)
    try {
      const tiersWithConditions: Array<{
        tier: string
        visibility: 'Show' | 'Hide' | 'Minimal'
        conditions: FilterCondition[]
      }> = []
      for (const t of section.tiers) {
        const res = await window.api.getFilterBlock(t.blockIndex)
        tiersWithConditions.push({
          tier: t.tier,
          visibility: t.visibility,
          conditions: res.block?.conditions.filter((c) => c.type !== 'BaseType') ?? [],
        })
      }
      upsertSectionTemplate(name || section.title, section, tiersWithConditions)
      setName('')
      reload()
      setNote('Template saved locally')
    } finally {
      setWorking(false)
    }
  }

  const applyTemplate = async (id: string): Promise<void> => {
    if (!section) return
    const tpl = templates.find((t) => t.id === id)
    if (!tpl) return
    if (
      !window.confirm(`Apply template “${tpl.name}” visibility + conditions onto matching tiers in ${section.title}?`)
    )
      return
    setWorking(true)
    setNote(null)
    try {
      let n = 0
      for (const tt of tpl.tiers) {
        const tier = section.tiers.find((t) => t.tier.toLowerCase() === tt.tier.toLowerCase())
        if (!tier) continue
        await window.api.setSectionTierVisibility(tier.blockIndex, tt.visibility)
        const res = await window.api.getFilterBlock(tier.blockIndex)
        if (!res.ok || !res.block) continue
        const base = res.block.conditions.filter((c) => c.type === 'BaseType')
        const block = {
          ...res.block,
          conditions: [...tt.conditions.map((c) => ({ ...c, values: [...c.values] })), ...base],
        }
        const save = await window.api.saveBlockEdit(tier.blockIndex, block, '')
        if (save.ok) n++
      }
      setNote(`Applied to ${n} matching tier(s)`)
      onDone()
    } finally {
      setWorking(false)
    }
  }

  const doExport = async (): Promise<void> => {
    const json = exportSectionTemplatesJson()
    try {
      await navigator.clipboard.writeText(json)
      setNote('Copied templates JSON to clipboard')
    } catch {
      setImportJson(json)
      setNote('Paste/copy the JSON below')
    }
  }

  const doImport = (): void => {
    const res = importSectionTemplatesJson(importJson)
    if (!res.ok) {
      setNote(res.error ?? 'Import failed')
      return
    }
    reload()
    setNote(`Imported ${res.count} template(s)`)
    setImportJson('')
  }

  return (
    <div style={panelStyle} role="region" aria-label="Section templates">
      <div style={{ fontSize: 12, fontWeight: 700, color: '#f0e6d2' }}>Section templates</div>
      <div style={{ fontSize: 11, color: '#9a9aab' }}>
        Export/import visibility + conditions (not BaseType lists) across filters.
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={section ? `Name (${section.title})` : 'Name…'}
          disabled={!section}
          style={{ ...inputStyle, flex: 1, minWidth: 120 }}
        />
        <button
          type="button"
          disabled={!section || busy || working}
          onClick={() => void saveCurrent()}
          style={{ fontSize: 11 }}
        >
          Save current
        </button>
        <button type="button" style={{ fontSize: 10 }} onClick={() => void doExport()}>
          Export
        </button>
      </div>
      <div style={{ maxHeight: 100, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {templates.length === 0 && <div style={{ fontSize: 11, color: '#9a9aab' }}>No templates yet.</div>}
        {templates.map((t) => (
          <div key={t.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11 }}>
            <span style={{ flex: 1, color: '#f0e6d2' }}>
              {t.name} · {t.title} ({t.tiers.length} tiers)
            </span>
            <button
              type="button"
              disabled={!section || busy || working}
              style={{ fontSize: 10 }}
              onClick={() => void applyTemplate(t.id)}
            >
              Apply
            </button>
            <button
              type="button"
              style={{ fontSize: 10 }}
              onClick={() => {
                deleteSectionTemplate(t.id)
                reload()
              }}
            >
              Del
            </button>
          </div>
        ))}
      </div>
      <textarea
        value={importJson}
        onChange={(e) => setImportJson(e.target.value)}
        placeholder="Paste templates JSON to import…"
        rows={2}
        style={{ ...inputStyle, width: '100%', resize: 'vertical', fontFamily: 'ui-monospace, monospace' }}
      />
      <button
        type="button"
        disabled={!importJson.trim()}
        onClick={doImport}
        style={{ fontSize: 10, alignSelf: 'flex-start' }}
      >
        Import JSON
      </button>
      {note && <div style={{ fontSize: 11, color: '#86efac' }}>{note}</div>}
    </div>
  )
}

export function ModeSwitcher({
  mode,
  onChange,
}: {
  mode: EditorWorkbenchMode
  onChange: (m: EditorWorkbenchMode) => void
}): JSX.Element {
  const modes: Array<{ id: EditorWorkbenchMode; label: string; hint: string }> = [
    { id: 'browse', label: 'Browse', hint: 'Navigate sections & visibility' },
    { id: 'edit', label: 'Edit', hint: 'Move items, conditions, add rules' },
    { id: 'advanced', label: 'Advanced', hint: 'Match, re-apply, diff, tools' },
    { id: 'guide', label: 'Guide', hint: 'How to use this editor' },
  ]
  return (
    <div
      role="tablist"
      aria-label="Editor mode"
      style={{
        display: 'inline-flex',
        borderRadius: 6,
        border: '1px solid rgba(255,255,255,0.14)',
        overflow: 'hidden',
      }}
    >
      {modes.map((m) => (
        <button
          key={m.id}
          type="button"
          role="tab"
          aria-selected={mode === m.id}
          title={m.hint}
          onClick={() => onChange(m.id)}
          style={{
            fontSize: 11,
            padding: '4px 10px',
            border: 'none',
            borderRadius: 0,
            background: mode === m.id ? 'rgba(201,162,39,0.4)' : 'transparent',
            color: mode === m.id ? '#f0e6d2' : '#9a9aab',
            fontWeight: mode === m.id ? 700 : 500,
            cursor: 'pointer',
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CraftApi, CraftApplyResult, CraftItemStateResult, ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { Button, ItemChip } from '@scalpelpoe/plugin-sdk'
import type { PoeItem } from '@scalpelpoe/plugin-sdk'
import { inputStyle, selectStyle } from './craft-utils'
import type { CraftTabProps } from './craft-build-context'
import { resolveMarksmanEnabled } from './craft-build-context'
import { LAB_OMENS, omenIconName } from './craft-omens'
import { ItemIcon } from './ItemIcon'

type CraftActionResult = Awaited<ReturnType<CraftApi['listActions']>>[number]

interface HistoryStep {
  before: CraftItemStateResult
  result: CraftApplyResult
}

interface CraftEmulatorProps extends CraftTabProps {
  craft: CraftApi
  ctx: ScalpelPluginContext
  item: PoeItem | null
  virt: CraftItemStateResult | null
  onVirtChange: (state: CraftItemStateResult | null) => void
  onItemChange: (item: PoeItem | null) => void
  onOpenSimulator?: () => void
}

const QUICK_ORBS = [
  'Orb of Transmutation',
  'Orb of Augmentation',
  'Orb of Alteration',
  'Regal Orb',
  'Orb of Alchemy',
  'Chaos Orb',
  'Exalted Orb',
  'Greater Exalted Orb',
  'Perfect Exalted Orb',
  'Greater Chaos Orb',
  'Perfect Chaos Orb',
  'Orb of Annulment',
  'Orb of Scouring',
]

function slug(name: string): string {
  return `currency:${name}`
}

function modLineSuffix(m: { desecrated?: boolean; fractured?: boolean; veiled?: boolean; pool?: 'marksman' }): string {
  const parts: string[] = []
  if (m.pool === 'marksman') parts.push('marksman')
  if (m.desecrated) parts.push('desecrated')
  if (m.fractured) parts.push('fractured')
  return parts.length ? ` (${parts.join(', ')})` : ''
}

function rarityColor(rarity: CraftItemStateResult['rarity']): string {
  switch (rarity) {
    case 'Magic':
      return '#8888ff'
    case 'Rare':
      return '#ffff77'
    case 'Unique':
      return '#af6025'
    default:
      return '#c8c8c8'
  }
}

export function CraftEmulator({
  craft,
  ctx,
  item,
  virt,
  onVirtChange,
  onItemChange,
  buildContext,
  onSmartImport,
  onOpenSimulator,
}: CraftEmulatorProps): JSX.Element {
  const [history, setHistory] = useState<HistoryStep[]>([])
  const [actions, setActions] = useState<CraftActionResult[]>([])
  const [baseQuery, setBaseQuery] = useState(item?.baseType ?? 'Gold Ring')
  const [baseType, setBaseType] = useState(item?.baseType ?? 'Gold Ring')
  const [itemLevel, setItemLevel] = useState(item?.itemLevel ?? 82)
  const [baseSuggestions, setBaseSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastMsg, setLastMsg] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setVirt = onVirtChange

  const refreshActions = useCallback(
    async (state: CraftItemStateResult) => {
      try {
        const poe = {
          ...(item ?? ({} as PoeItem)),
          baseType: state.baseType,
          itemLevel: state.itemLevel,
          rarity: state.rarity,
          itemClass: state.itemClass,
          corrupted: state.corrupted,
          explicits: state.mods.map((m) => m.text),
          advancedMods: state.mods.map((m) => ({
            type: m.kind === 'p' ? 'prefix' : 'suffix',
            name: m.name ?? m.group,
            lines: [m.text],
          })),
        } as PoeItem
        setActions(await craft.listActions(poe))
      } catch {
        setActions([])
      }
    },
    [craft, item],
  )

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void craft.searchBases(baseQuery, 40).then(setBaseSuggestions).catch(() => setBaseSuggestions([]))
    }, 180)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [baseQuery, craft])

  useEffect(() => {
    if (virt) {
      setBaseType(virt.baseType)
      setBaseQuery(virt.baseType)
      setItemLevel(virt.itemLevel)
      void refreshActions(virt)
    }
  }, [virt, refreshActions])

  const startFresh = useCallback(async () => {
    setError(null)
    setLastMsg(null)
    setBusy(true)
    try {
      const marksman = resolveMarksmanEnabled(null, buildContext)
      const state = await craft.freshState(baseType.trim(), itemLevel, marksman ? { marksmanEnabled: true } : undefined)
      setVirt(state)
      setHistory([])
      setLastMsg(`Fresh ${state.rarity} ${state.baseType} · iLvl ${state.itemLevel}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [baseType, itemLevel, craft, buildContext, setVirt])

  const importItem = useCallback(async () => {
    setError(null)
    try {
      const msg = await onSmartImport()
      if (!msg) {
        setError('No PoE item on cursor — hover an item in-game and try again.')
        return
      }
      setHistory([])
      setLastMsg(msg)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [onSmartImport])

  const apply = useCallback(
    async (actionId: string, opts?: { pickIndex?: number; rerollReveal?: boolean }) => {
      if (!virt) return
      setBusy(true)
      setError(null)
      try {
        const result = await craft.apply(virt, actionId, Date.now(), {
          omens: virt.activeOmens,
          ...opts,
        })
        if (!result.ok) {
          setError(result.error ?? result.message)
          return
        }
        setHistory((h) => [...h, { before: virt, result }])
        setVirt(result.state)
        setLastMsg(result.message)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setBusy(false)
      }
    },
    [craft, virt],
  )

  const toggleOmen = useCallback(
    (omenId: string) => {
      if (!virt) return
      const active = new Set(virt.activeOmens ?? [])
      if (active.has(omenId)) active.delete(omenId)
      else active.add(omenId)
      setVirt({ ...virt, activeOmens: [...active] })
    },
    [virt, setVirt],
  )

  const revealPick = useCallback(
    (pickIndex: number) => {
      void apply('desecration:reveal', { pickIndex })
    },
    [apply],
  )

  const rerollReveal = useCallback(() => {
    void apply('desecration:reveal', { rerollReveal: true })
  }, [apply])

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h
      const last = h[h.length - 1]
      setVirt(last.before)
      setLastMsg(`Undid: ${last.result.label}`)
      return h.slice(0, -1)
    })
  }, [])

  const reset = useCallback(() => {
    setVirt(null)
    setHistory([])
    setLastMsg(null)
    setError(null)
  }, [])

  const actionMap = useMemo(() => new Map(actions.map((a) => [a.id, a])), [actions])

  const currencyActions = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return actions.filter((a) => {
      if (a.id.startsWith('pool:')) return false
      if (!q) return true
      return a.label.toLowerCase().includes(q) || (a.category ?? '').includes(q)
    })
  }, [actions, filter])

  const prefixes = virt?.mods.filter((m) => m.kind === 'p') ?? []
  const suffixes = virt?.mods.filter((m) => m.kind === 's') ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button disabled={busy} onClick={() => void importItem()}>
          Import hovered item
        </Button>
        <Button disabled={busy} onClick={() => void startFresh()}>
          New base
        </Button>
        <Button disabled={busy || history.length === 0} onClick={undo}>
          Undo
        </Button>
        <Button disabled={busy || !virt} onClick={reset}>
          Reset
        </Button>
        {onOpenSimulator ? (
          <Button disabled={!virt} onClick={onOpenSimulator}>
            Simulate odds →
          </Button>
        ) : null}
      </div>
      <p style={{ margin: 0, fontSize: 11, opacity: 0.65, lineHeight: 1.45 }}>
        Emulator applies one craft at a time. For outcome % tables, use <strong>Simulator</strong> (or the button
        above).
      </p>

      {error ? (
        <div
          style={{
            padding: '8px 10px',
            borderRadius: 4,
            background: 'rgba(255,140,0,0.2)',
            border: '1px solid rgba(255,140,0,0.45)',
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          {error}
        </div>
      ) : null}
      {lastMsg ? <p style={{ margin: 0, fontSize: 11, opacity: 0.7 }}>{lastMsg}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
          <label style={{ fontSize: 12, fontWeight: 600, opacity: 0.85 }}>Base (new item)</label>
          <input
            type="search"
            value={baseQuery}
            onChange={(e) => {
              setBaseQuery(e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setBaseType(baseQuery)
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
                maxHeight: 140,
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 600, opacity: 0.85 }}>iLvl</label>
          <input
            type="number"
            min={1}
            max={100}
            value={itemLevel}
            onChange={(e) => setItemLevel(Number(e.target.value) || 1)}
            style={{ ...inputStyle, width: 72 }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p style={{ margin: 0, fontSize: 12, opacity: virt?.marksmanEnabled ? 0.9 : 0.6 }}>
          Marksman pool:{' '}
          {virt?.marksmanEnabled ? (
            <span style={{ color: '#7fd4a0' }}>active (auto-detected from worn belt/quiver or item implicit)</span>
          ) : (
            <span>inactive — import a belt/quiver with &quot;Can roll Marksman modifiers&quot;</span>
          )}
        </p>
        <p style={{ margin: 0, fontSize: 11, opacity: 0.55, lineHeight: 1.45, maxWidth: 520 }}>
          Adds rune-table mods (Bow/Crossbow accuracy, Projectile Damage, Pierce, Mark effects). Does{' '}
          <strong>not</strong> add &quot;+# to Level of all Projectile Skills&quot; — those roll on rings/amulets/bows.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) minmax(240px, 1.2fr)', gap: 12, flex: 1, minHeight: 0 }}>
        <section
          style={{
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            minHeight: 0,
            overflow: 'auto',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Virtual item</h3>
          {!virt ? (
            <p style={{ margin: 0, fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
              Import an item or pick a base and click <strong>New base</strong> to start crafting.
            </p>
          ) : (
            <>
              <div style={{ color: rarityColor(virt.rarity), fontWeight: 600, fontSize: 13 }}>
                {virt.rarity} {virt.baseType}
              </div>
              <div style={{ fontSize: 11, opacity: 0.65 }}>
                iLvl {virt.itemLevel} · {virt.itemClass}
                {virt.corrupted ? ' · Corrupted' : ''}
              </div>
              {prefixes.length ? (
                <div>
                  <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 4 }}>Prefixes ({prefixes.length}/3)</div>
                  {prefixes.map((m) => (
                    <div key={`p-${m.text}`} style={{ fontSize: 12, color: m.veiled ? '#ccaa00' : '#8888ff', marginBottom: 2 }}>
                      {m.veiled ? '◆ ' : ''}{m.text}{modLineSuffix(m)}
                    </div>
                  ))}
                </div>
              ) : null}
              {suffixes.length ? (
                <div>
                  <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 4 }}>Suffixes ({suffixes.length}/3)</div>
                  {suffixes.map((m) => (
                    <div key={`s-${m.text}`} style={{ fontSize: 12, color: m.veiled ? '#ccaa00' : '#8888ff', marginBottom: 2 }}>
                      {m.veiled ? '◆ ' : ''}{m.text}{modLineSuffix(m)}
                    </div>
                  ))}
                </div>
              ) : null}
              {!virt.mods.length ? (
                <p style={{ margin: 0, fontSize: 12, opacity: 0.5 }}>No modifiers</p>
              ) : null}
              {item ? (
                <ItemChip
                  name={item.name || item.baseType}
                  itemClass={item.itemClass}
                  title="Imported reference (emulator uses virtual state above)"
                />
              ) : null}
            </>
          )}
          {history.length ? (
            <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.7, marginBottom: 4 }}>History ({history.length})</div>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 11, opacity: 0.75, maxHeight: 100, overflow: 'auto' }}>
                {history.map((h, i) => (
                  <li key={`${h.result.actionId}-${i}`}>{h.result.label}</li>
                ))}
              </ol>
            </div>
          ) : null}
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Active omens</h3>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxHeight: 72, overflow: 'auto' }}>
            {LAB_OMENS.map((o) => {
              const on = virt?.activeOmens?.includes(o.id)
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={!virt || busy}
                  title={omenIconName(o.id)}
                  onClick={() => toggleOmen(o.id)}
                  style={{
                    ...selectStyle,
                    fontSize: 10,
                    padding: '4px 6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: on ? 'rgba(200,160,80,0.25)' : selectStyle.background,
                    border: on ? '1px solid rgba(200,160,80,0.5)' : selectStyle.border,
                  }}
                >
                  <ItemIcon name={omenIconName(o.id)} size={16} />
                  {o.label}
                </button>
              )
            })}
          </div>

          {virt?.revealChoices ? (
            <div
              style={{
                padding: 8,
                borderRadius: 4,
                border: '1px solid rgba(200,160,80,0.4)',
                background: 'rgba(200,160,80,0.08)',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Pick desecrated mod</div>
              {virt.revealChoices.mods.map((m, i) => (
                <button
                  key={`${m.text}-${i}`}
                  type="button"
                  disabled={busy}
                  onClick={() => revealPick(i)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    marginBottom: 4,
                    padding: '6px 8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 4,
                    background: 'rgba(0,0,0,0.2)',
                    color: 'inherit',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {m.desecrated ? '◆ ' : ''}{m.text}
                </button>
              ))}
              {virt.revealChoices.rerollsLeft > 0 ? (
                <Button disabled={busy} onClick={() => rerollReveal()}>
                  Reroll choices ({virt.revealChoices.rerollsLeft} left)
                </Button>
              ) : null}
            </div>
          ) : null}

          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Apply currency</h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {QUICK_ORBS.map((name) => {
              const id = slug(name)
              const act = actionMap.get(id)
              const disabled = busy || !virt || !act?.applies
              return (
                <button
                  key={id}
                  type="button"
                  disabled={disabled}
                  title={act?.reason ?? act?.description ?? name}
                  onClick={() => void apply(id)}
                  style={{
                    ...selectStyle,
                    opacity: disabled ? 0.45 : 1,
                    fontWeight: 500,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <ItemIcon name={name} size={18} />
                  {name.replace(/^Orb of /, '').replace(/ Orb$/, '')}
                </button>
              )
            })}
          </div>
          <input
            type="search"
            placeholder="Filter essences / currencies…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={inputStyle}
          />
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 4,
              padding: 4,
            }}
          >
            {currencyActions.slice(0, 80).map((a) => {
              const disabled = busy || !virt || !a.applies
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={disabled}
                  title={a.reason ?? a.description}
                  onClick={() => void apply(a.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 8px',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: disabled ? 'transparent' : 'rgba(255,255,255,0.02)',
                    color: 'inherit',
                    fontSize: 12,
                    opacity: disabled ? 0.45 : 1,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  <ItemIcon name={a.label} size={18} />
                  <span>
                    {a.label}
                    {!a.applies && a.reason ? ` — ${a.reason}` : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  CraftApi,
  CraftItemStateResult,
  CraftSequenceConfigResult,
  CraftSequenceRunResult,
  CraftSequenceStepResult,
  SeqOnFailureResult,
  SeqOnSuccessResult,
} from '@scalpelpoe/plugin-sdk'
import { Button, ErrorBanner, ItemChip } from '@scalpelpoe/plugin-sdk'
import type { BaseSetupSelection } from './BaseSetupWizard'
import { LAB_OMENS, omenIconName } from './craft-omens'
import { ItemIcon } from './ItemIcon'
import { ModConditionField } from './ModConditionField'
import { inputStyle, pct, selectStyle } from './craft-utils'
import {
  BASE_METHODS,
  BONE_METHODS,
  catalystMethods,
  deleteRecipe,
  essenceMethods,
  loadRecipes,
  saveRecipe,
  socketableMethods,
  type SavedRecipe,
} from './sequence-methods'

async function invokeSequence(
  craft: CraftApi,
  config: CraftSequenceConfigResult,
): Promise<CraftSequenceRunResult> {
  if (typeof craft.sequence === 'function') {
    return craft.sequence(config)
  }
  const api = (globalThis as { api?: { craftSequence?: (id: string, c: CraftSequenceConfigResult) => Promise<CraftSequenceRunResult> } }).api
  const pluginId =
    (globalThis as { __scalpelLabPluginId?: string }).__scalpelLabPluginId || 'scalpel-lab'
  if (api?.craftSequence) return api.craftSequence(pluginId, config)
  throw new Error('Sequence API missing — fully quit Scalpel and relaunch after install:local.')
}

interface CraftSequenceProps {
  craft: CraftApi
  selection: BaseSetupSelection | null
  sessionState: CraftItemStateResult | null
  onBackToSetup: () => void
  onSessionChange: (state: CraftItemStateResult | null) => void
}

const ON_SUCCESS: SeqOnSuccessResult[] = ['continue', 'goto', 'stop']
const ON_FAILURE: SeqOnFailureResult[] = ['loop', 'restart', 'goto', 'stop']

function newStep(partial?: Partial<CraftSequenceStepResult>): CraftSequenceStepResult {
  return {
    id: `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    actionId: 'currency:Orb of Alteration',
    repeatUntilHit: true,
    requireConditions: true,
    conditions: [{ query: '', kind: 'all', countMin: 1 }],
    onSuccess: 'continue',
    onFailure: 'loop',
    ...partial,
  }
}

const PRESETS: Array<{
  id: string
  name: string
  steps: () => CraftSequenceStepResult[]
}> = [
  {
    id: 'alt-spam',
    name: 'Alt until hit',
    steps: () => [
      newStep({
        actionId: 'currency:Orb of Transmutation',
        repeatUntilHit: false,
        requireConditions: false,
        conditions: [],
        onSuccess: 'continue',
        onFailure: 'loop',
      }),
      newStep({
        actionId: 'currency:Orb of Alteration',
        repeatUntilHit: true,
        onSuccess: 'stop',
        onFailure: 'loop',
      }),
    ],
  },
  {
    id: 'alt-regal',
    name: 'Alt → Regal',
    steps: () => [
      newStep({
        actionId: 'currency:Orb of Transmutation',
        repeatUntilHit: false,
        requireConditions: false,
        conditions: [],
        onSuccess: 'continue',
        onFailure: 'loop',
      }),
      newStep({
        actionId: 'currency:Orb of Alteration',
        repeatUntilHit: true,
        onSuccess: 'continue',
        onFailure: 'loop',
      }),
      newStep({
        actionId: 'currency:Regal Orb',
        repeatUntilHit: false,
        requireConditions: false,
        conditions: [],
        onSuccess: 'stop',
        onFailure: 'restart',
      }),
    ],
  },
  {
    id: 'scour-alt-regal',
    name: 'Scour → Trans → Alt → Regal',
    steps: () => [
      newStep({
        actionId: 'currency:Orb of Scouring',
        repeatUntilHit: false,
        requireConditions: false,
        conditions: [],
        onSuccess: 'continue',
        onFailure: 'loop',
      }),
      newStep({
        actionId: 'currency:Orb of Transmutation',
        repeatUntilHit: false,
        requireConditions: false,
        conditions: [],
        onSuccess: 'continue',
        onFailure: 'restart',
      }),
      newStep({
        actionId: 'currency:Orb of Alteration',
        repeatUntilHit: true,
        onSuccess: 'continue',
        onFailure: 'loop',
      }),
      newStep({
        actionId: 'currency:Regal Orb',
        repeatUntilHit: false,
        requireConditions: false,
        conditions: [],
        onSuccess: 'stop',
        onFailure: 'restart',
      }),
    ],
  },
  {
    id: 'chaos-spam',
    name: 'Alchemy → Chaos spam',
    steps: () => [
      newStep({
        actionId: 'currency:Orb of Alchemy',
        repeatUntilHit: false,
        requireConditions: false,
        conditions: [],
        onSuccess: 'continue',
        onFailure: 'loop',
      }),
      newStep({
        actionId: 'currency:Chaos Orb',
        repeatUntilHit: true,
        onSuccess: 'stop',
        onFailure: 'loop',
      }),
    ],
  },
]

export function CraftSequence({
  craft,
  selection,
  sessionState,
  onBackToSetup,
}: CraftSequenceProps): JSX.Element {
  const [steps, setSteps] = useState<CraftSequenceStepResult[]>(() => PRESETS[3].steps())
  const [targetQuery, setTargetQuery] = useState('')
  const [samples, setSamples] = useState(30)
  const [result, setResult] = useState<CraftSequenceRunResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [omens, setOmens] = useState<string[]>([])
  const [catalyst, setCatalyst] = useState('')
  const [methods, setMethods] = useState(BASE_METHODS)
  const [recipes, setRecipes] = useState<SavedRecipe[]>(() => loadRecipes())
  const busyRef = useRef(false)
  const resultsRef = useRef<HTMLDivElement | null>(null)

  const baseType = selection?.baseType ?? sessionState?.baseType ?? null
  const itemLevel = selection?.itemLevel ?? sessionState?.itemLevel ?? 82

  // Load full method palette (essences + catalysts + bones) when craft/base ready.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const dummy = {
          name: '',
          baseType: baseType || 'Iron Ring',
          itemClass: 'Jewellery',
          rarity: 'Normal' as const,
          itemLevel: itemLevel || 1,
          quality: selection?.quality ?? 20,
          sockets: 0,
          corrupted: false,
          implicits: [] as string[],
          explicits: [] as string[],
        }
        const actions = await craft.listActions(dummy)
        const essenceNames = actions
          .filter((a) => a.id.startsWith('currency:') && /essence|alloy/i.test(a.label))
          .map((a) => a.label)
        const catNames = actions
          .filter((a) => a.id.startsWith('currency:') && a.description?.toLowerCase().includes('catalyst'))
          .map((a) => a.label)
        const socks = actions
          .filter((a) => a.id.startsWith('socketable:'))
          .map((a) => ({ id: a.id, label: a.label, stype: a.category }))
        // Fallback catalyst names if description missing
        const cats =
          catNames.length > 0
            ? catNames
            : [
                'Adaptive',
                'Carapace',
                "Chayula's",
                "Esh's",
                'Flesh',
                'Necrotic',
                'Neural',
                'Reaver',
                'Sibilant',
                'Skittering',
                "Tul's",
                "Uul-Netol's",
                "Xoph's",
              ]
        if (!cancelled) {
          setMethods([
            ...BASE_METHODS,
            ...BONE_METHODS,
            ...catalystMethods(cats),
            ...essenceMethods(essenceNames),
            ...socketableMethods(socks),
          ])
        }
      } catch {
        if (!cancelled) setMethods([...BASE_METHODS, ...BONE_METHODS])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [craft, baseType, itemLevel, selection?.quality])

  const updateStep = useCallback((index: number, patch: Partial<CraftSequenceStepResult>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }, [])

  const updateCondition = useCallback(
    (stepIndex: number, condIndex: number, next: { query: string; minValue?: number }) => {
      setSteps((prev) =>
        prev.map((s, i) => {
          if (i !== stepIndex) return s
          const conditions = s.conditions?.length
            ? [...s.conditions]
            : [{ query: '', kind: 'all' as const, countMin: 1 }]
          while (conditions.length <= condIndex) {
            conditions.push({ query: '', kind: 'all', countMin: 1 })
          }
          conditions[condIndex] = {
            ...conditions[condIndex],
            query: next.query,
            minValue: next.minValue,
          }
          return { ...s, conditions }
        }),
      )
    },
    [],
  )

  const addCondition = useCallback((stepIndex: number) => {
    setSteps((prev) =>
      prev.map((s, i) =>
        i === stepIndex
          ? {
              ...s,
              conditions: [...(s.conditions ?? []), { query: '', kind: 'all' as const, countMin: 1 }],
            }
          : s,
      ),
    )
  }, [])

  const removeCondition = useCallback((stepIndex: number, condIndex: number) => {
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i !== stepIndex) return s
        const conditions = (s.conditions ?? []).filter((_, ci) => ci !== condIndex)
        return { ...s, conditions: conditions.length ? conditions : [{ query: '', kind: 'all', countMin: 1 }] }
      }),
    )
  }, [])

  const toggleStepOmen = useCallback((stepIndex: number, id: string) => {
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i !== stepIndex) return s
        const cur = s.omens ?? []
        return {
          ...s,
          omens: cur.includes(id) ? cur.filter((o) => o !== id) : [...cur, id],
        }
      }),
    )
  }, [])

  const toggleOmen = useCallback((id: string) => {
    setOmens((prev) => (prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]))
  }, [])

  const run = useCallback(async () => {
    if (busyRef.current) return
    if (!baseType) {
      setError('Pick a base in Setup first.')
      setStatus(null)
      return
    }
    const prepared = steps.map((s) => ({
      ...s,
      omens: (s.omens && s.omens.length ? s.omens : omens).length
        ? s.omens && s.omens.length
          ? s.omens
          : omens
        : undefined,
      conditions: (s.conditions ?? [])
        .map((c) => ({
          ...c,
          query: c.query.trim(),
          minValue: c.minValue,
        }))
        .filter((c) => c.query.length > 0 || s.requireConditions === false),
    }))
    const missingCond = prepared.some(
      (s) => s.repeatUntilHit && s.requireConditions !== false && !s.conditions?.length,
    )
    if (missingCond) {
      setError('A “repeat until conditions” step has no condition — use Browse mods and pick one.')
      return
    }

    busyRef.current = true
    setBusy(true)
    setError(null)
    setResult(null)
    setStatus(`Estimating sequence on ${baseType}…`)
    try {
      // Always Normal: step 1 Alchemy is the CoE “make it rare” step.
      // Do NOT inherit Emulator Rare — that makes Alchemy fail silently every trial.
      const config: CraftSequenceConfigResult = {
        baseType,
        itemLevel,
        quality: selection?.quality ?? 20,
        catalyst: catalyst || undefined,
        rarity: 'Normal',
        steps: prepared,
        targetQuery: targetQuery.trim() || undefined,
        samples: Math.min(samples, 40),
        maxTrials: 80,
      }
      setStatus('Computing CoE-style Chaos odds…')
      const out = await invokeSequence(craft, config)
      setResult(out)
      setStatus(
        `Done — ~${(out.hitRate * 100).toFixed(2)}% per Chaos` +
          (out.expectedAttempts != null ? ` · ~${out.expectedAttempts.toFixed(0)} Chaos to hit` : '') +
          '.',
      )
      requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    } catch (err) {
      setResult(null)
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setStatus('Simulation failed.')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [baseType, craft, steps, omens, catalyst, itemLevel, selection?.quality, targetQuery, samples])

  const omenRow = useMemo(
    () => (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {LAB_OMENS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => toggleOmen(o.id)}
            title={omenIconName(o.id)}
            style={{
              ...selectStyle,
              padding: '4px 8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: omens.includes(o.id) ? 'rgba(120,150,220,0.28)' : 'rgba(0,0,0,0.25)',
              cursor: 'pointer',
            }}
          >
            <ItemIcon name={omenIconName(o.id)} size={18} />
            {o.label}
          </button>
        ))}
      </div>
    ),
    [omens, toggleOmen],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, flex: 1, overflow: 'auto' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button onClick={onBackToSetup}>← Base setup</Button>
        {baseType ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <ItemIcon name={baseType} size={32} />
            <ItemChip
              name={`${baseType} · ilvl ${itemLevel}${selection ? ` · q${selection.quality}` : ''}`}
              itemClass={selection?.familyName}
              title={baseType}
            />
          </span>
        ) : (
          <span style={{ fontSize: 12, opacity: 0.65 }}>No base selected — open Setup.</span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 11, opacity: 0.6, lineHeight: 1.4 }}>
        Sequence always starts from a <strong>Normal</strong> base (CoE-style). Put Alchemy/Transmute in step 1 —
        don&apos;t pre-alch in Emulator for this tab.
      </p>
      {status ? (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            padding: '8px 10px',
            borderRadius: 4,
            background: busy ? 'rgba(120,150,220,0.18)' : 'rgba(120,180,120,0.15)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          {status}
        </p>
      ) : null}
      {error ? <ErrorBanner message={error} tone="warn" inline /> : null}

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Quick presets (CoE recipes)</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setSteps(p.steps())
                setResult(null)
              }}
              style={{ ...selectStyle, cursor: 'pointer' }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Simulation Sequence</h3>
          <Button
            onClick={() =>
              setSteps((prev) => [
                ...prev,
                newStep({
                  actionId: 'currency:Exalted Orb',
                  repeatUntilHit: false,
                  requireConditions: true,
                }),
              ])
            }
          >
            + Add step
          </Button>
        </div>
        <p style={{ margin: 0, fontSize: 11, opacity: 0.55, lineHeight: 1.45 }}>
          Each step: Method · Conditions · On success / On failure — same structure as Craft of Exile.
        </p>

        {steps.map((step, index) => (
          <div
            key={step.id}
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: 10,
              padding: 10,
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(0,0,0,0.18)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, paddingTop: 6 }}>#{index + 1}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  Method
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <ItemIcon name={step.actionId.replace(/^currency:/, '')} size={22} />
                    <select
                      value={step.actionId}
                      onChange={(e) => updateStep(index, { actionId: e.target.value })}
                      style={selectStyle}
                    >
                      {Object.entries(
                        methods.reduce<Record<string, typeof methods>>((acc, m) => {
                          const g = m.group || 'Other'
                          ;(acc[g] ??= []).push(m)
                          return acc
                        }, {}),
                      ).map(([group, items]) => (
                        <optgroup key={group} label={group}>
                          {items.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </span>
                </label>
                <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, marginTop: 16 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(step.repeatUntilHit)}
                    onChange={(e) => updateStep(index, { repeatUntilHit: e.target.checked })}
                  />
                  Repeat until conditions
                </label>
                <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, marginTop: 16 }}>
                  <input
                    type="checkbox"
                    checked={step.requireConditions !== false}
                    onChange={(e) => updateStep(index, { requireConditions: e.target.checked })}
                  />
                  Require conditions
                </label>
                <button
                  type="button"
                  onClick={() => setSteps((prev) => prev.filter((_, i) => i !== index))}
                  style={{ ...selectStyle, marginTop: 16, cursor: 'pointer', opacity: 0.8 }}
                  disabled={steps.length <= 1}
                >
                  Remove
                </button>
              </div>

              {(step.conditions?.length ? step.conditions : [{ query: '', kind: 'all' as const, countMin: 1 }]).map(
                (cond, ci) => (
                  <div key={`${step.id}-c${ci}`} style={{ display: 'flex', gap: 6, alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <ModConditionField
                        craft={craft}
                        baseType={baseType}
                        itemLevel={itemLevel}
                        value={{ query: cond.query ?? '', minValue: cond.minValue }}
                        onChange={(next) => updateCondition(index, ci, next)}
                        disabled={step.requireConditions === false}
                      />
                    </div>
                    {(step.conditions?.length ?? 0) > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeCondition(index, ci)}
                        style={{ ...selectStyle, marginTop: 18, fontSize: 10 }}
                      >
                        −
                      </button>
                    ) : null}
                  </div>
                ),
              )}
              {step.requireConditions !== false ? (
                <button type="button" onClick={() => addCondition(index)} style={{ ...selectStyle, fontSize: 10, alignSelf: 'start' }}>
                  + Condition
                </button>
              ) : null}

              <details style={{ fontSize: 11 }}>
                <summary style={{ cursor: 'pointer', opacity: 0.75 }}>
                  Step omens {(step.omens?.length ?? 0) > 0 ? `(${step.omens!.length})` : '(inherit global)'}
                </summary>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {LAB_OMENS.map((o) => {
                    const on = (step.omens ?? []).includes(o.id)
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => toggleStepOmen(index, o.id)}
                        style={{
                          ...selectStyle,
                          fontSize: 10,
                          padding: '3px 6px',
                          background: on ? 'rgba(200,160,80,0.3)' : undefined,
                        }}
                        title={o.label}
                      >
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              </details>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  On success
                  <select
                    value={step.onSuccess ?? 'continue'}
                    onChange={(e) => updateStep(index, { onSuccess: e.target.value as SeqOnSuccessResult })}
                    style={selectStyle}
                  >
                    {ON_SUCCESS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                {(step.onSuccess ?? 'continue') === 'goto' ? (
                  <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    Goto step #
                    <input
                      type="number"
                      min={1}
                      max={steps.length}
                      value={(step.onSuccessGoto ?? 0) + 1}
                      onChange={(e) =>
                        updateStep(index, { onSuccessGoto: Math.max(0, (Number(e.target.value) || 1) - 1) })
                      }
                      style={{ ...inputStyle, width: 70 }}
                    />
                  </label>
                ) : null}
                <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  On failure
                  <select
                    value={step.onFailure ?? 'loop'}
                    onChange={(e) => updateStep(index, { onFailure: e.target.value as SeqOnFailureResult })}
                    style={selectStyle}
                  >
                    {ON_FAILURE.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                {(step.onFailure ?? 'loop') === 'goto' ? (
                  <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    Goto step #
                    <input
                      type="number"
                      min={1}
                      max={steps.length}
                      value={(step.onFailureGoto ?? 0) + 1}
                      onChange={(e) =>
                        updateStep(index, { onFailureGoto: Math.max(0, (Number(e.target.value) || 1) - 1) })
                      }
                      style={{ ...inputStyle, width: 70 }}
                    />
                  </label>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
          Global omens (used when a step has none of its own)
        </h3>
        {omenRow}
        <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 260 }}>
          Catalyst (weights on rolls)
          <select value={catalyst} onChange={(e) => setCatalyst(e.target.value)} style={selectStyle}>
            <option value="">None</option>
            {methods
              .filter((m) => m.group === 'Catalyst')
              .map((m) => (
                <option key={m.id} value={m.label}>
                  {m.label}
                </option>
              ))}
          </select>
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            style={{ ...selectStyle, cursor: 'pointer' }}
            onClick={() => {
              const name = window.prompt('Recipe name')
              if (!name?.trim()) return
              const recipe: SavedRecipe = {
                id: `r${Date.now().toString(36)}`,
                name: name.trim(),
                savedAt: Date.now(),
                steps,
                catalyst: catalyst || undefined,
                omens,
                targetQuery: targetQuery || undefined,
              }
              saveRecipe(recipe)
              setRecipes(loadRecipes())
            }}
          >
            Save recipe
          </button>
          {recipes.length ? (
            <select
              defaultValue=""
              style={selectStyle}
              onChange={(e) => {
                const id = e.target.value
                e.target.value = ''
                const r = recipes.find((x) => x.id === id)
                if (!r) return
                setSteps(r.steps as CraftSequenceStepResult[])
                setCatalyst(r.catalyst ?? '')
                setOmens(r.omens ?? [])
                setTargetQuery(r.targetQuery ?? '')
              }}
            >
              <option value="">Load recipe…</option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          ) : null}
          {recipes[0] ? (
            <button
              type="button"
              style={{ ...selectStyle, cursor: 'pointer', opacity: 0.7 }}
              onClick={() => {
                if (!recipes[0]) return
                deleteRecipe(recipes[0].id)
                setRecipes(loadRecipes())
              }}
            >
              Delete latest
            </button>
          ) : null}
        </div>
      </section>

      <section
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'end',
          position: 'sticky',
          bottom: 0,
          zIndex: 2,
          padding: '10px 0 4px',
          background: 'linear-gradient(transparent, rgba(12,14,18,0.95) 28%)',
        }}
      >
        <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 180 }}>
          Global target (optional hit-rate reporter)
          <input
            value={targetQuery}
            onChange={(e) => setTargetQuery(e.target.value)}
            placeholder="Same as CoE craft goal — e.g. +# to Level of all Projectile Skills"
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 3 }}>
          Samples
          <input
            type="number"
            min={10}
            max={40}
            value={samples}
            onChange={(e) => setSamples(Math.min(40, Math.max(10, Number(e.target.value) || 30)))}
            style={{ ...inputStyle, width: 80 }}
            title="Capped at 40 — higher Chaos/T1 spam freezes the app"
          />
        </label>
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy || !baseType}
          style={{
            ...selectStyle,
            padding: '10px 16px',
            fontWeight: 700,
            cursor: busy || !baseType ? 'not-allowed' : 'pointer',
            opacity: busy || !baseType ? 0.5 : 1,
            background: busy ? 'rgba(120,150,220,0.35)' : 'rgba(200,160,80,0.35)',
            border: '1px solid rgba(255,255,255,0.25)',
          }}
        >
          {busy ? 'Simulating…' : 'Start Simulation'}
        </button>
      </section>

      {result ? (
        <section
          ref={resultsRef}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 12,
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(0,0,0,0.22)',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Results</h3>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
            <span title="Chance one Chaos produces the target (remove→add model)">
              Hit / Chaos: <strong>{pct(result.hitRate)}</strong>
            </span>
            <span title="Expected applies to hit (CoE affix-table: Normal Chaos T1 ES% ≈ 44, Greater ≈ 21)">
              Expected Chaos:{' '}
              <strong>{result.expectedAttempts != null ? result.expectedAttempts.toFixed(1) : '—'}</strong>
            </span>
            <span title="Mean estimated chaos-equivalent cost on successful trials">
              Est. chaos cost:{' '}
              <strong>
                {(result as { expectedChaosCost?: number | null }).expectedChaosCost != null
                  ? (result as { expectedChaosCost: number }).expectedChaosCost.toFixed(1)
                  : '—'}
              </strong>
            </span>
          </div>
          {(result as { appliesByAction?: Record<string, number> }).appliesByAction ? (
            <div style={{ fontSize: 11, opacity: 0.75 }}>
              Avg applies by currency:{' '}
              {Object.entries((result as { appliesByAction: Record<string, number> }).appliesByAction)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([id, n]) => `${id.replace(/^currency:/, '')} ${n.toFixed(1)}`)
                .join(' · ')}
            </div>
          ) : null}
          <p style={{ margin: 0, fontSize: 11, opacity: 0.6 }}>{result.note}</p>
          {result.warnings?.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: '#e6c07b' }}>
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
          {result.hitRate === 0 ? (
            <p style={{ margin: 0, fontSize: 11, color: '#f0a0a0', lineHeight: 1.4 }}>
              0% usually means: condition text matches no mods on this base, currency couldn&apos;t apply (wrong
              rarity), or max attempts were too low. Use <strong>Browse mods</strong> so the condition is taken from
              this base&apos;s real pool.
            </p>
          ) : null}
          {result.sampleHitMods?.length ? (
            <div style={{ fontSize: 12 }}>
              <div style={{ opacity: 0.65, marginBottom: 4 }}>Sample hit mods</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {result.sampleHitMods.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

const fs = require('node:fs')
const path = require('node:path')
const p = path.join(__dirname, '..', 'plugins', 'scalpel-lab', 'src', 'CraftSequence.tsx')
let s = fs.readFileSync(p, 'utf8')

if (!s.includes("from './sequence-methods'")) {
  s = s.replace(
    "import { inputStyle, pct, selectStyle } from './craft-utils'",
    `import { inputStyle, pct, selectStyle } from './craft-utils'
import {
  BASE_METHODS,
  BONE_METHODS,
  catalystMethods,
  deleteRecipe,
  essenceMethods,
  loadRecipes,
  saveRecipe,
  type SavedRecipe,
} from './sequence-methods'`,
  )
}

s = s.replace(
  /const METHODS: Array<\{ id: string; label: string \}> = \[[\s\S]*?\]\r?\n\r?\nconst ON_SUCCESS/,
  `const ON_SUCCESS`,
)

// State additions after omens
if (!s.includes('const [catalyst, setCatalyst]')) {
  s = s.replace(
    `  const [omens, setOmens] = useState<string[]>([])
  const busyRef = useRef(false)`,
    `  const [omens, setOmens] = useState<string[]>([])
  const [catalyst, setCatalyst] = useState('')
  const [methods, setMethods] = useState(BASE_METHODS)
  const [recipes, setRecipes] = useState<SavedRecipe[]>(() => loadRecipes())
  const [omenStep, setOmenStep] = useState<number | 'global'>('global')
  const busyRef = useRef(false)`,
  )
}

// Load methods from listActions once
if (!s.includes('Load full method palette')) {
  s = s.replace(
    `  const baseType = selection?.baseType ?? sessionState?.baseType ?? null
  const itemLevel = selection?.itemLevel ?? sessionState?.itemLevel ?? 82

  const updateStep = useCallback`,
    `  const baseType = selection?.baseType ?? sessionState?.baseType ?? null
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
          setMethods([...BASE_METHODS, ...BONE_METHODS, ...catalystMethods(cats), ...essenceMethods(essenceNames)])
        }
      } catch {
        if (!cancelled) setMethods([...BASE_METHODS, ...BONE_METHODS])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [craft, baseType, itemLevel, selection?.quality])

  const updateStep = useCallback`,
  )
}

// Fix import useEffect
if (!s.includes('useEffect')) {
  s = s.replace(
    "import { useCallback, useMemo, useRef, useState } from 'react'",
    "import { useCallback, useEffect, useMemo, useRef, useState } from 'react'",
  )
}

// updateCondition supports index into conditions
s = s.replace(
  `  const updateCondition = useCallback((index: number, next: { query: string; minValue?: number }) => {
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s
        const conditions = s.conditions?.length ? [...s.conditions] : [{ query: '', kind: 'all' as const, countMin: 1 }]
        conditions[0] = {
          ...conditions[0],
          query: next.query,
          minValue: next.minValue,
        }
        return { ...s, conditions }
      }),
    )
  }, [])`,
  `  const updateCondition = useCallback(
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
  }, [])`,
)

// prepared omens: prefer step omens, fall back to global
s = s.replace(
  `    const prepared = steps.map((s) => ({
      ...s,
      omens: omens.length ? omens : s.omens,`,
  `    const prepared = steps.map((s) => ({
      ...s,
      omens: (s.omens && s.omens.length ? s.omens : omens).length
        ? s.omens && s.omens.length
          ? s.omens
          : omens
        : undefined,`,
)

s = s.replace(
  `      const config: CraftSequenceConfigResult = {
        baseType,
        itemLevel,
        quality: selection?.quality,
        rarity: 'Normal',
        steps: prepared,
        targetQuery: targetQuery.trim() || undefined,
        samples: Math.min(samples, 100),
        // Per-step chaos spam budget. T1 (~1% weight) needs hundreds of applies on average.
        maxTrials: 500,
      }`,
  `      const config: CraftSequenceConfigResult = {
        baseType,
        itemLevel,
        quality: selection?.quality ?? 20,
        catalyst: catalyst || undefined,
        rarity: 'Normal',
        steps: prepared,
        targetQuery: targetQuery.trim() || undefined,
        samples: Math.min(samples, 200),
        maxTrials: 500,
      }`,
)

s = s.replace(
  `  }, [baseType, craft, steps, omens, itemLevel, selection?.quality, targetQuery, samples])`,
  `  }, [baseType, craft, steps, omens, catalyst, itemLevel, selection?.quality, targetQuery, samples])`,
)

// Method select uses methods state with groups
s = s.replace(
  `                      {METHODS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}`,
  `                      {methods.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.group ? \`[\${m.group}] \${m.label}\` : m.label}
                        </option>
                      ))}`,
)

// Multi condition fields
s = s.replace(
  `              <ModConditionField
                craft={craft}
                baseType={baseType}
                itemLevel={itemLevel}
                value={{
                  query: step.conditions?.[0]?.query ?? '',
                  minValue: step.conditions?.[0]?.minValue,
                }}
                onChange={(next) => updateCondition(index, next)}
                disabled={step.requireConditions === false}
              />`,
  `              {(step.conditions?.length ? step.conditions : [{ query: '', kind: 'all' as const, countMin: 1 }]).map(
                (cond, ci) => (
                  <div key={\`\${step.id}-c\${ci}\`} style={{ display: 'flex', gap: 6, alignItems: 'start' }}>
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
                  Step omens {(step.omens?.length ?? 0) > 0 ? \`(\${step.omens!.length})\` : '(inherit global)'}
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
              </details>`,
)

// Omens section + catalyst + recipes + samples
s = s.replace(
  `      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Omens (applied to each step)</h3>
        {omenRow}
      </section>`,
  `      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                id: \`r\${Date.now().toString(36)}\`,
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
      </section>`,
)

s = s.replace(
  `            min={20}
            max={100}
            value={samples}
            onChange={(e) => setSamples(Math.min(100, Math.max(20, Number(e.target.value) || 60)))}
            style={{ ...inputStyle, width: 80 }}
            title="Capped at 100 so Scalpel stays responsive"`,
  `            min={20}
            max={200}
            value={samples}
            onChange={(e) => setSamples(Math.min(200, Math.max(20, Number(e.target.value) || 60)))}
            style={{ ...inputStyle, width: 80 }}
            title="Higher samples = stabler rare T1 estimates (slower)"`,
)

s = s.replace(
  `            <span style={{ opacity: 0.7 }}>{result.samples} trials</span>
          </div>
          <p style={{ margin: 0, fontSize: 11, opacity: 0.6 }}>{result.note}</p>`,
  `            <span style={{ opacity: 0.7 }}>{result.samples} trials</span>
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
                .map(([id, n]) => \`\${id.replace(/^currency:/, '')} \${n.toFixed(1)}\`)
                .join(' · ')}
            </div>
          ) : null}
          <p style={{ margin: 0, fontSize: 11, opacity: 0.6 }}>{result.note}</p>`,
)

// Remove unused omenStep if introduced
s = s.replace(`  const [omenStep, setOmenStep] = useState<number | 'global'>('global')\n`, '')

fs.writeFileSync(p, s)
console.log('CraftSequence UI patched')

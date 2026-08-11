import { useEffect, useMemo, useState } from 'react'
import type { CraftApi, ModGroupReportResult, ModPoolReportResult, ModTierReportResult } from '@scalpelpoe/plugin-sdk'
import { inputStyle, pct, selectStyle } from './craft-utils'

export interface ConditionValue {
  query: string
  minValue?: number
}

interface ModConditionFieldProps {
  craft: CraftApi
  baseType: string | null
  itemLevel: number
  value: ConditionValue
  disabled?: boolean
  onChange: (next: ConditionValue) => void
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Strip rolls / `#` placeholders so `(#-#)% ES` matches `(92-100)% ES`. */
function templateForm(s: string): string {
  return normalize(
    s
      .replace(/-?\d+(?:\.\d+)?/g, '#')
      .replace(/#+/g, '#')
      .replace(/\(#-#\)%/g, '%')
      .replace(/#%/g, '%')
      .replace(/\(#-#\)/g, '')
      .replace(/\+#/g, '+')
      .replace(/#/g, '')
      .replace(/\s*,\s*/g, ', ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

/** Primary limb only — hybrid ", +X to Stun" tails break registration. */
function primaryClause(s: string): string {
  return templateForm(s.split(',')[0] ?? s)
}

function firstNumber(text: string): number | null {
  const m = text.match(/-?\d+(?:\.\d+)?/)
  return m ? Number(m[0]) : null
}

function tierMatchesNeedle(tierText: string, needle: string): boolean {
  const n = primaryClause(needle)
  if (!n) return false
  const t = primaryClause(tierText)
  return t.includes(n) || n.includes(t)
}

function groupMatchesQuery(g: ModGroupReportResult, query: string): boolean {
  const q = primaryClause(query)
  if (!q) return false
  if (g.tiers.some((t) => tierMatchesNeedle(t.text, q))) return true
  const hay = templateForm([g.displayName, g.group, g.bestTierText].join(' '))
  return hay.includes(q) || q.includes(templateForm(g.displayName))
}

/** Needle without numbers — used with minValue for tier gates. */
function needleFromTier(g: ModGroupReportResult, tier: ModTierReportResult): string {
  const template = tier.text.replace(/\d+(?:\.\d+)?/g, '#').replace(/#+/g, '#')
  const cleaned = template
    .replace(/\(#-#\)%/g, '%')
    .replace(/#%/g, '%')
    .replace(/\(#-#\)/g, '')
    .replace(/\+#/g, '+')
    .replace(/#/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  // Keep only the first clause so hybrid ES+Stun registers as "% increased Energy Shield".
  const primary = (cleaned.split(',')[0] ?? cleaned).trim()
  if (primary.length >= 8) return primary
  if (cleaned.length >= 8) return cleaned
  return g.displayName
}

function tierLabel(tiers: ModTierReportResult[], index: number): string {
  // Highest ilvl / listed first in CoE-style sheets is usually best tier.
  // Display as T1 = best (index 0 after sort by ilvl desc).
  return `T${index + 1}`
}

export function ModConditionField({
  craft,
  baseType,
  itemLevel,
  value,
  disabled,
  onChange,
}: ModConditionFieldProps): JSX.Element {
  const [pool, setPool] = useState<ModPoolReportResult | null>(null)
  const [poolError, setPoolError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (!baseType) {
      setPool(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const report = await craft.modPool({ baseType, itemLevel, kind: 'all', context: 'fresh' })
        if (!cancelled) {
          setPool(report)
          setPoolError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setPool(null)
          setPoolError(err instanceof Error ? err.message : String(err))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [craft, baseType, itemLevel])

  const groups = useMemo(() => {
    if (!pool) return []
    return pool.groups.slice().sort((a, b) => b.groupChance - a.groupChance)
  }, [pool])

  const filtered = useMemo(() => {
    const q = normalize(filter)
    if (!q) return groups.slice(0, 40)
    return groups.filter((g) => groupMatchesQuery(g, q)).slice(0, 40)
  }, [groups, filter])

  const matchInfo = useMemo(() => {
    // Strip `>=92` / parens; match tiers by primary clause (ignore hybrid ", +…" tails).
    const q = primaryClause(
      value.query
        .replace(/^\(+/, '')
        .replace(/\)+$/, '')
        .replace(/^>=\s*-?\d+(?:\.\d+)?\s*%?\s*/i, ''),
    )
    if (!q || !pool) return null
    const tiers: Array<{ text: string; min: number | null; weight: number; groupWeight: number; groupTierWeight: number }> =
      []
    for (const g of groups) {
      const groupTierWeight = Math.max(
        1,
        g.tiers.reduce((a, t) => a + t.spawnWeight, 0),
      )
      for (const t of g.tiers) {
        if (!tierMatchesNeedle(t.text, q)) continue
        const min = firstNumber(t.text)
        if (value.minValue != null && (min == null || min < value.minValue)) continue
        tiers.push({
          text: t.text,
          min,
          weight: t.spawnWeight,
          groupWeight: g.groupWeight,
          groupTierWeight,
        })
      }
    }
    // Weight ≈ sum over matching tiers of groupWeight * (tierWeight / groupTierWeights)
    const weight = tiers.reduce((s, t) => s + t.groupWeight * (t.weight / t.groupTierWeight), 0)
    const chance = pool.totalWeight > 0 ? weight / pool.totalWeight : 0
    const samples = [...tiers]
      .sort((a, b) => (b.min ?? 0) - (a.min ?? 0))
      .slice(0, 3)
      .map((t) => t.text)
    return {
      groupCount: new Set(tiers.map((t) => t.text)).size,
      tierCount: tiers.length,
      chance,
      samples,
    }
  }, [value, pool, groups])

  const pickTier = (g: ModGroupReportResult) =>
    [...g.tiers].sort((a, b) => b.ilvl - a.ilvl || b.spawnWeight - a.spawnWeight)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 3 }}>
        Condition — pick a <strong>tier</strong> (T1 = best), or type <code style={{ opacity: 0.85 }}>&gt;=92 % increased…</code>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input
            value={value.query}
            onChange={(e) => {
              const raw = e.target.value
              // Keep leading % on the needle (`>=92% increased…` → `>=92 % increased…`).
              const stripped = raw.trim().replace(/^\(+/, '').replace(/\)+$/, '')
              const ge = stripped.match(/^>=\s*(-?\d+(?:\.\d+)?)(%?)\s*(.*)$/i)
              if (ge) {
                const n = Number(ge[1])
                const pct = ge[2] ?? ''
                const rest = (ge[3] ?? '').trim()
                let needle =
                  pct && rest && !rest.startsWith('%') ? `${pct} ${rest}` : `${pct}${rest}`.trim()
                needle = needle
                  .replace(/^\(#-#\)%\s*/i, '% ')
                  .replace(/^#%\s*/i, '% ')
                  .replace(/^\(#-#\)\s*/i, '')
                  .trim()
                onChange({ query: `>=${n} ${needle}`.trim(), minValue: n })
              } else {
                onChange({ query: raw, minValue: undefined })
              }
            }}
            placeholder="Browse → expand group → click T1"
            style={{ ...inputStyle, flex: 1, minWidth: 160 }}
            disabled={disabled}
          />
          <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
            Min roll
            <input
              type="number"
              disabled={disabled}
              value={value.minValue ?? ''}
              placeholder="any"
              onChange={(e) => {
                const n = e.target.value === '' ? undefined : Number(e.target.value)
                let needle = value.query
                  .replace(/^\(+/, '')
                  .replace(/\)+$/, '')
                  .replace(/^>=\s*-?\d+(?:\.\d+)?\s*%?\s*/i, '')
                  .trim()
                needle = needle
                  .replace(/^\(#-#\)%\s*/i, '% ')
                  .replace(/^#%\s*/i, '% ')
                  .replace(/^\(#-#\)\s*/i, '')
                  .trim()
                if (n != null && Number.isFinite(n)) {
                  onChange({ query: `>=${n} ${needle}`.trim(), minValue: n })
                } else {
                  onChange({ query: needle, minValue: undefined })
                }
              }}
              style={{ ...inputStyle, width: 72 }}
              title="First number on the mod must be >= this (92 for T1 local ES%)"
            />
          </label>
          <button
            type="button"
            disabled={disabled || !baseType}
            onClick={() => setOpen((v) => !v)}
            style={{ ...selectStyle, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {open ? 'Hide mods' : 'Browse mods'}
          </button>
        </div>
      </label>

      {poolError ? <span style={{ fontSize: 11, color: '#f0a0a0' }}>{poolError}</span> : null}

      {!value.query.trim() ? (
        <span style={{ fontSize: 11, opacity: 0.55 }}>
          No condition — open Browse mods, expand a group, click <strong>T1</strong> for the top tier only.
        </span>
      ) : matchInfo ? (
        <span
          style={{
            fontSize: 11,
            color: matchInfo.tierCount > 0 ? '#9dcea8' : '#f0a0a0',
            lineHeight: 1.4,
          }}
        >
          {matchInfo.tierCount > 0 ? (
            <>
              Registered: <strong>{matchInfo.tierCount}</strong> tier(s)
              {value.minValue != null ? (
                <>
                  {' '}
                  with first roll ≥ <strong>{value.minValue}</strong>
                </>
              ) : (
                <> (any tier — set Min roll or pick T1)</>
              )}
              {' · '}~{pct(matchInfo.chance)} of affix weight
              {matchInfo.samples[0] ? (
                <>
                  <br />
                  Counts e.g. {matchInfo.samples[0]}
                </>
              ) : null}
            </>
          ) : (
            <>
              No tiers on {baseType ?? 'this base'} satisfy
              {value.minValue != null ? ` ≥ ${value.minValue}` : ''} — pick a lower tier or different mod.
            </>
          )}
        </span>
      ) : (
        <span style={{ fontSize: 11, opacity: 0.55 }}>Loading mod pool for this base…</span>
      )}

      {open && baseType ? (
        <div
          style={{
            maxHeight: 280,
            overflow: 'auto',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 6,
            background: 'rgba(0,0,0,0.28)',
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={`Filter ${pool?.groupCount ?? 0} mod groups on ${baseType}…`}
            style={inputStyle}
          />
          {filtered.map((g) => {
            const key = `${g.kind}-${g.group}`
            const tiers = pickTier(g)
            const isOpen = expanded === key
            return (
              <div key={key} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4 }}>
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : key)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 8px',
                    border: 'none',
                    background: 'rgba(255,255,255,0.04)',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontSize: 11,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong>
                      {isOpen ? '▾' : '▸'} {g.kind === 'p' ? 'P' : 'S'} · {g.displayName}
                    </strong>
                    <span style={{ opacity: 0.7 }}>
                      {tiers.length} tiers · {pct(g.groupChance)}
                    </span>
                  </div>
                  <div style={{ opacity: 0.75 }}>Best: {g.bestTierText}</div>
                </button>
                {isOpen ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 6 }}>
                    {tiers.map((t, i) => {
                      const min = firstNumber(t.text)
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            const needle = needleFromTier(g, t)
                            if (min != null) {
                              onChange({ query: `>=${min} ${needle}`, minValue: min })
                            } else {
                              onChange({ query: needle, minValue: undefined })
                            }
                            setOpen(false)
                          }}
                          style={{
                            textAlign: 'left',
                            padding: '5px 8px',
                            borderRadius: 3,
                            border: '1px solid rgba(255,255,255,0.08)',
                            background: i === 0 ? 'rgba(200,160,80,0.18)' : 'rgba(0,0,0,0.2)',
                            color: 'inherit',
                            cursor: 'pointer',
                            fontSize: 11,
                          }}
                        >
                          <strong style={{ color: i === 0 ? '#e6c07b' : 'inherit' }}>
                            {tierLabel(tiers, i)}
                            {min != null ? ` · ≥${min}` : ''}
                          </strong>
                          {' — '}
                          {t.text}
                          <span style={{ opacity: 0.55 }}> · ilvl {t.ilvl}</span>
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          })}
          {!filtered.length ? <span style={{ fontSize: 11, opacity: 0.55 }}>No groups match filter.</span> : null}
        </div>
      ) : null}
    </div>
  )
}

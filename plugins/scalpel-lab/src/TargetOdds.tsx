import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CraftApi, CraftItemStateResult, ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { Button, ItemChip } from '@scalpelpoe/plugin-sdk'
import type { PoeItem } from '@scalpelpoe/plugin-sdk'
import { inputStyle, pct, selectStyle } from './craft-utils'
import type { CraftTabProps } from './craft-build-context'

type TargetResult = Awaited<ReturnType<CraftApi['targetHit']>>
type CraftActionResult = Awaited<ReturnType<CraftApi['listActions']>>[number]

interface TargetOddsProps extends CraftTabProps {
  craft: CraftApi
  ctx: ScalpelPluginContext
  item: PoeItem | null
  sessionState: CraftItemStateResult | null
  onItemChange: (item: PoeItem | null) => void
  onSessionChange: (state: CraftItemStateResult | null) => void
}

export function TargetOdds({
  craft,
  item,
  sessionState,
  onSmartImport,
}: TargetOddsProps): JSX.Element {
  const [state, setState] = useState<CraftItemStateResult | null>(sessionState)
  const [target, setTarget] = useState('')
  const [actionId, setActionId] = useState('currency:Chaos Orb')
  const [kind, setKind] = useState<'all' | 'p' | 's'>('all')
  const [result, setResult] = useState<TargetResult | null>(null)
  const [actions, setActions] = useState<CraftActionResult[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (sessionState) setState(sessionState)
  }, [sessionState])

  const refreshActions = useCallback(
    async (s: CraftItemStateResult) => {
      const poe = {
        ...(item ?? ({} as PoeItem)),
        baseType: s.baseType,
        itemLevel: s.itemLevel,
        rarity: s.rarity,
        itemClass: s.itemClass,
        corrupted: s.corrupted,
        explicits: s.mods.map((m) => m.text),
        advancedMods: s.mods.map((m) => ({
          type: m.kind === 'p' ? 'prefix' : 'suffix',
          name: m.name ?? m.group,
          lines: [m.text],
        })),
      } as PoeItem
      setActions((await craft.listActions(poe)).filter((a) => !a.id.startsWith('pool:')))
    },
    [craft, item],
  )

  useEffect(() => {
    if (state) void refreshActions(state)
  }, [state, refreshActions])

  const run = useCallback(async () => {
    if (!state) {
      setError('Import an item or craft one in the Emulator tab first.')
      return
    }
    if (!target.trim()) {
      setError('Enter a target mod to search for.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      setResult(
        await craft.targetHit({
          state,
          actionId,
          targetQuery: target.trim(),
          kind,
          samples: 5000,
        }),
      )
    } catch (err) {
      setResult(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [craft, state, actionId, target, kind])

  useEffect(() => {
    if (state && target.trim()) void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, actionId, target, kind])

  const importItem = useCallback(async () => {
    setError(null)
    try {
      const msg = await onSmartImport()
      if (!msg) {
        setError('No PoE item on cursor.')
        return
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [onSmartImport])

  const currencyOptions = useMemo(
    () =>
      actions.filter(
        (a) =>
          a.applies ||
          /Chaos|Exalt|Alteration|Annul|Fractur|Divine|Alchemy|Regal|Transmutation|Augmentation|Vaal|Essence|desecration/i.test(
            a.id + a.label,
          ),
      ),
    [actions],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', minHeight: 0 }}>
      <p style={{ margin: 0, fontSize: 11, opacity: 0.65, lineHeight: 1.45 }}>
        Pick a target mod and currency. Skill levels like &quot;+2 Projectile Skills&quot; roll on{' '}
        <strong>Iron Ring</strong>, <strong>Lunar Amulet</strong>, rune bows — not gloves. Marksman adds a separate pool
        (Projectile Damage, Pierce) — not skill levels. Uses Emulator item if you switched tabs.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button disabled={busy} onClick={() => void importItem()}>
          Import hovered item
        </Button>
        {state ? (
          <ItemChip
            name={`${state.rarity} ${state.baseType}`}
            itemClass={state.itemClass}
            title={`iLvl ${state.itemLevel} · ${state.mods.length} mods`}
          />
        ) : null}
      </div>

      {error ? (
        <div style={{ padding: '8px 10px', borderRadius: 4, background: 'rgba(255,140,0,0.15)', fontSize: 12 }}>{error}</div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 600, opacity: 0.85 }}>Target mod (search)</label>
          <input
            type="search"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder='e.g. "projectile level", "maximum Life", "fire resistance"'
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 600, opacity: 0.85 }}>Craft method</label>
          <select value={actionId} onChange={(e) => setActionId(e.target.value)} style={selectStyle}>
            {currencyOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
                {!a.applies ? ' — N/A now' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {(['all', 'p', 's'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            style={{
              ...selectStyle,
              background: kind === k ? 'rgba(255,255,255,0.12)' : selectStyle.background,
              fontWeight: kind === k ? 600 : 400,
            }}
          >
            {k === 'all' ? 'Any' : k === 'p' ? 'Prefix' : 'Suffix'}
          </button>
        ))}
        <Button disabled={busy} onClick={() => void run()}>
          Recalculate
        </Button>
      </div>

      {result ? (
        <section style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13 }}>
            <strong>{pct(result.hitPerAttempt)}</strong> per {result.label}
            {result.expectedAttempts != null ? (
              <span style={{ opacity: 0.75 }}> · ~{result.expectedAttempts.toFixed(1)} attempts on average</span>
            ) : null}
          </div>
          <p style={{ margin: 0, fontSize: 11, opacity: 0.65 }}>{result.note}</p>

          {result.attemptsTable.length ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: 'left', opacity: 0.7 }}>
                  <th style={{ padding: '6px 8px' }}>Attempts</th>
                  <th style={{ padding: '6px 8px' }}>Chance to hit at least once</th>
                </tr>
              </thead>
              <tbody>
                {result.attemptsTable.map((row) => (
                  <tr key={row.attempts} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: '6px 8px' }}>{row.attempts}</td>
                    <td style={{ padding: '6px 8px', fontVariantNumeric: 'tabular-nums' }}>{pct(row.probability)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {result.matchingOutcomes.length ? (
            <>
              <h4 style={{ margin: '8px 0 0', fontSize: 12, opacity: 0.8 }}>Matching mods contributing to hit chance</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <tbody>
                  {result.matchingOutcomes.slice(0, 15).map((o) => (
                    <tr key={`${o.group}-${o.text}`} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{pct(o.probability)}</td>
                      <td style={{ padding: '6px 8px' }}>{o.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>No mods on this base match that search for this method.</p>
          )}
        </section>
      ) : null}
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import type { CraftApi, CraftItemStateResult, ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { Button, ItemChip } from '@scalpelpoe/plugin-sdk'
import type { PoeItem } from '@scalpelpoe/plugin-sdk'
import { inputStyle, pct, selectStyle } from './craft-utils'
import type { CraftTabProps } from './craft-build-context'

type PathResult = Awaited<ReturnType<CraftApi['craftPath']>>

interface CraftPathProps extends CraftTabProps {
  craft: CraftApi
  ctx: ScalpelPluginContext
  item: PoeItem | null
  sessionState: CraftItemStateResult | null
  onItemChange: (item: PoeItem | null) => void
  onSessionChange: (state: CraftItemStateResult | null) => void
}

const PRESETS = [
  { id: 'alt-spam', name: 'Alt until hit' },
  { id: 'alt-regal', name: 'Alt → Regal' },
  { id: 'scour-alt-regal', name: 'Scour → Trans → Alt → Regal' },
  { id: 'chaos-spam', name: 'Chaos spam' },
  { id: 'alt-aug-regal', name: 'Alt → Aug → Regal' },
] as const

export function CraftPath({
  craft,
  sessionState,
  onSmartImport,
}: CraftPathProps): JSX.Element {
  const [state, setState] = useState<CraftItemStateResult | null>(sessionState)
  const [target, setTarget] = useState('')
  const [preset, setPreset] = useState<(typeof PRESETS)[number]['id']>('alt-regal')
  const [result, setResult] = useState<PathResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (sessionState) setState(sessionState)
  }, [sessionState])

  const run = useCallback(async () => {
    if (busy) return
    if (!state) {
      setError('Import an item or craft one in the Emulator tab first.')
      return
    }
    if (!target.trim()) {
      setError('Enter a target mod.')
      return
    }
    const stepsByPreset: Record<(typeof PRESETS)[number]['id'], Array<{ actionId: string; repeatUntilHit?: boolean }>> = {
      'alt-spam': [{ actionId: 'currency:Orb of Alteration', repeatUntilHit: true }],
      'alt-regal': [
        { actionId: 'currency:Orb of Alteration', repeatUntilHit: true },
        { actionId: 'currency:Regal Orb' },
      ],
      'scour-alt-regal': [
        { actionId: 'currency:Orb of Scouring' },
        { actionId: 'currency:Orb of Transmutation' },
        { actionId: 'currency:Orb of Alteration', repeatUntilHit: true },
        { actionId: 'currency:Regal Orb' },
      ],
      'chaos-spam': [{ actionId: 'currency:Chaos Orb', repeatUntilHit: true }],
      'alt-aug-regal': [
        { actionId: 'currency:Orb of Alteration', repeatUntilHit: true },
        { actionId: 'currency:Orb of Augmentation' },
        { actionId: 'currency:Regal Orb' },
      ],
    }
    const steps = stepsByPreset[preset]
    if (preset === 'chaos-spam' && state.rarity !== 'Rare') {
      setError('Chaos spam needs a Rare item — use Emulator to alchemy first, or pick Alt/Scour recipe.')
      setResult(null)
      return
    }
    if (preset.startsWith('alt') && state.rarity !== 'Magic' && preset !== 'scour-alt-regal') {
      setError('Alt recipes need a Magic item — scour + transmute in Emulator, or use Scour → Trans → Alt → Regal.')
      setResult(null)
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (!craft.craftPath) {
        setError('Craft path API missing — relaunch via Launch Scalpel.bat to rebuild.')
        return
      }
      setResult(
        await craft.craftPath({
          state,
          steps,
          targetQuery: target.trim(),
          kind: 'all',
          maxTrials: 40,
          samples: 250,
        }),
      )
    } catch (err) {
      setResult(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [craft, state, target, preset, busy])

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', minHeight: 0 }}>
      <p style={{ margin: 0, fontSize: 11, opacity: 0.65, lineHeight: 1.45 }}>
        Multi-step craft recipes — e.g. alt until life, then regal. Uses Emulator item state when available.
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
          <label style={{ fontSize: 12, fontWeight: 600, opacity: 0.85 }}>Target mod</label>
          <input
            type="search"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder='e.g. "projectile level", "life"'
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 600, opacity: 0.85 }}>Recipe</label>
          <select
            value={preset}
            disabled={busy}
            onChange={(e) => {
              setPreset(e.target.value as typeof preset)
              setResult(null)
            }}
            style={selectStyle}
          >
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Button disabled={busy || !state} onClick={() => void run()}>
        {busy ? 'Calculating…' : 'Calculate path odds'}
      </Button>

      {result ? (
        <section style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <div style={{ fontSize: 13 }}>
            <strong>{pct(result.hitRate)}</strong> to complete recipe with target
            {result.expectedAttempts != null ? (
              <span style={{ opacity: 0.75 }}> · ~{result.expectedAttempts.toFixed(1)} full attempts on average</span>
            ) : null}
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 11, opacity: 0.65 }}>{result.note}</p>
          {result.attemptsTable.length ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 8 }}>
              <thead>
                <tr style={{ textAlign: 'left', opacity: 0.7 }}>
                  <th style={{ padding: '6px 8px' }}>Full recipe runs</th>
                  <th style={{ padding: '6px 8px' }}>Chance ≥1 success</th>
                </tr>
              </thead>
              <tbody>
                {result.attemptsTable.map((row) => (
                  <tr key={row.attempts} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: '6px 8px' }}>{row.attempts}</td>
                    <td style={{ padding: '6px 8px' }}>{pct(row.probability)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

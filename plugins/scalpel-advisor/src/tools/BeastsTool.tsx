import type { ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { useCallback, useEffect, useMemo, useState } from 'react'
import beastsRefJson from '../data/beasts-ref.json'
import {
  computeBeastFarm,
  optimizeBeastFarm,
  type Beast,
  type BeastAtlasBonuses,
  type BeastClassificationBoosts,
  type BeastScarabConfig,
  type BeastThhMarkup,
  type BeastsRef,
} from '../engines/beasts'
import { indexPriceIcons } from '../shared/icons'
import { ItemName } from '../shared/ItemName'
import { chaosForId, chaosForName, fmtChaos, fmtSignedChaos, idToName, indexPrices } from '../shared/prices'
import { ToolHeader } from '../shared/ToolChrome'
import { accentBtnStyle, inputStyle, theme } from '../shared/theme'
import {
  ActionChip,
  FieldLabel,
  HeroMetric,
  HeroRow,
  ListRow,
  SetupGroup,
  SplitBody,
  Workbench,
  fonts,
} from '../shared/ui'

const REF = beastsRefJson as BeastsRef
const BEASTS = REF.beasts

const HERD_SCARAB_ID = 'bestiary-scarab-of-the-herd'
const DUPLICATING_SCARAB_ID = 'bestiary-scarab-of-duplicating'

const DEFAULT_ATLAS: BeastAtlasBonuses = {
  additionalRedPct: 30,
  additionalYellow: 2,
  yellowToRedPct: 15,
  pairChancePct: 8,
}

const DEFAULT_THH: BeastThhMarkup = { markup10Pct: 5, markup20Pct: 10 }

const DEFAULT_SCARABS: BeastScarabConfig = {
  herdQty: 0,
  herdPrice: 0,
  duplicatingQty: 0,
  duplicatingPrice: 0,
}

export function BeastsTool({
  ctx,
  onBack,
}: {
  ctx: ScalpelPluginContext
  onBack: () => void
}): JSX.Element {
  const [atlas, setAtlas] = useState<BeastAtlasBonuses>(DEFAULT_ATLAS)
  const [thh, setThh] = useState<BeastThhMarkup>(DEFAULT_THH)
  const [scarabs, setScarabs] = useState<BeastScarabConfig>(DEFAULT_SCARABS)
  const [boosts, setBoosts] = useState<BeastClassificationBoosts>(() =>
    Object.fromEntries(REF.classifications.map((c) => [c, false])),
  )
  const [yellowPrice, setYellowPrice] = useState(0)
  const [discardBelow, setDiscardBelow] = useState(5)
  const [timeSec, setTimeSec] = useState(240)
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number | null>>({})
  const [cpd, setCpd] = useState(180)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [priceIcons, setPriceIcons] = useState<Map<string, string>>(() => new Map())

  const priceFor = useCallback(
    (beast: Beast): number | null => {
      const override = priceOverrides[beast.name]
      if (override !== undefined) return override
      return null
    },
    [priceOverrides],
  )

  const refresh = useCallback(async () => {
    setStatus('Fetching prices…')
    try {
      await ctx.prices.refresh()
      const { prices: list } = await ctx.prices.getPrices()
      const byName = indexPrices(list)
      setPriceIcons(indexPriceIcons(list))
      setCpd(chaosForName(byName, 'Divine Orb') ?? 180)

      const next: Record<string, number | null> = {}
      for (const beast of BEASTS) {
        const byId = beast.priceId ? chaosForId(byName, beast.priceId) : null
        next[beast.name] = byId ?? chaosForName(byName, beast.name)
      }
      setPriceOverrides(next)

      setScarabs((s) => ({
        ...s,
        herdPrice: chaosForId(byName, HERD_SCARAB_ID) ?? s.herdPrice,
        duplicatingPrice: chaosForId(byName, DUPLICATING_SCARAB_ID) ?? s.duplicatingPrice,
      }))

      setStatus(`poe.ninja · ${ctx.getLeague()} · ${BEASTS.length} beasts (bundled weights)`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    }
  }, [ctx])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const result = useMemo(
    () =>
      computeBeastFarm({
        beasts: BEASTS,
        classificationBoosts: boosts,
        priceFor,
        atlas,
        thh,
        scarabs,
        yellowPrice,
        discardBelow,
        timePerMapSec: timeSec,
      }),
    [boosts, priceFor, atlas, thh, scarabs, yellowPrice, discardBelow, timeSec],
  )

  const optimize = () => {
    setBusy(true)
    setTimeout(() => {
      const best = optimizeBeastFarm(
        {
          beasts: BEASTS,
          classificationBoosts: boosts,
          priceFor,
          atlas,
          thh,
          scarabs,
          yellowPrice,
          discardBelow,
          timePerMapSec: timeSec,
        },
        REF.classifications,
      )
      setScarabs((s) => ({ ...s, herdQty: best.herdQty, duplicatingQty: best.duplicatingQty }))
      setBoosts(best.boosts)
      setBusy(false)
    }, 10)
  }

  return (
    <Workbench>
      <ToolHeader
        toolId="beasts"
        title="Beasts"
        onBack={onBack}
        status={status}
        onRefresh={() => void refresh()}
      />

      <SplitBody
        railWidth={260}
        rail={
          <>
            <button type="button" style={accentBtnStyle} onClick={optimize} disabled={busy}>
              {busy ? 'Working…' : 'Optimize scarabs'}
            </button>
            <SetupGroup title="Atlas">
              <FieldLabel label="+ Red %">
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="number"
                  value={atlas.additionalRedPct}
                  onChange={(e) => setAtlas((a) => ({ ...a, additionalRedPct: Number(e.target.value) || 0 }))}
                />
              </FieldLabel>
              <FieldLabel label="+ Yellow">
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="number"
                  value={atlas.additionalYellow}
                  onChange={(e) => setAtlas((a) => ({ ...a, additionalYellow: Number(e.target.value) || 0 }))}
                />
              </FieldLabel>
              <FieldLabel label="Yellow → Red %">
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="number"
                  value={atlas.yellowToRedPct}
                  onChange={(e) => setAtlas((a) => ({ ...a, yellowToRedPct: Number(e.target.value) || 0 }))}
                />
              </FieldLabel>
              <FieldLabel label="Pair %">
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="number"
                  value={atlas.pairChancePct}
                  onChange={(e) => setAtlas((a) => ({ ...a, pairChancePct: Number(e.target.value) || 0 }))}
                />
              </FieldLabel>
            </SetupGroup>
            <SetupGroup title="Scarabs & pace" defaultOpen={false}>
              <FieldLabel
                label={
                  <ItemName name={idToName(HERD_SCARAB_ID)} size={14} opts={{ priceIcons }}>
                    Herd qty
                  </ItemName>
                }
              >
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="number"
                  min={0}
                  value={scarabs.herdQty}
                  onChange={(e) => setScarabs((s) => ({ ...s, herdQty: Number(e.target.value) || 0 }))}
                />
              </FieldLabel>
              <FieldLabel label="Herd price">
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="number"
                  value={scarabs.herdPrice}
                  onChange={(e) => setScarabs((s) => ({ ...s, herdPrice: Number(e.target.value) || 0 }))}
                />
              </FieldLabel>
              <label style={{ display: 'flex', gap: 8, fontSize: 12, color: theme.text, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={scarabs.duplicatingQty > 0}
                  onChange={(e) => setScarabs((s) => ({ ...s, duplicatingQty: e.target.checked ? 1 : 0 }))}
                />
                <ItemName name={idToName(DUPLICATING_SCARAB_ID)} size={16} opts={{ priceIcons }}>
                  Duplicating
                </ItemName>
              </label>
              <FieldLabel label="Sec / map">
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="number"
                  value={timeSec}
                  onChange={(e) => setTimeSec(Number(e.target.value) || 240)}
                />
              </FieldLabel>
              <FieldLabel label="Discard below">
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="number"
                  value={discardBelow}
                  onChange={(e) => setDiscardBelow(Number(e.target.value) || 0)}
                />
              </FieldLabel>
            </SetupGroup>
            <SetupGroup title="Classification ×2" defaultOpen={false}>
              {REF.classifications.map((c) => (
                <ActionChip
                  key={c}
                  label={c.replace(/^The /, '')}
                  active={!!boosts[c]}
                  onClick={() => setBoosts((b) => ({ ...b, [c]: !b[c] }))}
                />
              ))}
            </SetupGroup>
            <SetupGroup title="THH markup" defaultOpen={false}>
              <FieldLabel label="10% tier">
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="number"
                  value={thh.markup10Pct}
                  onChange={(e) => setThh((t) => ({ ...t, markup10Pct: Number(e.target.value) || 0 }))}
                />
              </FieldLabel>
              <FieldLabel label="20% tier">
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="number"
                  value={thh.markup20Pct}
                  onChange={(e) => setThh((t) => ({ ...t, markup20Pct: Number(e.target.value) || 0 }))}
                />
              </FieldLabel>
            </SetupGroup>
          </>
        }
        stage={
          <>
            <HeroRow>
              <HeroMetric label="Net / map" value={fmtSignedChaos(result.netEvPerMap, cpd)} tone="good" />
              <HeroMetric label="Net / hour" value={fmtSignedChaos(result.netEvPerHour, cpd)} tone="good" />
              <HeroMetric
                label="Gross / map"
                value={fmtChaos(result.grossEvPerMap, cpd)}
                tone="ink"
                sub={`scarab −${fmtChaos(result.scarabCost, cpd)}`}
              />
              <HeroMetric
                label="Reds / map"
                value={result.totalRedBeasts.toFixed(2)}
                tone="accent"
                sub={`${result.effectiveRed.toFixed(1)}r / ${result.effectiveYellow.toFixed(1)}y spawn`}
              />
            </HeroRow>

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: `1px solid ${theme.border}` }}>
              {result.distribution.map((row) => (
                <ListRow
                  key={row.beast.name}
                  muted={row.discarded}
                  leading={
                    <div>
                      <ItemName
                        name={row.beast.name}
                        opts={{
                          priceIcons,
                          aliases: row.beast.priceId ? [idToName(row.beast.priceId)] : undefined,
                        }}
                      >
                        <span style={{ fontFamily: fonts.display, fontSize: 14, color: theme.ink }}>
                          {row.beast.name}
                          {row.boostMult > 1 ? (
                            <span style={{ color: theme.accent, fontSize: 11 }}> ×{row.boostMult}</span>
                          ) : null}
                        </span>
                      </ItemName>
                      <div style={{ fontSize: 10, color: theme.muted, marginTop: 2 }}>
                        {row.beast.classification} · {(row.probability * 100).toFixed(2)}%
                      </div>
                    </div>
                  }
                  trailing={
                    <>
                      <span className="sa-num" style={{ color: theme.dim, minWidth: 48, textAlign: 'right' }}>
                        {row.hasPrice ? fmtChaos(row.price, cpd) : '—'}
                      </span>
                      <span className="sa-num" style={{ color: theme.green, minWidth: 56, textAlign: 'right' }}>
                        {fmtChaos(row.contribution, cpd)}
                      </span>
                    </>
                  }
                />
              ))}
            </div>
          </>
        }
      />
    </Workbench>
  )
}



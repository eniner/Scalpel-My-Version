import type { ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import essencesRefJson from '../data/essences-ref.json'
import {
  computeEssenceFarm,
  essenceId,
  type EssenceValuationMode,
  type EssenceVaalMode,
  type EssencesRef,
} from '../engines/essences'
import { indexPriceIcons } from '../shared/icons'
import { ItemName } from '../shared/ItemName'
import { chaosForId, chaosForName, fmtChaos, fmtSignedChaos, idToName, indexPrices } from '../shared/prices'
import { ToolHeader } from '../shared/ToolChrome'
import { inputStyle, theme } from '../shared/theme'
import {
  FieldLabel,
  HeroMetric,
  HeroRow,
  ListRow,
  SetupGroup,
  SplitBody,
  Workbench,
  fonts,
} from '../shared/ui'

const REF = essencesRefJson as EssencesRef

type ScarabState = {
  ascentQty: number
  ascentPrice: number
  essenceQty: number
  essencePrice: number
  calcificationQty: number
  calcificationPrice: number
  adversariesQty: number
  adversariesPrice: number
  stabilityQty: number
  stabilityPrice: number
}

const DEFAULT_SCARABS: ScarabState = {
  ascentQty: 0,
  ascentPrice: 1,
  essenceQty: 0,
  essencePrice: 1,
  calcificationQty: 0,
  calcificationPrice: 5,
  adversariesQty: 0,
  adversariesPrice: 1,
  stabilityQty: 0,
  stabilityPrice: 10,
}

const SCARAB_IDS: Record<keyof Omit<ScarabState, 'ascentPrice' | 'essencePrice' | 'calcificationPrice' | 'adversariesPrice' | 'stabilityPrice'>, string> = {
  ascentQty: 'essence-scarab-of-ascent',
  essenceQty: 'essence-scarab',
  calcificationQty: 'essence-scarab-of-calcification',
  adversariesQty: 'scarab-of-adversaries',
  stabilityQty: 'essence-scarab-of-stability',
}

export function EssencesTool({
  ctx,
  onBack,
}: {
  ctx: ScalpelPluginContext
  onBack: () => void
}): JSX.Element {
  const [rareMonstersPerMap, setRareMonstersPerMap] = useState(10)
  const [timeSec, setTimeSec] = useState(240)
  const [valuation, setValuation] = useState<EssenceValuationMode>('deafening')
  const [vaalMode, setVaalMode] = useState<EssenceVaalMode>('all')
  const [vaalOrbPrice, setVaalOrbPrice] = useState(1)
  const [amplifiedEnergies, setAmplifiedEnergies] = useState(false)
  const [prolificEssence, setProlificEssence] = useState(false)
  const [crystalLattice, setCrystalLattice] = useState(true)
  const [crystalResonance, setCrystalResonance] = useState(false)
  const [scarabs, setScarabs] = useState<ScarabState>(DEFAULT_SCARABS)
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number | null>>({})
  const [cpd, setCpd] = useState(180)
  const [status, setStatus] = useState('')
  const [priceIcons, setPriceIcons] = useState<Map<string, string>>(() => new Map())

  const priceFor = useCallback((id: string): number | null => priceOverrides[id] ?? null, [priceOverrides])

  const refresh = useCallback(async () => {
    setStatus('Fetching prices…')
    try {
      await ctx.prices.refresh()
      const { prices: list } = await ctx.prices.getPrices()
      const byName = indexPrices(list)
      setPriceIcons(indexPriceIcons(list))
      setCpd(chaosForName(byName, 'Divine Orb') ?? 180)

      const next: Record<string, number | null> = {}
      for (const group of REF.groups) {
        for (const essence of group.essences) {
          for (let tierIdx = 0; tierIdx <= group.maxTier; tierIdx++) {
            const id = essenceId(REF.tiers[tierIdx], essence)
            next[id] = chaosForId(byName, id)
          }
        }
      }
      setPriceOverrides(next)

      setScarabs((s) => ({
        ...s,
        ascentPrice: chaosForId(byName, SCARAB_IDS.ascentQty) ?? s.ascentPrice,
        essencePrice: chaosForId(byName, SCARAB_IDS.essenceQty) ?? s.essencePrice,
        calcificationPrice: chaosForId(byName, SCARAB_IDS.calcificationQty) ?? s.calcificationPrice,
        adversariesPrice: chaosForId(byName, SCARAB_IDS.adversariesQty) ?? s.adversariesPrice,
        stabilityPrice: chaosForId(byName, SCARAB_IDS.stabilityQty) ?? s.stabilityPrice,
      }))
      setVaalOrbPrice((v) => chaosForId(byName, 'vaal-orb') ?? v)

      setStatus(`poe.ninja · ${ctx.getLeague()} (bundled weights)`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    }
  }, [ctx])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const result = useMemo(
    () =>
      computeEssenceFarm({
        groups: REF.groups,
        tiers: REF.tiers,
        weights: REF.weights,
        priceFor,
        valuation,
        rareMonstersPerMap,
        crystalLattice,
        amplifiedEnergies,
        prolificEssence,
        crystalResonance,
        ascentQty: scarabs.ascentQty,
        ascentPrice: scarabs.ascentPrice,
        essenceQty: scarabs.essenceQty,
        essencePrice: scarabs.essencePrice,
        calcificationQty: scarabs.calcificationQty,
        calcificationPrice: scarabs.calcificationPrice,
        adversariesQty: scarabs.adversariesQty,
        adversariesPrice: scarabs.adversariesPrice,
        stabilityQty: scarabs.stabilityQty,
        stabilityPrice: scarabs.stabilityPrice,
        vaalMode,
        vaalOrbPrice,
        timePerMapSec: timeSec,
      }),
    [
      priceFor,
      valuation,
      rareMonstersPerMap,
      crystalLattice,
      amplifiedEnergies,
      prolificEssence,
      crystalResonance,
      scarabs,
      vaalMode,
      vaalOrbPrice,
      timeSec,
    ],
  )

  const setScarabQty = (key: keyof typeof SCARAB_IDS, value: number) =>
    setScarabs((s) => ({ ...s, [key]: value }))
  const setScarabPrice = (
    key: 'ascentPrice' | 'essencePrice' | 'calcificationPrice' | 'adversariesPrice' | 'stabilityPrice',
    value: number,
  ) => setScarabs((s) => ({ ...s, [key]: value }))

  return (
    <Workbench>
      <ToolHeader
        toolId="essences"
        title="Essences"
        onBack={onBack}
        status={status}
        onRefresh={() => void refresh()}
      />

      <SplitBody
        railWidth={268}
        rail={
          <>
            <SetupGroup title="Scarabs">
              <ScarabField
                name="Ascent"
                itemName={idToName(SCARAB_IDS.ascentQty)}
                priceIcons={priceIcons}
                qty={scarabs.ascentQty}
                maxQty={1}
                price={scarabs.ascentPrice}
                onQty={(v) => setScarabQty('ascentQty', v)}
                onPrice={(v) => setScarabPrice('ascentPrice', v)}
              />
              <ScarabField
                name="Essence"
                itemName={idToName(SCARAB_IDS.essenceQty)}
                priceIcons={priceIcons}
                qty={scarabs.essenceQty}
                maxQty={5}
                price={scarabs.essencePrice}
                onQty={(v) => setScarabQty('essenceQty', v)}
                onPrice={(v) => setScarabPrice('essencePrice', v)}
              />
              <ScarabField
                name="Calcification"
                itemName={idToName(SCARAB_IDS.calcificationQty)}
                priceIcons={priceIcons}
                qty={scarabs.calcificationQty}
                maxQty={1}
                price={scarabs.calcificationPrice}
                onQty={(v) => setScarabQty('calcificationQty', v)}
                onPrice={(v) => setScarabPrice('calcificationPrice', v)}
              />
              <ScarabField
                name="Adversaries"
                itemName={idToName(SCARAB_IDS.adversariesQty)}
                priceIcons={priceIcons}
                qty={scarabs.adversariesQty}
                maxQty={2}
                price={scarabs.adversariesPrice}
                onQty={(v) => setScarabQty('adversariesQty', v)}
                onPrice={(v) => setScarabPrice('adversariesPrice', v)}
              />
              <ScarabField
                name="Stability"
                itemName={idToName(SCARAB_IDS.stabilityQty)}
                priceIcons={priceIcons}
                qty={scarabs.stabilityQty}
                maxQty={1}
                price={scarabs.stabilityPrice}
                onQty={(v) => setScarabQty('stabilityQty', v)}
                onPrice={(v) => setScarabPrice('stabilityPrice', v)}
              />
            </SetupGroup>
            <SetupGroup title="Run settings" defaultOpen={false}>
              <FieldLabel label="Rares / map">
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="number"
                  min={1}
                  value={rareMonstersPerMap}
                  onChange={(e) => setRareMonstersPerMap(Number(e.target.value) || 1)}
                />
              </FieldLabel>
              <FieldLabel label="Sec / map">
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="number"
                  value={timeSec}
                  onChange={(e) => setTimeSec(Number(e.target.value) || 240)}
                />
              </FieldLabel>
              <FieldLabel label="Valuation">
                <select
                  style={{ ...inputStyle, width: '100%' }}
                  value={valuation}
                  onChange={(e) => setValuation(e.target.value as EssenceValuationMode)}
                >
                  <option value="all">All tiers</option>
                  <option value="shrieking">Shrieking+</option>
                  <option value="deafening">Deafening</option>
                </select>
              </FieldLabel>
              <FieldLabel label="Vaal">
                <select
                  style={{ ...inputStyle, width: '100%' }}
                  value={vaalMode}
                  onChange={(e) => setVaalMode(e.target.value as EssenceVaalMode)}
                >
                  <option value="none">Don't vaal</option>
                  <option value="all">Vaal all</option>
                  <option value="meds">MEDS only</option>
                </select>
              </FieldLabel>
              <FieldLabel
                label={
                  <ItemName name="Vaal Orb" size={14} opts={{ priceIcons }}>
                    Vaal orb
                  </ItemName>
                }
              >
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="number"
                  value={vaalOrbPrice}
                  onChange={(e) => setVaalOrbPrice(Number(e.target.value) || 0)}
                />
              </FieldLabel>
            </SetupGroup>
            <SetupGroup title="Atlas keys" defaultOpen={false}>
              {(
                [
                  ['Amplified Energies', amplifiedEnergies, setAmplifiedEnergies],
                  ['Prolific Essence', prolificEssence, setProlificEssence],
                  ['Crystal Lattice', crystalLattice, setCrystalLattice],
                  ['Crystal Resonance', crystalResonance, setCrystalResonance],
                ] as const
              ).map(([label, on, set]) => (
                <label key={label} style={{ display: 'flex', gap: 8, fontSize: 12, color: theme.text }}>
                  <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
                  {label}
                </label>
              ))}
            </SetupGroup>
          </>
        }
        stage={
          <>
            <HeroRow>
              <HeroMetric label="Net / map" value={fmtSignedChaos(result.netProfitPerMap, cpd)} tone="good" />
              <HeroMetric label="Net / hour" value={fmtSignedChaos(result.netProfitPerHour, cpd)} tone="good" />
              <HeroMetric
                label="EV / map"
                value={fmtChaos(result.evPerMap, cpd)}
                tone="ink"
                sub={`cost −${fmtChaos(result.totalCost, cpd)}`}
              />
              <HeroMetric
                label="Essences / map"
                value={result.totalEssences.toFixed(1)}
                tone="accent"
                sub={`${result.essPerMonster.toFixed(2)} / rare · vaal ×${result.vaalMultiplier.toFixed(2)}`}
              />
            </HeroRow>

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: `1px solid ${theme.border}` }}>
              {result.breakdown.map((row) => (
                <ListRow
                  key={row.id}
                  leading={
                    <div>
                      <ItemName name={idToName(row.id)} opts={{ priceIcons }}>
                        <span
                          style={{
                            fontFamily: fonts.display,
                            fontSize: 14,
                            color: theme.ink,
                            textTransform: 'capitalize',
                          }}
                        >
                          {row.essence}
                        </span>
                      </ItemName>
                      <div style={{ fontSize: 10, color: theme.muted, marginTop: 2, textTransform: 'capitalize' }}>
                        {row.tier} · {(row.probability * 100).toFixed(2)}%
                      </div>
                    </div>
                  }
                  trailing={
                    <>
                      <input
                        style={{ ...inputStyle, width: 64 }}
                        placeholder={fmtChaos(row.price, cpd)}
                        value={
                          priceOverrides[row.id] != null
                            ? String(Math.round((priceOverrides[row.id] ?? 0) * 100) / 100)
                            : ''
                        }
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          setPriceOverrides((p) => ({
                            ...p,
                            [row.id]: Number.isFinite(v) && e.target.value !== '' ? v : null,
                          }))
                        }}
                      />
                      <span className="sa-num" style={{ color: theme.green, minWidth: 56, textAlign: 'right' }}>
                        {fmtChaos(row.valuedContribution, cpd)}
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

function ScarabField({
  name,
  itemName,
  priceIcons,
  qty,
  maxQty,
  price,
  onQty,
  onPrice,
}: {
  name: string
  itemName: string
  priceIcons: Map<string, string>
  qty: number
  maxQty: number
  price: number
  onQty: (v: number) => void
  onPrice: (v: number) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px 64px', gap: 6, alignItems: 'center' }}>
      <ItemName name={itemName} size={16} opts={{ priceIcons }}>
        <span style={{ fontSize: 11, color: theme.dim }}>{name}</span>
      </ItemName>
      <select style={{ ...inputStyle, width: 44 }} value={qty} onChange={(e) => onQty(Number(e.target.value) || 0)}>
        {Array.from({ length: maxQty + 1 }, (_, i) => i).map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
      <input
        style={{ ...inputStyle, width: 64 }}
        type="number"
        step="0.1"
        value={price}
        onChange={(e) => onPrice(Number(e.target.value) || 0)}
      />
    </div>
  )
}



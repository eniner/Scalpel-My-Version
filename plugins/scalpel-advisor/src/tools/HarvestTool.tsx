import type { ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  BASE_EXTRA_PLOT_CHANCE,
  solveHarvest,
  type HarvestSolveOptions,
  type HarvestSolveResult,
  type SeedDist,
} from '../engines/harvest'
import {
  DEFAULT_LIFEFORCE_AT_UPGRADES,
  DEFAULT_LIFEFORCE_MAX_AT_UPGRADES,
  solveCropRotation,
  type CropRotationSolveOptions,
  type CropRotationSolveResult,
} from '../engines/cropRotation'
import { indexPriceIcons } from '../shared/icons'
import { ItemName } from '../shared/ItemName'
import { chaosForId, chaosForName, fmtChaos, fmtSignedChaos, idToName, indexPrices } from '../shared/prices'
import { ToolHeader } from '../shared/ToolChrome'
import { accentBtnStyle, inputStyle, theme } from '../shared/theme'
import {
  Blurb,
  FieldLabel,
  HeroMetric,
  HeroRow,
  ListRow,
  SetupGroup,
  SplitBody,
  TabStrip,
  Workbench,
} from '../shared/ui'

// ============ Atlas notable → engine-field mapping (harvest.html's ATLAS_NOTABLES) ============

type AtlasKey = 'bumperCrop' | 'bountiful' | 'doubling' | 'heart'

const ATLAS_NOTABLES: Record<
  AtlasKey,
  {
    label: string
    desc: string
    extraPlot?: number
    bonusLF?: number
    dupMonster?: number
    dupLF?: number
    notWilt?: number
    t4Increase?: number
    t3Increase?: number
  }
> = {
  bumperCrop: { label: 'Bumper Crop', desc: '+50% extra plot, +9% LF qty', extraPlot: 50, bonusLF: 9 },
  bountiful: { label: 'Bountiful', desc: '+16% duplicate monster', dupMonster: 16 },
  doubling: { label: 'Doubling', desc: '+10% duplicate LF, +9% LF qty', dupLF: 10, bonusLF: 9 },
  heart: { label: 'Heart of the Grove', desc: '+10% not-wilt, +60% T4 chance, +30% T3 chance', notWilt: 10, t4Increase: 60, t3Increase: 30 },
}

type AtlasSel = Record<AtlasKey, boolean>

function getEffectiveBonuses(sel: AtlasSel) {
  let extraPlot = 0
  let bonusLF = 0
  let dupMonster = 0
  let dupLF = 0
  let notWilt = 0
  let t4Increase = 0
  let t3Increase = 0
  for (const key of Object.keys(ATLAS_NOTABLES) as AtlasKey[]) {
    if (!sel[key]) continue
    const n = ATLAS_NOTABLES[key]
    extraPlot += n.extraPlot ?? 0
    bonusLF += n.bonusLF ?? 0
    dupMonster += n.dupMonster ?? 0
    dupLF += n.dupLF ?? 0
    notWilt += n.notWilt ?? 0
    t4Increase += n.t4Increase ?? 0
    t3Increase += n.t3Increase ?? 0
  }
  return { extraPlot, bonusLF, dupMonster, dupLF, notWilt, t4Increase, t3Increase }
}

/** Mirrors harvest.html's updatePairDistribution(): turns an "extra plot" chance
 * into a {3,4,5}-pair Grove size distribution. */
function computePairDist(extraPlotPct: number): Record<number, number> {
  const atlasChance = Math.max(0, Math.min(1, extraPlotPct / 100))
  const p3 = (1 - BASE_EXTRA_PLOT_CHANCE) * (1 - atlasChance)
  const p4 = BASE_EXTRA_PLOT_CHANCE * (1 - atlasChance) + (1 - BASE_EXTRA_PLOT_CHANCE) * atlasChance
  const p5 = BASE_EXTRA_PLOT_CHANCE * atlasChance
  return { 3: p3, 4: p4, 5: p5 }
}

const HARVEST_SCARAB_IDS = {
  doubling: 'harvest-scarab-of-doubling',
  cornucopia: 'harvest-scarab-of-cornucopia',
  awakener: 'horned-scarab-of-awakening',
} as const

const LIFEFORCE_IDS = { y: 'wild-lifeforce', b: 'vivid-lifeforce', r: 'primal-lifeforce' } as const

type Mode = 'farming' | 'crop'

export function HarvestTool({
  ctx,
  onBack,
  initialMode = 'farming',
}: {
  ctx: ScalpelPluginContext
  onBack: () => void
  initialMode?: Mode
}): JSX.Element {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [status, setStatus] = useState('')
  const [cpd, setCpd] = useState(180)
  const [priceIcons, setPriceIcons] = useState<Map<string, string>>(() => new Map())

  const [lfPrice, setLfPrice] = useState<{ y: number; b: number; r: number }>({ y: 0, b: 0, r: 0 })
  const [scarabPrice, setScarabPrice] = useState<{ doubling: number; cornucopia: number; awakener: number }>({
    doubling: 0,
    cornucopia: 0,
    awakener: 0,
  })

  const [useDoubling, setUseDoubling] = useState(false)
  const [useCornucopia, setUseCornucopia] = useState(false)
  const [useAwakener, setUseAwakener] = useState(false)
  const [atlas, setAtlas] = useState<AtlasSel>({ bumperCrop: false, bountiful: false, doubling: false, heart: false })

  const [mapQuantPct, setMapQuantPct] = useState(125)
  const [packSizePct, setPackSizePct] = useState(35)
  const [timeSec, setTimeSec] = useState(240)

  // Harvest-only advanced inputs
  const [t4ChancePct, setT4ChancePct] = useState(1)
  const [t3Slots, setT3Slots] = useState(3)
  const [t3ProbPct, setT3ProbPct] = useState(25)
  const [t2Slots, setT2Slots] = useState(8)
  const [t2ProbPct, setT2ProbPct] = useState(75)
  const [lfPerTier, setLfPerTier] = useState<[number, number, number, number]>([7, 18, 47, 230])

  const [farmingResult, setFarmingResult] = useState<HarvestSolveResult | null>(null)
  const [cropResult, setCropResult] = useState<CropRotationSolveResult | null>(null)
  const [computing, setComputing] = useState(false)

  const refresh = useCallback(async () => {
    setStatus('Fetching prices…')
    try {
      await ctx.prices.refresh()
      const { prices: list } = await ctx.prices.getPrices()
      const byName = indexPrices(list)
      setPriceIcons(indexPriceIcons(list))
      setCpd(chaosForName(byName, 'Divine Orb') ?? 180)
      setLfPrice({
        y: chaosForId(byName, LIFEFORCE_IDS.y) ?? chaosForName(byName, idToName(LIFEFORCE_IDS.y)) ?? 0,
        b: chaosForId(byName, LIFEFORCE_IDS.b) ?? chaosForName(byName, idToName(LIFEFORCE_IDS.b)) ?? 0,
        r: chaosForId(byName, LIFEFORCE_IDS.r) ?? chaosForName(byName, idToName(LIFEFORCE_IDS.r)) ?? 0,
      })
      setScarabPrice({
        doubling: chaosForId(byName, HARVEST_SCARAB_IDS.doubling) ?? 0,
        cornucopia: chaosForId(byName, HARVEST_SCARAB_IDS.cornucopia) ?? 0,
        awakener: chaosForId(byName, HARVEST_SCARAB_IDS.awakener) ?? 0,
      })
      setStatus(`poe.ninja · ${ctx.getLeague()} (bundled harvest math)`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    }
  }, [ctx])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const bonuses = useMemo(() => getEffectiveBonuses(atlas), [atlas])
  const pairDist = useMemo(() => computePairDist(bonuses.extraPlot), [bonuses.extraPlot])

  const scarabCostPerMap =
    (useDoubling ? scarabPrice.doubling : 0) +
    (useCornucopia ? scarabPrice.cornucopia : 0) +
    (useAwakener ? scarabPrice.awakener : 0)

  const seedDist: SeedDist = useMemo(
    () => ({
      t4Chance: clamp01((t4ChancePct + bonuses.t4Increase) / 100),
      t3Slots,
      t3Prob: clamp01((t3ProbPct + bonuses.t3Increase) / 100),
      t2Slots,
      t2Prob: clamp01(t2ProbPct / 100),
    }),
    [t4ChancePct, t3Slots, t3ProbPct, t2Slots, t2ProbPct, bonuses.t4Increase, bonuses.t3Increase],
  )

  const runFarmingOptimize = useCallback(() => {
    setComputing(true)
    try {
      const opts: HarvestSolveOptions = {
        prices: lfPrice,
        pairDist,
        useAwakener,
        useDoubling,
        useCornucopia,
        mapQuant: mapQuantPct / 100,
        packsize: packSizePct / 100,
        bonusLifeforce: bonuses.bonusLF / 100,
        duplicateMonster: bonuses.dupMonster / 100,
        notWilt: bonuses.notWilt / 100,
        duplicateLifeforce: bonuses.dupLF / 100,
        params: { lfPerTier },
        seedDist,
      }
      setFarmingResult(solveHarvest(opts))
    } finally {
      setComputing(false)
    }
  }, [lfPrice, pairDist, useAwakener, useDoubling, useCornucopia, mapQuantPct, packSizePct, bonuses, lfPerTier, seedDist])

  const runCropOptimize = useCallback(() => {
    setComputing(true)
    try {
      const opts: CropRotationSolveOptions = {
        prices: lfPrice,
        pairDist,
        useAwakener,
        useDoubling,
        mapQuant: mapQuantPct / 100,
        packsize: packSizePct / 100,
        bonusLifeforce: bonuses.bonusLF / 100,
        duplicateMonster: bonuses.dupMonster / 100,
        notWilt: bonuses.notWilt / 100,
        duplicateLifeforce: bonuses.dupLF / 100,
        lifeforceAtUpgrades: DEFAULT_LIFEFORCE_AT_UPGRADES,
        lifeforceMaxAtUpgrades: DEFAULT_LIFEFORCE_MAX_AT_UPGRADES,
      }
      setCropResult(solveCropRotation(opts))
    } finally {
      setComputing(false)
    }
  }, [lfPrice, pairDist, useAwakener, useDoubling, mapQuantPct, packSizePct, bonuses])

  const topFarming = useMemo(
    () =>
      (farmingResult?.top ?? []).slice(0, 15).map((row) => ({
        y: row.reductions.yellow,
        b: row.reductions.blue,
        r: row.reductions.red,
        pts: row.pointCostProxy,
        grossEv: row.expectedValue,
        netEv: row.expectedValue - scarabCostPerMap,
        lf: row.expectedLf,
      })),
    [farmingResult, scarabCostPerMap],
  )

  const topCrop = useMemo(
    () =>
      (cropResult?.top ?? []).slice(0, 15).map((row) => ({
        y: row.reductions.yellow,
        b: row.reductions.blue,
        r: row.reductions.red,
        pts: row.pointCostProxy,
        grossEv: row.expectedValue,
        netEv: row.expectedValue - scarabCostPerMap,
        lf: row.expectedLf,
      })),
    [cropResult, scarabCostPerMap],
  )

  const best = mode === 'farming' ? topFarming[0] : topCrop[0]
  const mapsPerHour = timeSec > 0 ? 3600 / timeSec : 0

  const results = mode === 'farming' ? topFarming : topCrop

  return (
    <Workbench>
      <ToolHeader
        toolId="harvest"
        title="Harvest — Farming EV & Crop Rotation"
        onBack={onBack}
        status={status}
        onRefresh={() => void refresh()}
      />

      <TabStrip
        tabs={[
          { id: 'farming', label: 'Farming EV' },
          { id: 'crop', label: 'Crop Rotation' },
        ]}
        value={mode}
        onChange={(id) => setMode(id as Mode)}
      />

      <SplitBody
        railWidth={300}
        rail={
          <>
            <SetupGroup title="Lifeforce prices">
              <PriceInput
                label="Yellow (Wild)"
                itemName={idToName(LIFEFORCE_IDS.y)}
                priceIcons={priceIcons}
                color={theme.accent}
                value={lfPrice.y}
                onChange={(v) => setLfPrice((p) => ({ ...p, y: v }))}
              />
              <PriceInput
                label="Blue (Vivid)"
                itemName={idToName(LIFEFORCE_IDS.b)}
                priceIcons={priceIcons}
                color={theme.blue}
                value={lfPrice.b}
                onChange={(v) => setLfPrice((p) => ({ ...p, b: v }))}
              />
              <PriceInput
                label="Red (Primal)"
                itemName={idToName(LIFEFORCE_IDS.r)}
                priceIcons={priceIcons}
                color={theme.red}
                value={lfPrice.r}
                onChange={(v) => setLfPrice((p) => ({ ...p, r: v }))}
              />
            </SetupGroup>

            <SetupGroup title="Scarabs">
              <ScarabToggle
                label="Doubling"
                itemName={idToName(HARVEST_SCARAB_IDS.doubling)}
                priceIcons={priceIcons}
                checked={useDoubling}
                onToggle={() => setUseDoubling((v) => !v)}
                cost={scarabPrice.doubling}
                onCostChange={(v) => setScarabPrice((p) => ({ ...p, doubling: v }))}
                cpd={cpd}
              />
              {mode === 'farming' ? (
                <ScarabToggle
                  label="Cornucopia"
                  itemName={idToName(HARVEST_SCARAB_IDS.cornucopia)}
                  priceIcons={priceIcons}
                  checked={useCornucopia}
                  onToggle={() => setUseCornucopia((v) => !v)}
                  cost={scarabPrice.cornucopia}
                  onCostChange={(v) => setScarabPrice((p) => ({ ...p, cornucopia: v }))}
                  cpd={cpd}
                />
              ) : null}
              <ScarabToggle
                label="Awakener"
                itemName={idToName(HARVEST_SCARAB_IDS.awakener)}
                priceIcons={priceIcons}
                checked={useAwakener}
                onToggle={() => setUseAwakener((v) => !v)}
                cost={scarabPrice.awakener}
                onCostChange={(v) => setScarabPrice((p) => ({ ...p, awakener: v }))}
                cpd={cpd}
              />
            </SetupGroup>

            <SetupGroup title="Map stats" defaultOpen={false}>
              <FieldLabel label="Map Quantity %">
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="number"
                  value={mapQuantPct}
                  onChange={(e) => setMapQuantPct(Number(e.target.value) || 0)}
                />
              </FieldLabel>
              <FieldLabel label="Pack Size %">
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="number"
                  value={packSizePct}
                  onChange={(e) => setPackSizePct(Number(e.target.value) || 0)}
                />
              </FieldLabel>
              <FieldLabel label="Time / Map (s)">
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="number"
                  value={timeSec}
                  onChange={(e) => setTimeSec(Number(e.target.value) || 0)}
                />
              </FieldLabel>
              <Blurb>
                Grove sizes: 3-pair {(pairDist[3] * 100).toFixed(0)}% · 4-pair {(pairDist[4] * 100).toFixed(0)}% ·
                5-pair {(pairDist[5] * 100).toFixed(0)}%
              </Blurb>
            </SetupGroup>

            <SetupGroup title="Atlas bonuses" defaultOpen={false}>
              {(Object.keys(ATLAS_NOTABLES) as AtlasKey[]).map((key) => (
                <label key={key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11 }}>
                  <input
                    type="checkbox"
                    checked={atlas[key]}
                    onChange={(e) => setAtlas((a) => ({ ...a, [key]: e.target.checked }))}
                  />
                  <span>
                    <strong style={{ color: theme.text }}>{ATLAS_NOTABLES[key].label}</strong>
                    <br />
                    <span style={{ color: theme.dim }}>{ATLAS_NOTABLES[key].desc}</span>
                  </span>
                </label>
              ))}
            </SetupGroup>

            {mode === 'farming' ? (
              <SetupGroup title="Seed distribution" defaultOpen={false}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <NumField label="T4 Chance %" value={t4ChancePct} onChange={setT4ChancePct} width={72} />
                  <NumField label="T3 Slots" value={t3Slots} onChange={setT3Slots} width={72} />
                  <NumField label="T3 Prob %" value={t3ProbPct} onChange={setT3ProbPct} width={72} />
                  <NumField label="T2 Slots" value={t2Slots} onChange={setT2Slots} width={72} />
                  <NumField label="T2 Prob %" value={t2ProbPct} onChange={setT2ProbPct} width={72} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
                  {(['T1', 'T2', 'T3', 'T4'] as const).map((label, i) => (
                    <NumField
                      key={label}
                      label={`LF / ${label}`}
                      value={lfPerTier[i]}
                      onChange={(v) =>
                        setLfPerTier((prev) => {
                          const next = [...prev] as [number, number, number, number]
                          next[i] = v
                          return next
                        })
                      }
                      width={72}
                    />
                  ))}
                </div>
              </SetupGroup>
            ) : null}

            <button
              type="button"
              style={{ ...accentBtnStyle, width: '100%' }}
              disabled={computing}
              onClick={() => (mode === 'farming' ? runFarmingOptimize() : runCropOptimize())}
            >
              {computing ? 'Optimizing…' : 'Optimize reductions'}
            </button>
          </>
        }
        stage={
          <>
            {best ? (
              <HeroRow>
                <HeroMetric label="Gross / map" value={fmtChaos(best.grossEv, cpd)} />
                <HeroMetric
                  label="Scarab cost"
                  value={fmtSignedChaos(-scarabCostPerMap, cpd)}
                  tone="warn"
                />
                <HeroMetric label="Net / map" value={fmtSignedChaos(best.netEv, cpd)} tone="good" />
                <HeroMetric
                  label="Net / hour"
                  value={fmtSignedChaos(best.netEv * mapsPerHour, cpd)}
                  tone="accent"
                  sub={`Y${best.y} B${best.b} R${best.r} · ${best.pts} pts`}
                />
              </HeroRow>
            ) : (
              <Blurb>Set lifeforce prices and scarabs in the rail, then Optimize to rank reduction configs.</Blurb>
            )}

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: `1px solid ${theme.border}` }}>
              {results.length === 0 ? (
                <div style={{ padding: 16, color: theme.dim, fontSize: 12 }}>No results yet.</div>
              ) : (
                results.map((row, i) => (
                  <ListRow
                    key={i}
                    leading={
                      <div>
                        <div style={{ fontSize: 13, color: theme.ink, fontWeight: i === 0 ? 650 : 500 }}>
                          Y{row.y}% · B{row.b}% · R{row.r}%
                        </div>
                        <div style={{ fontSize: 10, color: theme.muted, marginTop: 2 }}>
                          {row.pts} pts · LF {row.lf[0].toFixed(0)} / {row.lf[1].toFixed(0)} / {row.lf[2].toFixed(0)}
                        </div>
                      </div>
                    }
                    trailing={
                      <>
                        <span className="sa-num" style={{ color: theme.green, minWidth: 64, textAlign: 'right' }}>
                          {fmtSignedChaos(row.netEv, cpd)}
                        </span>
                        <span className="sa-num" style={{ color: theme.accent, minWidth: 72, textAlign: 'right' }}>
                          {fmtSignedChaos(row.netEv * mapsPerHour, cpd)}/hr
                        </span>
                      </>
                    }
                  />
                ))
              )}
            </div>
          </>
        }
      />
    </Workbench>
  )
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

function PriceInput({
  label,
  itemName,
  priceIcons,
  color,
  value,
  onChange,
}: {
  label: string
  itemName: string
  priceIcons: Map<string, string>
  color: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10, color: theme.dim }}>
      <ItemName name={itemName} opts={{ priceIcons }} size={16} style={{ color }}>
        {label}
      </ItemName>
      <input
        style={{ ...inputStyle, width: 90 }}
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </label>
  )
}

function NumField({
  label,
  value,
  onChange,
  width = 72,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  width?: number
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10, color: theme.dim }}>
      {label}
      <input
        style={{ ...inputStyle, width }}
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </label>
  )
}

function ScarabToggle({
  label,
  itemName,
  priceIcons,
  checked,
  onToggle,
  cost,
  onCostChange,
  cpd,
}: {
  label: string
  itemName: string
  priceIcons: Map<string, string>
  checked: boolean
  onToggle: () => void
  cost: number
  onCostChange: (v: number) => void
  cpd: number
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
        <input type="checkbox" checked={checked} onChange={onToggle} />
        <ItemName name={itemName} size={16} opts={{ priceIcons }}>
          {label}
        </ItemName>
      </label>
      <input
        style={{ ...inputStyle, width: 70 }}
        type="number"
        step="0.1"
        value={cost}
        onChange={(e) => onCostChange(Number(e.target.value) || 0)}
      />
      <span style={{ color: theme.dim, fontSize: 10 }}>{fmtChaos(cost, cpd)}</span>
    </div>
  )
}



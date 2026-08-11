import type { ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { useCallback, useEffect, useMemo, useState } from 'react'
import gemLevelingRefJson from '../data/gem-leveling-ref.json'
import gemTradeMappingJson from '../data/gem-trade-mapping.json'
import { computeRows, type GemLevelingData, type GemType } from '../engines/gemLeveling'
import { floorToChaos } from '../shared/floors'
import { applyNinjaToGemLeveling } from '../shared/ninjaOverlay'
import { chaosForName, fmtChaos, fmtSignedChaos, indexPrices } from '../shared/prices'
import { indexPriceIcons } from '../shared/icons'
import { ItemName } from '../shared/ItemName'
import { ToolHeader } from '../shared/ToolChrome'
import { accentBtnStyle, btnStyle, inputStyle, theme } from '../shared/theme'
import {
  Blurb,
  FieldLabel,
  HeroMetric,
  HeroRow,
  ListRow,
  SetupGroup,
  SplitBody,
  Workbench,
} from '../shared/ui'
import { gemTradeUrl, type GemTradeMapping } from '../shared/tradeUrl'

const REF = gemLevelingRefJson as unknown as GemLevelingData
const TRADE_MAPPING = gemTradeMappingJson as unknown as GemTradeMapping

type TypeFilter = 'all' | GemType

const TYPE_COLOR: Record<GemType, string> = {
  skill: theme.blue,
  support: theme.purple,
  exceptional: theme.accent,
}

type SortKey = 'name' | 'buy' | 'low0q' | 'high20q' | 'profit'
type SortDir = 1 | -1

export function GemLevelingTool({
  ctx,
  onBack,
}: {
  ctx: ScalpelPluginContext
  onBack: () => void
}): JSX.Element {
  const [data, setData] = useState<GemLevelingData>(REF)
  const [cpd, setCpd] = useState(180)
  const [status, setStatus] = useState('')
  const [priceIcons, setPriceIcons] = useState<Map<string, string>>(() => new Map())

  const [gcpPrice, setGcpPrice] = useState(() => floorToChaos(REF.gcpFloors, 180) ?? 3)
  const [gcpsNeeded, setGcpsNeeded] = useState(20)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [vendorOnly, setVendorOnly] = useState(false)
  const [minListings, setMinListings] = useState(3)
  const [minVolume, setMinVolume] = useState(10)
  const [belowThresholdLast, setBelowThresholdLast] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'profit', dir: -1 })

  const league = ctx.getLeague()

  const refresh = useCallback(async () => {
    setStatus('Fetching prices…')
    try {
      await ctx.prices.refresh()
      const { prices: list } = await ctx.prices.getPrices()
      const byName = indexPrices(list)
      setPriceIcons(indexPriceIcons(list))
      const nextCpd = chaosForName(byName, 'Divine Orb') ?? 180
      setCpd(nextCpd)
      const live = applyNinjaToGemLeveling(REF, list)
      setData(live)
      setGcpPrice((prev) => floorToChaos(live.gcpFloors, nextCpd) ?? prev)
      const gcpLive = chaosForName(byName, "Gemcutter's Prism")
      if (gcpLive != null) setGcpPrice(gcpLive)
      setStatus(`poe.ninja · ${league} · ${REF.gems.length} gems (bundled XP/weights)`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    }
  }, [ctx, league])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const rows = useMemo(
    () => computeRows(data, { gcpPrice, gcpsNeeded, cpd, minListings, minVolume }),
    [data, gcpPrice, gcpsNeeded, cpd, minListings, minVolume],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = rows
    if (typeFilter !== 'all') list = list.filter((r) => r.gem.type === typeFilter)
    if (vendorOnly) list = list.filter((r) => !r.gem.hasBuyCost)
    if (q) list = list.filter((r) => r.gem.name.toLowerCase().includes(q))

    const dir = sort.dir
    const sorted = [...list].sort((a, b) => {
      let diff = 0
      switch (sort.key) {
        case 'name':
          diff = a.gem.name.localeCompare(b.gem.name)
          break
        case 'buy':
          diff = (a.buy ?? -1) - (b.buy ?? -1)
          break
        case 'low0q':
          diff = (a.low0q ?? -1) - (b.low0q ?? -1)
          break
        case 'high20q':
          diff = (a.high20q ?? -1) - (b.high20q ?? -1)
          break
        case 'profit':
        default:
          diff = (a.bestNormProfit ?? Number.NEGATIVE_INFINITY) - (b.bestNormProfit ?? Number.NEGATIVE_INFINITY)
          break
      }
      return diff * dir
    })
    if (belowThresholdLast) {
      sorted.sort((a, b) => (a.belowThreshold === b.belowThreshold ? 0 : a.belowThreshold ? 1 : -1))
    }
    return sorted
  }, [rows, typeFilter, vendorOnly, search, sort, belowThresholdLast])

  const toggleSort = (key: SortKey) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 1 ? -1 : 1 } : { key, dir: -1 }))
  }

  return (
    <Workbench>
      <ToolHeader
        toolId="gem-leveling"
        title="Gem Leveling Advisor"
        onBack={onBack}
        status={status}
        onRefresh={() => void refresh()}
        refreshLabel="Refresh"
      />

      <SplitBody
        railWidth={260}
        rail={
          <>
            <SetupGroup title="GCP cost">
              <FieldLabel
                label={
                  <ItemName name="Gemcutter's Prism" size={14} opts={{ priceIcons }}>
                    GCP Price
                  </ItemName>
                }
              >
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="number"
                  step="0.1"
                  value={gcpPrice}
                  onChange={(e) => setGcpPrice(Number(e.target.value) || 0)}
                />
              </FieldLabel>
              <FieldLabel label="GCPs Needed">
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="number"
                  value={gcpsNeeded}
                  onChange={(e) => setGcpsNeeded(Number(e.target.value) || 0)}
                />
              </FieldLabel>
            </SetupGroup>

            <SetupGroup title="Filters">
              <FieldLabel label="Type">
                <select
                  style={{ ...inputStyle, width: '100%' }}
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                >
                  <option value="all">All</option>
                  <option value="skill">Skill</option>
                  <option value="support">Support</option>
                  <option value="exceptional">Exceptional</option>
                </select>
              </FieldLabel>
              <FieldLabel label="Min Listings">
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="number"
                  value={minListings}
                  onChange={(e) => setMinListings(Number(e.target.value) || 0)}
                />
              </FieldLabel>
              <FieldLabel label="Min Volume">
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="number"
                  value={minVolume}
                  onChange={(e) => setMinVolume(Number(e.target.value) || 0)}
                />
              </FieldLabel>
              <FieldLabel label="Search">
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="text"
                  placeholder="Gem name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </FieldLabel>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <input type="checkbox" checked={vendorOnly} onChange={(e) => setVendorOnly(e.target.checked)} />
                Vendor only
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <input
                  type="checkbox"
                  checked={belowThresholdLast}
                  onChange={(e) => setBelowThresholdLast(e.target.checked)}
                />
                Below-threshold last
              </label>
            </SetupGroup>

            <SetupGroup title="Sort" defaultOpen={false}>
              {(
                [
                  ['profit', 'Norm profit'],
                  ['name', 'Name'],
                  ['buy', 'Buy'],
                  ['low0q', '0Q low'],
                  ['high20q', '20Q low'],
                ] as [SortKey, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  style={sort.key === key ? accentBtnStyle : btnStyle}
                  onClick={() => toggleSort(key)}
                >
                  {label}
                  {sort.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
                </button>
              ))}
            </SetupGroup>

            <Blurb>
              Buy → level to 20 (optionally 20% quality) → resell. Profit is normalized per gem XP so exceptional
              gems compare fairly.
            </Blurb>
          </>
        }
        stage={
          <>
            <HeroRow>
              <HeroMetric label="Showing" value={`${filtered.length}`} sub={`of ${rows.length} gems`} />
              <HeroMetric
                label="Top pick"
                value={
                  filtered[0]?.bestNormProfit != null
                    ? fmtSignedChaos(filtered[0].bestNormProfit, cpd)
                    : '—'
                }
                tone="good"
                sub={filtered[0]?.gem.name}
              />
            </HeroRow>

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: `1px solid ${theme.border}` }}>
              {filtered.map((r) => (
                <ListRow
                  key={r.gem.name}
                  muted={r.belowThreshold}
                  leading={
                    <div>
                      <ItemName
                        name={r.gem.name}
                        size={22}
                        opts={{
                          baseType: TRADE_MAPPING.trade[r.gem.name]?.type,
                          priceIcons,
                        }}
                      >
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            ctx.openExternal(gemTradeUrl(r.gem.name, TRADE_MAPPING, league))
                          }}
                          style={{ color: theme.ink, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}
                          title="Open trade search"
                        >
                          {r.gem.name}
                        </a>
                      </ItemName>
                      <div style={{ fontSize: 10, color: theme.muted, marginTop: 2 }}>
                        <span style={{ color: TYPE_COLOR[r.gem.type] }}>{r.gem.type}</span>
                        {' · '}
                        buy {r.gem.hasBuyCost ? fmtChaos(r.buy, cpd) : 'free'}
                        {' · '}
                        0Q {fmtChaos(r.low0q, cpd)} ({r.lowListings}/{r.lowVolume})
                        {' · '}
                        20Q {fmtChaos(r.high20q, cpd)} ({r.highListings}/{r.highVolume})
                      </div>
                    </div>
                  }
                  trailing={
                    <>
                      <span
                        className="sa-num"
                        style={{
                          color:
                            r.bestNormProfit != null && r.bestNormProfit > 0 ? theme.green : theme.red,
                          minWidth: 64,
                          textAlign: 'right',
                        }}
                      >
                        {fmtSignedChaos(r.bestNormProfit, cpd)}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 650,
                          letterSpacing: '0.04em',
                          color:
                            r.recommend === '20q'
                              ? theme.green
                              : r.recommend === '0q'
                                ? theme.accent
                                : theme.dim,
                          minWidth: 36,
                          textAlign: 'right',
                        }}
                      >
                        {r.recommend.toUpperCase()}
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

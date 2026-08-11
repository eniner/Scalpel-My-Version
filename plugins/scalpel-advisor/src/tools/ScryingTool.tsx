import type { ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { useCallback, useEffect, useMemo, useState } from 'react'
import scryingRefJson from '../data/scrying-ref.json'
import { indexPriceIcons } from '../shared/icons'
import { ItemName } from '../shared/ItemName'
import { floorToChaos, type Floor } from '../shared/floors'
import { divineRate, fmtChaos, indexPrices, mirrorRateDiv } from '../shared/prices'
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
import { buildNameTradeUrl, buildTypeTradeUrl } from '../shared/tradeUrl'

type ScryingArea = {
  mapArea: string
  floors: Floor
  listings: number
  volume24h: number
  tradeTypeId: string | null
  recentSales?: unknown
}

type ScryingData = {
  league: string
  generatedAt: string
  tradeDiscriminator: string
  totalListings: number
  areas: ScryingArea[]
}

const REF = scryingRefJson as unknown as ScryingData

type SortKey = 'mapArea' | 'price' | 'listings' | 'volume24h'
type SortDir = 1 | -1

const DEFAULT_DIR: Record<SortKey, SortDir> = { mapArea: 1, price: 1, listings: -1, volume24h: -1 }

function scryingTradeUrl(area: ScryingArea, tradeDiscriminator: string, league: string): string {
  if (area.tradeTypeId) {
    return buildTypeTradeUrl(league, { option: area.tradeTypeId, discriminator: tradeDiscriminator })
  }
  return buildNameTradeUrl(league, 'Scrying Orb')
}

export function ScryingTool({
  ctx,
  onBack,
}: {
  ctx: ScalpelPluginContext
  onBack: () => void
}): JSX.Element {
  const [data, setData] = useState<ScryingData>(REF)
  const [cpd, setCpd] = useState(180)
  const [mirrorDiv, setMirrorDiv] = useState(380)
  const [status, setStatus] = useState('')
  const [priceIcons, setPriceIcons] = useState<Map<string, string>>(() => new Map())

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'price', dir: 1 })

  const league = ctx.getLeague()

  const refresh = useCallback(async () => {
    setStatus('Fetching prices…')
    try {
      await ctx.prices.refresh()
      const { prices: list } = await ctx.prices.getPrices()
      const byName = indexPrices(list)
      setPriceIcons(indexPriceIcons(list))
      setCpd(divineRate(byName))
      setMirrorDiv(mirrorRateDiv(byName))
      setData(REF)
      setStatus(`bundled map floors · ${league} · ${REF.areas.length} areas (not on poe.ninja)`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    }
  }, [ctx, league])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const rows = useMemo(
    () =>
      data.areas.map((area) => ({
        area,
        price: floorToChaos(area.floors, cpd, mirrorDiv),
      })),
    [data, cpd, mirrorDiv],
  )

  const summary = useMemo(() => {
    let listings = 0
    let sold24h = 0
    let cheapest: (typeof rows)[number] | null = null
    let priciest: (typeof rows)[number] | null = null
    for (const r of rows) {
      listings += r.area.listings
      sold24h += r.area.volume24h
      if (r.price != null) {
        if (!cheapest || r.price < (cheapest.price ?? Infinity)) cheapest = r
        if (!priciest || r.price > (priciest.price ?? -Infinity)) priciest = r
      }
    }
    return { listings, sold24h, cheapest, priciest, areas: rows.length }
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = q ? rows.filter((r) => r.area.mapArea.toLowerCase().includes(q)) : rows

    const dir = sort.dir
    list = [...list].sort((a, b) => {
      let diff = 0
      switch (sort.key) {
        case 'mapArea':
          diff = a.area.mapArea.localeCompare(b.area.mapArea)
          break
        case 'listings':
          diff = a.area.listings - b.area.listings
          break
        case 'volume24h':
          diff = a.area.volume24h - b.area.volume24h
          break
        case 'price':
        default:
          diff = (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY)
          break
      }
      return diff * dir
    })
    // Unpriced rows always sink to the bottom regardless of sort direction.
    list.sort((a, b) => (a.price == null ? 1 : 0) - (b.price == null ? 1 : 0))
    return list
  }, [rows, search, sort])

  const toggleSort = (key: SortKey) => {
    setSort((prev) => (prev.key === key ? { key, dir: (prev.dir * -1) as SortDir } : { key, dir: DEFAULT_DIR[key] }))
  }

  return (
    <Workbench>
      <ToolHeader
        toolId="scrying"
        title="Scrying Orb Market"
        onBack={onBack}
        status={status}
        onRefresh={() => void refresh()}
        refreshLabel="Refresh"
      />
      <Blurb>
        <ItemName name="Scrying Orb" opts={{ priceIcons }} size={18}>
          Scrying Orb
        </ItemName>{' '}
        prices by map area — cheapest orbs reveal item mods for the least chaos.
      </Blurb>

      <SplitBody
        railWidth={248}
        rail={
          <>
            <SetupGroup title="Search">
              <FieldLabel label="Map area">
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="text"
                  placeholder="e.g. Strand"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </FieldLabel>
              <Blurb>
                {filtered.length} / {rows.length} areas
              </Blurb>
            </SetupGroup>

            <SetupGroup title="Sort" defaultOpen={false}>
              {(
                [
                  ['price', 'Price'],
                  ['mapArea', 'Area'],
                  ['listings', 'Listings'],
                  ['volume24h', 'Sold 24h'],
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
          </>
        }
        stage={
          <>
            <HeroRow>
              <HeroMetric label="Active listings" value={String(summary.listings)} />
              <HeroMetric label="Areas tracked" value={String(summary.areas)} />
              <HeroMetric
                label="Cheapest"
                value={summary.cheapest ? fmtChaos(summary.cheapest.price, cpd) : '—'}
                tone="good"
                sub={summary.cheapest?.area.mapArea}
              />
              <HeroMetric
                label="Priciest"
                value={summary.priciest ? fmtChaos(summary.priciest.price, cpd) : '—'}
                tone="warn"
                sub={summary.priciest?.area.mapArea}
              />
              <HeroMetric label="Sold 24h" value={String(summary.sold24h)} tone="accent" />
            </HeroRow>

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: `1px solid ${theme.border}` }}>
              {filtered.map(({ area, price }) => (
                <ListRow
                  key={area.mapArea}
                  muted={price == null}
                  leading={
                    <ItemName name="Scrying Orb" size={20} opts={{ priceIcons }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: theme.ink }}>{area.mapArea}</div>
                        <div style={{ fontSize: 10, color: theme.muted, marginTop: 2 }}>
                          {area.listings} listings · {area.volume24h} sold 24h
                        </div>
                      </div>
                    </ItemName>
                  }
                  trailing={
                    <>
                      <span
                        className="sa-num"
                        style={{ color: price != null ? theme.green : theme.dim, minWidth: 64, textAlign: 'right' }}
                      >
                        {fmtChaos(price, cpd)}
                      </span>
                      <button
                        type="button"
                        style={{ ...btnStyle, padding: '2px 8px', fontSize: 10 }}
                        onClick={() => ctx.openExternal(scryingTradeUrl(area, data.tradeDiscriminator, league))}
                      >
                        Trade →
                      </button>
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

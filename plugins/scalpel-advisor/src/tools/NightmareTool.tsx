import type { ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import dataJson from '../data/nightmare-bosses.json'
import { avgFragments, computeNightmareBoss, type NightmareBoss } from '../engines/nightmare'
import { indexPriceIcons } from '../shared/icons'
import { ItemName } from '../shared/ItemName'
import { chaosForId, chaosForName, fmtChaos, fmtSignedChaos, idToName, indexPrices } from '../shared/prices'
import { ToolHeader } from '../shared/ToolChrome'
import { inputStyle, theme } from '../shared/theme'
import {
  Blurb,
  FieldLabel,
  HeroMetric,
  HeroRow,
  ListRow,
  SetupGroup,
  SplitBody,
  Workbench,
  td,
  th,
} from '../shared/ui'

const DATA = dataJson as {
  bosses: NightmareBoss[]
  fragmentNames: Record<string, string>
}

export function NightmareTool({
  ctx,
  onBack,
}: {
  ctx: ScalpelPluginContext
  onBack: () => void
}): JSX.Element {
  const [mapCost, setMapCost] = useState(33)
  const [iiq, setIiq] = useState(200)
  const [selectedId, setSelectedId] = useState(DATA.bosses[0]?.id ?? 'ziggurat')
  const [times, setTimes] = useState<Record<string, number>>(() =>
    Object.fromEntries(DATA.bosses.map((b) => [b.id, Math.round(b.defaultTpm * 60)])),
  )
  const [fragPrices, setFragPrices] = useState<Record<string, number>>({})
  const [uniquePrices, setUniquePrices] = useState<Record<string, number>>({})
  const [gemPrices, setGemPrices] = useState<Record<string, number>>({})
  const [rates, setRates] = useState<Record<string, { unique: number; gem: number }>>(() =>
    Object.fromEntries(DATA.bosses.map((b) => [b.id, { unique: b.unique.rate, gem: b.gem.rate }])),
  )
  const [cpd, setCpd] = useState(180)
  const [status, setStatus] = useState('')
  const [priceIcons, setPriceIcons] = useState<Map<string, string>>(() => new Map())

  const refresh = useCallback(async () => {
    setStatus('Fetching prices…')
    try {
      await ctx.prices.refresh()
      const { prices: list } = await ctx.prices.getPrices()
      const byName = indexPrices(list)
      setPriceIcons(indexPriceIcons(list))
      const div = chaosForName(byName, 'Divine Orb') ?? 180
      setCpd(div)

      const frags: Record<string, number> = {}
      for (const [id, name] of Object.entries(DATA.fragmentNames)) {
        frags[id] = chaosForName(byName, name) ?? chaosForId(byName, id) ?? 0
      }
      setFragPrices(frags)

      const uniques: Record<string, number> = {}
      const gems: Record<string, number> = {}
      for (const b of DATA.bosses) {
        const uName = b.unique.name.replace(/^Unid\s+/i, '')
        uniques[b.id] = chaosForName(byName, b.unique.name) ?? chaosForName(byName, uName) ?? 0
        gems[b.id] = chaosForName(byName, b.gem.name) ?? 0
      }
      setUniquePrices(uniques)
      setGemPrices(gems)

      // Prefer a cheap T16 map as default cost if available
      const mapHit =
        chaosForName(byName, 'Cemetery Map') ??
        chaosForName(byName, 'Strand Map') ??
        chaosForName(byName, 'Jungle Valley Map')
      if (mapHit != null) setMapCost(Math.round(mapHit * 10) / 10)

      setStatus(`Prices · ${ctx.getLeague()}`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    }
  }, [ctx])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const avgFrags = avgFragments(iiq)

  const ranked = useMemo(() => {
    return DATA.bosses
      .map((boss) =>
        computeNightmareBoss({
          boss,
          fragmentNames: DATA.fragmentNames,
          fragmentPrices: fragPrices,
          uniquePrice: uniquePrices[boss.id] ?? 0,
          gemPrice: gemPrices[boss.id] ?? 0,
          uniqueRate: rates[boss.id]?.unique ?? boss.unique.rate,
          gemRate: rates[boss.id]?.gem ?? boss.gem.rate,
          mapCost,
          iiq,
          timeSec: times[boss.id] ?? 180,
        }),
      )
      .sort((a, b) => b.profitPerHour - a.profitPerHour)
  }, [fragPrices, uniquePrices, gemPrices, rates, mapCost, iiq, times])

  const selected = ranked.find((r) => r.boss.id === selectedId) ?? ranked[0]
  const boss = selected?.boss

  return (
    <Workbench>
      <ToolHeader
        toolId="nightmare"
        title="Nightmare Boss Rush"
        onBack={onBack}
        status={status}
        onRefresh={() => void refresh()}
      />
      <Blurb>EV calculator for Nightmare map boss farming — compare profit/hour across all 5 bosses.</Blurb>

      <SplitBody
        railWidth={260}
        rail={
          <>
            <SetupGroup title="Map setup">
              <FieldLabel label="Map cost">
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="number"
                  value={mapCost}
                  onChange={(e) => setMapCost(Number(e.target.value) || 0)}
                />
              </FieldLabel>
              <FieldLabel label="In-map IIQ %">
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="number"
                  value={iiq}
                  onChange={(e) => setIiq(Number(e.target.value) || 0)}
                />
              </FieldLabel>
              <Blurb>Avg frags per map: {avgFrags.toFixed(2)}</Blurb>
            </SetupGroup>

            <SetupGroup title="Bosses">
              {ranked.map((r, i) => (
                <ListRow
                  key={r.boss.id}
                  leading={
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.boss.id)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: 2,
                        padding: 0,
                        cursor: 'pointer',
                        color: r.boss.id === selectedId ? theme.accent : theme.text,
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 12 }}>
                        <ItemName name={r.boss.name} size={18} opts={{ priceIcons }}>
                          {i + 1}. {r.boss.name}
                        </ItemName>
                      </div>
                      <div style={{ fontSize: 10, color: theme.dim, marginTop: 2 }}>
                        EV {fmtChaos(r.totalEv, cpd)} · {fmtDivHr(r.profitPerHour, cpd)}
                      </div>
                    </button>
                  }
                  trailing={
                    <span
                      className="sa-num"
                      style={{
                        fontSize: 10,
                        color: r.profitPerMap >= 0 ? theme.green : theme.red,
                      }}
                    >
                      {fmtSignedChaos(r.profitPerMap, cpd)}/map
                    </span>
                  }
                  muted={r.boss.id !== selectedId}
                />
              ))}
            </SetupGroup>
          </>
        }
        stage={
          boss && selected ? (
            <>
              <HeroRow>
                <HeroMetric label="Total EV" value={fmtChaos(selected.totalEv, cpd)} tone="accent" />
                <HeroMetric
                  label="Profit / map"
                  value={fmtSignedChaos(selected.profitPerMap, cpd)}
                  tone={selected.profitPerMap >= 0 ? 'good' : 'warn'}
                  sub={`Map cost ${fmtChaos(mapCost, cpd)}`}
                />
                <HeroMetric
                  label="Profit / hour"
                  value={fmtDivHr(selected.profitPerHour, cpd)}
                  tone="good"
                  sub={`${selected.timeSec}s per map`}
                />
              </HeroRow>

              <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <strong style={{ fontSize: 15 }}>
                    <ItemName name={boss.name} opts={{ priceIcons }}>
                      {boss.name}
                    </ItemName>
                  </strong>
                  <FieldLabel label="Time / map (sec)">
                    <input
                      style={{ ...inputStyle, width: 88 }}
                      type="number"
                      value={times[boss.id] ?? 180}
                      onChange={(e) =>
                        setTimes((t) => ({ ...t, [boss.id]: Number(e.target.value) || 180 }))
                      }
                    />
                  </FieldLabel>
                </div>

                <SetupGroup title={`Fragments — ${fmtChaos(selected.fragEv, cpd)} EV`}>
                  <Blurb>
                    {selected.avgFrags.toFixed(2)} avg drops ({iiq}% IIQ)
                  </Blurb>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={th}>Fragment</th>
                        <th style={th}>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {boss.fragments.map((id) => (
                        <tr key={id}>
                          <td style={td}>
                            <ItemName
                              name={DATA.fragmentNames[id] ?? idToName(id)}
                              opts={{ priceIcons, aliases: [idToName(id), id] }}
                            >
                              {DATA.fragmentNames[id] ?? id}
                            </ItemName>
                          </td>
                          <td style={td}>
                            <input
                              style={{ ...inputStyle, width: 80 }}
                              type="number"
                              value={fragPrices[id] ?? 0}
                              onChange={(e) =>
                                setFragPrices((p) => ({ ...p, [id]: Number(e.target.value) || 0 }))
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </SetupGroup>

                <SetupGroup title={`Rare drops — ${fmtChaos(selected.rareEv, cpd)} EV`}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={th}>Item</th>
                        <th style={th}>Rate %</th>
                        <th style={th}>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={td}>
                          <ItemName
                            name={boss.unique.name}
                            opts={{
                              priceIcons,
                              aliases: [boss.unique.name.replace(/^Unid\s+/i, '')],
                            }}
                          >
                            {boss.unique.name}
                          </ItemName>
                        </td>
                        <td style={td}>
                          <input
                            style={{ ...inputStyle, width: 56 }}
                            type="number"
                            value={rates[boss.id]?.unique ?? boss.unique.rate}
                            onChange={(e) =>
                              setRates((r) => ({
                                ...r,
                                [boss.id]: {
                                  ...r[boss.id],
                                  unique: Number(e.target.value) || 0,
                                  gem: r[boss.id]?.gem ?? boss.gem.rate,
                                },
                              }))
                            }
                          />
                        </td>
                        <td style={td}>
                          <input
                            style={{ ...inputStyle, width: 80 }}
                            type="number"
                            value={uniquePrices[boss.id] ?? 0}
                            onChange={(e) =>
                              setUniquePrices((p) => ({ ...p, [boss.id]: Number(e.target.value) || 0 }))
                            }
                          />
                        </td>
                      </tr>
                      <tr>
                        <td style={td}>
                          <ItemName name={boss.gem.name} opts={{ priceIcons }}>
                            {boss.gem.name}
                          </ItemName>
                        </td>
                        <td style={td}>
                          <input
                            style={{ ...inputStyle, width: 56 }}
                            type="number"
                            value={rates[boss.id]?.gem ?? boss.gem.rate}
                            onChange={(e) =>
                              setRates((r) => ({
                                ...r,
                                [boss.id]: {
                                  unique: r[boss.id]?.unique ?? boss.unique.rate,
                                  gem: Number(e.target.value) || 0,
                                },
                              }))
                            }
                          />
                        </td>
                        <td style={td}>
                          <input
                            style={{ ...inputStyle, width: 80 }}
                            type="number"
                            value={gemPrices[boss.id] ?? 0}
                            onChange={(e) =>
                              setGemPrices((p) => ({ ...p, [boss.id]: Number(e.target.value) || 0 }))
                            }
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </SetupGroup>
              </div>
            </>
          ) : (
            <Blurb>Select a boss to view breakdown.</Blurb>
          )
        }
      />
    </Workbench>
  )
}

function fmtDivHr(chaosPerHour: number, cpd: number): string {
  const d = cpd > 0 ? chaosPerHour / cpd : 0
  const sign = d > 0 ? '+' : d < 0 ? '-' : ''
  return `${sign}${Math.abs(d).toFixed(1)}d/hr`
}

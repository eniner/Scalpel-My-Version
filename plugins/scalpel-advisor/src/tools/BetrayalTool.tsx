import type { ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { useCallback, useEffect, useMemo, useState } from 'react'
import rowsJson from '../data/betrayal-rows.json'
import {
  BETRAYAL_SCARAB_IDS,
  computeBetrayal,
  type BetrayalMaps,
  type BetrayalRow,
  type BetrayalScarabSel,
  type Safehouse,
} from '../engines/betrayal'
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
  fonts,
} from '../shared/ui'

const ROWS = rowsJson as BetrayalRow[]

const DEFAULT_MAPS: BetrayalMaps = {
  transportation: 12,
  fortification: 15,
  research: 3.5,
  intervention: 4,
}

const SAFEHOUSE_LABEL: Record<Safehouse, string> = {
  transportation: 'Trans',
  fortification: 'Fort',
  research: 'Res',
  intervention: 'Int',
}

export function BetrayalTool({
  ctx,
  onBack,
}: {
  ctx: ScalpelPluginContext
  onBack: () => void
}): JSX.Element {
  const [maps, setMaps] = useState<BetrayalMaps>(DEFAULT_MAPS)
  const [timeSec, setTimeSec] = useState(240)
  const [scarabs, setScarabs] = useState<BetrayalScarabSel>({
    betrayal: true,
    reinforcements: false,
    perpetuation: false,
  })
  const [prices, setPrices] = useState<Record<string, number | null>>({})
  const [scarabPrices, setScarabPrices] = useState<Record<keyof BetrayalScarabSel, number | null>>({
    betrayal: null,
    reinforcements: null,
    perpetuation: null,
  })
  const [drops, setDrops] = useState<Record<string, number>>(() =>
    Object.fromEntries(ROWS.map((r) => [r.id, r.defaultDrop])),
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
      setCpd(chaosForName(byName, 'Divine Orb') ?? 180)
      const next: Record<string, number | null> = {}
      for (const row of ROWS) {
        if (row.kind === 'unique' && row.uniqueName) {
          next[row.id] = chaosForName(byName, row.uniqueName)
        } else if (row.currencyId) {
          next[row.id] = chaosForId(byName, row.currencyId) ?? chaosForName(byName, row.name)
        } else {
          next[row.id] = chaosForName(byName, row.name)
        }
      }
      setPrices(next)
      setScarabPrices({
        betrayal: chaosForId(byName, BETRAYAL_SCARAB_IDS.betrayal),
        reinforcements: chaosForId(byName, BETRAYAL_SCARAB_IDS.reinforcements),
        perpetuation: chaosForId(byName, BETRAYAL_SCARAB_IDS.perpetuation),
      })
      setStatus(`Prices · ${ctx.getLeague()}`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    }
  }, [ctx])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const result = useMemo(
    () => computeBetrayal(ROWS, prices, drops, maps, scarabs, scarabPrices, timeSec),
    [prices, drops, maps, scarabs, scarabPrices, timeSec],
  )

  const setMap = (key: Safehouse, v: number) => {
    setMaps((prev) => ({ ...prev, [key]: v }))
  }

  return (
    <Workbench>
      <ToolHeader
        toolId="betrayal"
        title="Betrayal EV"
        onBack={onBack}
        status={status}
        onRefresh={() => void refresh()}
      />

      <SplitBody
        railWidth={260}
        rail={
          <>
            <SetupGroup title="Maps per safehouse">
              {(['transportation', 'fortification', 'research', 'intervention'] as Safehouse[]).map((k) => (
                <FieldLabel key={k} label={`Maps / ${SAFEHOUSE_LABEL[k]}`}>
                  <input
                    style={{ ...inputStyle, width: '100%' }}
                    type="number"
                    step="0.5"
                    value={maps[k]}
                    onChange={(e) => setMap(k, Number(e.target.value) || 1)}
                  />
                </FieldLabel>
              ))}
            </SetupGroup>
            <SetupGroup title="Pacing">
              <FieldLabel label="Sec / Map">
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="number"
                  value={timeSec}
                  onChange={(e) => setTimeSec(Number(e.target.value) || 240)}
                />
              </FieldLabel>
            </SetupGroup>
            <SetupGroup title="Scarabs">
              {(Object.keys(scarabs) as (keyof BetrayalScarabSel)[]).map((key) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: theme.text }}>
                  <input
                    type="checkbox"
                    checked={scarabs[key]}
                    onChange={(e) => setScarabs((s) => ({ ...s, [key]: e.target.checked }))}
                  />
                  <ItemName
                    name={idToName(BETRAYAL_SCARAB_IDS[key])}
                    size={16}
                    opts={{ priceIcons }}
                    style={{ flex: 1 }}
                  >
                    <span style={{ textTransform: 'capitalize' }}>{key}</span>
                  </ItemName>
                  <span className="sa-num" style={{ color: theme.dim, fontSize: 10 }}>
                    {scarabPrices[key] != null ? fmtChaos(scarabPrices[key], cpd) : '—'}
                  </span>
                </label>
              ))}
            </SetupGroup>
            <SetupGroup title="About" defaultOpen={false}>
              <Blurb>
                Expected value per map of running Betrayal safehouses. Defaults assume 3-star leaders.
              </Blurb>
            </SetupGroup>
          </>
        }
        stage={
          <>
            <HeroRow>
              <HeroMetric label="Gross EV / Map" value={fmtChaos(result.grossEvPerMap, cpd)} tone="accent" />
              <HeroMetric
                label="Scarab Cost / Map"
                value={fmtSignedChaos(-result.scarabCostPerMap, cpd)}
                tone="warn"
              />
              <HeroMetric label="Net EV / Map" value={fmtSignedChaos(result.netEvPerMap, cpd)} tone="good" />
              <HeroMetric label="Net EV / Hour" value={fmtSignedChaos(result.netEvPerHour, cpd)} tone="good" />
            </HeroRow>

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: `1px solid ${theme.border}` }}>
              {result.rows.map(({ row, price, dropPct, evPerSafehouse, evPerMap }) => (
                <ListRow
                  key={row.id}
                  leading={
                    <div>
                      <ItemName
                        name={row.name}
                        opts={{
                          priceIcons,
                          aliases: [
                            ...(row.uniqueName ? [row.uniqueName] : []),
                            ...(row.currencyId ? [idToName(row.currencyId)] : []),
                          ],
                        }}
                        style={{ fontFamily: fonts.display, fontSize: 14, color: theme.ink }}
                      >
                        {row.name}
                        {row.safehouse ? (
                          <span style={{ color: theme.dim, fontFamily: fonts.ui, fontSize: 11 }}>
                            {' '}
                            ({row.safehouse})
                          </span>
                        ) : null}
                      </ItemName>
                    </div>
                  }
                  trailing={
                    <>
                      <input
                        style={{ ...inputStyle, width: 72 }}
                        value={price != null ? String(Math.round(price * 100) / 100) : ''}
                        placeholder="—"
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          setPrices((p) => ({ ...p, [row.id]: Number.isFinite(v) ? v : null }))
                        }}
                      />
                      <input
                        style={{ ...inputStyle, width: 52 }}
                        type="number"
                        value={dropPct}
                        title="Drop %"
                        onChange={(e) =>
                          setDrops((d) => ({ ...d, [row.id]: Number(e.target.value) || 0 }))
                        }
                      />
                      <span className="sa-num" style={{ color: theme.purple, minWidth: 52, textAlign: 'right', fontSize: 11 }}>
                        {fmtChaos(evPerSafehouse, cpd)}
                      </span>
                      <span className="sa-num" style={{ color: theme.green, minWidth: 52, textAlign: 'right', fontSize: 11 }}>
                        {fmtChaos(evPerMap, cpd)}
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

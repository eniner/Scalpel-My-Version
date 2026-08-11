import type { ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import catalogJson from './data/catalog.json'
import {
  buildFlipChances,
  computeStrategy,
  tierWeightPercents,
} from './engine'
import {
  chaosForName,
  divineRate,
  fmtChaos,
  fmtInUnit,
  fmtPct,
  indexPrices,
  resolveIcon,
} from './prices'
import type { Catalog, CatalogPool, FlipStrategy, RowState } from './types'

const catalog = catalogJson as Catalog

type PriceUnit = 'chaos' | 'divine'
type LfBuyWith = 'chaos' | 'divine'

function defaultRows(pool: CatalogPool): Record<string, RowState> {
  const rows: Record<string, RowState> = {}
  for (const item of pool.items) {
    rows[item.id] = { id: item.id, qty: 0, buy: 0, sell: 0, enabled: true }
  }
  return rows
}

function cssVar(name: string, fallback: string): string {
  return `var(${name}, ${fallback})`
}

function randInt(min: number, max: number): number {
  const a = Math.min(min, max)
  const b = Math.max(min, max)
  return a + Math.floor(Math.random() * (b - a + 1))
}

export function HarvestPanel({ ctx }: { ctx: ScalpelPluginContext }): JSX.Element {
  const [poolId, setPoolId] = useState(catalog.pools[0]?.id ?? 'essences')
  const pool = catalog.pools.find((p) => p.id === poolId) ?? catalog.pools[0]
  const [rows, setRows] = useState<Record<string, RowState>>(() => defaultRows(pool))
  const [strategy, setStrategy] = useState<FlipStrategy>('one-step')
  const [chaosPerDiv, setChaosPerDiv] = useState(180)
  const [priceUnit, setPriceUnit] = useState<PriceUnit>('chaos')
  const [lfBuyWith, setLfBuyWith] = useState<LfBuyWith>('chaos')
  const [lfPerChaos, setLfPerChaos] = useState(15)
  const [lfPerDivine, setLfPerDivine] = useState(2700)
  const [buyPct, setBuyPct] = useState(100)
  const [sellPct, setSellPct] = useState(100)
  const [qtyMin, setQtyMin] = useState(50)
  const [qtyMax, setQtyMax] = useState(100)
  const [status, setStatus] = useState('')
  const [icons, setIcons] = useState<Record<string, string>>({})

  const flipChances = useMemo(() => buildFlipChances(pool.items), [pool])
  const weightPct = useMemo(() => tierWeightPercents(pool.items), [pool])

  useEffect(() => {
    setRows(defaultRows(pool))
  }, [pool.id])

  // Resolve icons from Scalpel iconMap even before price import
  useEffect(() => {
    const next: Record<string, string> = {}
    for (const item of pool.items) {
      const icon = resolveIcon(item.id)
      if (icon) next[item.id] = icon
    }
    setIcons((prev) => ({ ...prev, ...next }))
  }, [pool])

  const patchRow = useCallback((id: string, patch: Partial<RowState>) => {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }, [])

  const importPrices = useCallback(async () => {
    setStatus('Fetching poe.ninja…')
    try {
      await ctx.prices.refresh()
      const { prices } = await ctx.prices.getPrices()
      const byName = indexPrices(prices)
      const cpd = divineRate(byName)
      setChaosPerDiv(cpd)

      const nextIcons: Record<string, string> = {}
      let hit = 0
      setRows((prev) => {
        const next = { ...prev }
        for (const item of pool.items) {
          const entry = byName.get(item.id) ?? byName.get(item.id.toLowerCase())
          const chaos = entry?.chaosValue
          const icon = resolveIcon(item.id, entry?.icon)
          if (icon) nextIcons[item.id] = icon
          if (chaos != null && Number.isFinite(chaos)) {
            hit++
            const buy = Math.round(chaos * (buyPct / 100) * 100) / 100
            const sell = Math.round(chaos * (sellPct / 100) * 100) / 100
            next[item.id] = { ...next[item.id], buy, sell }
          }
        }
        return next
      })
      setIcons((prev) => ({ ...prev, ...nextIcons }))

      const lfName = catalog.lifeforceNames[pool.lfType]
      const lfChaos = chaosForName(byName, lfName)
      if (lfChaos != null && lfChaos > 0) {
        const perChaos = 1 / lfChaos
        setLfPerChaos(Math.round(perChaos * 100) / 100)
        setLfPerDivine(Math.round(perChaos * cpd * 100) / 100)
      }

      setStatus(`PW import · ${ctx.getLeague()} · ${hit}/${pool.items.length} priced`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    }
  }, [ctx, pool, buyPct, sellPct])

  const chaosPerLf = useMemo(() => {
    if (lfBuyWith === 'chaos') return 1 / Math.max(lfPerChaos, 1e-9)
    return chaosPerDiv / Math.max(lfPerDivine, 1e-9)
  }, [lfBuyWith, lfPerChaos, lfPerDivine, chaosPerDiv])

  const rerollCostChaos = useMemo(() => pool.lfCost * chaosPerLf, [pool.lfCost, chaosPerLf])

  const result = useMemo(() => {
    const counts: Record<string, number> = {}
    const buy: Record<string, number> = {}
    const sell: Record<string, number> = {}
    for (const item of pool.items) {
      const row = rows[item.id]
      counts[item.id] = row?.enabled ? row.qty : 0
      buy[item.id] = row?.buy ?? 0
      sell[item.id] = row?.sell ?? 0
    }
    return computeStrategy({
      items: pool.items,
      counts,
      buyPrices: buy,
      sellPrices: sell,
      flipChances,
      rerollCostChaos,
      lfCost: pool.lfCost,
      strategy,
    })
  }, [pool, rows, flipChances, rerollCostChaos, strategy])

  const flipSet = useMemo(() => new Set(result.flipIds), [result.flipIds])

  const applyPwToRows = (which: 'buy' | 'sell' | 'both', source: 'pw' | 'zero' | 'copy') => {
    setRows((prev) => {
      const next = { ...prev }
      for (const item of pool.items) {
        const row = next[item.id]
        if (source === 'zero') {
          next[item.id] = {
            ...row,
            ...(which === 'buy' || which === 'both' ? { buy: 0 } : {}),
            ...(which === 'sell' || which === 'both' ? { sell: 0 } : {}),
          }
        } else if (source === 'copy') {
          if (which === 'buy') next[item.id] = { ...row, buy: row.sell }
          if (which === 'sell') next[item.id] = { ...row, sell: row.buy }
        } else {
          // Re-scale current values by pct relative to "market" ≈ max(buy,sell) or leave as-is
          const market = Math.max(row.buy, row.sell)
          if (which === 'buy' || which === 'both') {
            next[item.id] = {
              ...next[item.id],
              buy: Math.round(market * (buyPct / 100) * 100) / 100,
            }
          }
          if (which === 'sell' || which === 'both') {
            next[item.id] = {
              ...next[item.id],
              sell: Math.round(market * (sellPct / 100) * 100) / 100,
            }
          }
        }
      }
      return next
    })
  }

  const selectQty = (mode: 'all' | 'none' | 'flip' | 'keep') => {
    setRows((prev) => {
      const next = { ...prev }
      for (const item of pool.items) {
        const isFlip = flipSet.has(item.id)
        let enabled = prev[item.id]?.enabled ?? true
        if (mode === 'all') enabled = true
        if (mode === 'none') enabled = false
        if (mode === 'flip') enabled = isFlip
        if (mode === 'keep') enabled = !isFlip
        next[item.id] = { ...next[item.id], enabled }
      }
      return next
    })
  }

  const generateQty = () => {
    setRows((prev) => {
      const next = { ...prev }
      for (const item of pool.items) {
        if (!next[item.id]?.enabled) continue
        next[item.id] = { ...next[item.id], qty: randInt(qtyMin, qtyMax) }
      }
      return next
    })
  }

  const toDisplay = (chaos: number) => {
    if (priceUnit === 'divine') return chaosPerDiv > 0 ? chaos / chaosPerDiv : 0
    return chaos
  }
  const fromDisplay = (v: number) => {
    if (priceUnit === 'divine') return v * chaosPerDiv
    return v
  }

  const panelBg = cssVar('--bg', '#0c0c12')
  const text = cssVar('--text', '#e8e6e3')
  const dim = cssVar('--text-dim', '#9a9690')
  const accent = cssVar('--accent', '#c4a574')
  const border = cssVar('--border', '#2a2a32')
  const green = '#6dbf8a'
  const red = '#e07070'

  const lfPerDivEquivalent =
    lfBuyWith === 'chaos' ? lfPerChaos * chaosPerDiv : lfPerDivine

  return (
    <div
      style={{
        boxSizing: 'border-box',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 10,
        background: panelBg,
        color: text,
        fontSize: 12,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <strong style={{ color: accent, letterSpacing: '0.04em' }}>SCALPEL HARVEST</strong>
        <span style={{ color: dim }}>· {ctx.getLeague()}</span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => void importPrices()} style={btn(accent, border)}>
          Import: PW
        </button>
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {catalog.pools.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPoolId(p.id)}
            style={{
              ...btn(accent, border),
              background: p.id === poolId ? accent : 'transparent',
              color: p.id === poolId ? '#171821' : text,
            }}
          >
            {p.name}
          </button>
        ))}
      </div>

      {pool.notice ? <div style={{ color: '#e6c35c', fontSize: 11 }}>{pool.notice}</div> : null}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 260px) 1fr minmax(200px, 240px)',
          gap: 8,
        }}
      >
        {/* ===== Quick Config ===== */}
        <div style={{ overflow: 'auto', border: `1px solid ${border}`, borderRadius: 6, padding: 8 }}>
          <div style={{ color: accent, fontWeight: 700, marginBottom: 4 }}>Quick Config</div>
          <p style={{ margin: '0 0 8px', color: dim, fontSize: 10, lineHeight: 1.4 }}>
            Compute optimal harvest conversions &amp; profitability. Set currency, quantity, prices, and
            lifeforce cost.
          </p>

          <Section title="1. Currency" accent={accent}>
            <div style={{ color: dim, fontSize: 10, marginBottom: 4 }}>Think in chaos or divine?</div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              <Toggle active={priceUnit === 'chaos'} onClick={() => setPriceUnit('chaos')} accent={accent} border={border}>
                Chaos
              </Toggle>
              <Toggle active={priceUnit === 'divine'} onClick={() => setPriceUnit('divine')} accent={accent} border={border}>
                Divine
              </Toggle>
            </div>
            <label style={lab(dim)}>
              Exchange rate (chaos / divine)
              <input
                type="number"
                value={chaosPerDiv}
                onChange={(e) => setChaosPerDiv(Number(e.target.value) || 0)}
                style={input(border)}
              />
            </label>
            <div style={{ color: dim, fontSize: 10, marginTop: 4 }}>
              {fmtChaos(chaosPerDiv)} chaos = 1 divine
            </div>
          </Section>

          <Section title="2. Quantity" accent={accent}>
            <div style={{ color: dim, fontSize: 10, marginBottom: 4 }}>
              Tick GEN? then Generate. Does not change unit prices.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
              <button type="button" style={btn(accent, border)} onClick={() => selectQty('all')}>
                All
              </button>
              <button type="button" style={btn(accent, border)} onClick={() => selectQty('none')}>
                None
              </button>
              <button type="button" style={btn(accent, border)} onClick={() => selectQty('flip')}>
                Flip
              </button>
              <button type="button" style={btn(accent, border)} onClick={() => selectQty('keep')}>
                Keep
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              <span style={{ color: dim, fontSize: 10 }}>Between</span>
              <input
                type="number"
                value={qtyMin}
                onChange={(e) => setQtyMin(Number(e.target.value) || 0)}
                style={{ ...input(border), width: 52 }}
              />
              <span style={{ color: dim, fontSize: 10 }}>and</span>
              <input
                type="number"
                value={qtyMax}
                onChange={(e) => setQtyMax(Number(e.target.value) || 0)}
                style={{ ...input(border), width: 52 }}
              />
              <span style={{ color: dim, fontSize: 10 }}>of T{pool.tiers.join('/')}</span>
            </div>
            <button
              type="button"
              style={{ ...btn(accent, border), marginTop: 6, background: accent, color: '#171821', width: '100%' }}
              onClick={generateQty}
            >
              Generate
            </button>
          </Section>

          <Section title="3. Prices" accent={accent}>
            <div style={{ color: dim, fontSize: 10, marginBottom: 4 }}>
              Set in table or fetch from price providers (PW).
            </div>
            <label style={lab(dim)}>
              Buy × %
              <input
                type="number"
                value={buyPct}
                onChange={(e) => setBuyPct(Number(e.target.value) || 0)}
                style={input(border)}
              />
            </label>
            <div style={{ display: 'flex', gap: 4, margin: '4px 0 8px', flexWrap: 'wrap' }}>
              <button type="button" style={btn(accent, border)} onClick={() => applyPwToRows('buy', 'zero')}>
                Set 0
              </button>
              <button type="button" style={btn(accent, border)} onClick={() => applyPwToRows('buy', 'copy')}>
                Copy Sell
              </button>
            </div>
            <label style={lab(dim)}>
              Sell × %
              <input
                type="number"
                value={sellPct}
                onChange={(e) => setSellPct(Number(e.target.value) || 0)}
                style={input(border)}
              />
            </label>
            <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
              <button type="button" style={btn(accent, border)} onClick={() => applyPwToRows('sell', 'zero')}>
                Set 0
              </button>
              <button type="button" style={btn(accent, border)} onClick={() => applyPwToRows('sell', 'copy')}>
                Copy Buy
              </button>
              <button type="button" style={btn(accent, border)} onClick={() => void importPrices()}>
                PW
              </button>
            </div>
          </Section>

          <Section title="4. Conversions" accent={accent}>
            <div style={{ color: dim, fontSize: 10, marginBottom: 6, lineHeight: 1.4 }}>
              Horticrafting converts for <strong style={{ color: text }}>{pool.lfCost}× {pool.lfType}</strong>{' '}
              lifeforce. Conversions may be weighted (%).
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              <Toggle
                active={strategy === 'one-step'}
                onClick={() => setStrategy('one-step')}
                accent={accent}
                border={border}
              >
                One-step
              </Toggle>
              <Toggle
                active={strategy === 'optimal'}
                onClick={() => setStrategy('optimal')}
                accent={accent}
                border={border}
              >
                Optimal
              </Toggle>
            </div>
            <div style={{ color: dim, fontSize: 10, marginBottom: 4 }}>
              One-step: reroll when next roll + sale has +EV. Optimal: when full future strategy has +EV.
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              <Toggle
                active={lfBuyWith === 'chaos'}
                onClick={() => setLfBuyWith('chaos')}
                accent={accent}
                border={border}
              >
                Buy LF w/ chaos
              </Toggle>
              <Toggle
                active={lfBuyWith === 'divine'}
                onClick={() => setLfBuyWith('divine')}
                accent={accent}
                border={border}
              >
                Buy LF w/ divine
              </Toggle>
            </div>
            {lfBuyWith === 'chaos' ? (
              <label style={lab(dim)}>
                1 chaos buys lifeforce
                <input
                  type="number"
                  value={lfPerChaos}
                  onChange={(e) => setLfPerChaos(Number(e.target.value) || 0)}
                  style={input(border)}
                />
              </label>
            ) : (
              <label style={lab(dim)}>
                1 divine buys lifeforce
                <input
                  type="number"
                  value={lfPerDivine}
                  onChange={(e) => setLfPerDivine(Number(e.target.value) || 0)}
                  style={input(border)}
                />
              </label>
            )}
            <div style={{ color: dim, fontSize: 10, marginTop: 4 }}>
              ≈ {fmtChaos(lfPerDivEquivalent)} LF / divine
              <br />
              Convert cost: {pool.lfCost}× → {fmtChaos(rerollCostChaos)}c
            </div>
          </Section>
        </div>

        {/* ===== Table ===== */}
        <div style={{ overflow: 'auto', border: `1px solid ${border}`, borderRadius: 6 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, background: '#14141c', color: dim, zIndex: 1 }}>
                <th style={th}>GEN?</th>
                <th style={th}>#</th>
                <th style={{ ...th, textAlign: 'left' }}>ITEM</th>
                <th style={th}>BUY</th>
                <th style={th}>SELL</th>
                <th style={th}>1-STEP/OPT</th>
                <th style={th}>%</th>
                <th style={th}># AFTER</th>
                <th style={th}>FLIP?</th>
              </tr>
            </thead>
            <tbody>
              {pool.items.map((item) => {
                const row = rows[item.id]
                const isFlip = flipSet.has(item.id)
                return (
                  <tr
                    key={item.id}
                    style={{ background: isFlip ? 'rgba(180,60,60,0.12)' : 'transparent' }}
                  >
                    <td style={td}>
                      <input
                        type="checkbox"
                        checked={row?.enabled ?? true}
                        onChange={(e) => patchRow(item.id, { enabled: e.target.checked })}
                      />
                    </td>
                    <td style={td}>
                      <input
                        type="number"
                        value={row?.qty ?? 0}
                        onChange={(e) => patchRow(item.id, { qty: Number(e.target.value) || 0 })}
                        style={{ ...input(border), width: 52 }}
                      />
                    </td>
                    <td style={{ ...td, textAlign: 'left' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {icons[item.id] ? (
                          <img
                            src={icons[item.id]}
                            alt=""
                            width={22}
                            height={22}
                            style={{ objectFit: 'contain', flexShrink: 0 }}
                          />
                        ) : (
                          <span
                            style={{
                              width: 22,
                              height: 22,
                              background: '#222',
                              borderRadius: 3,
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <span title={item.id}>{item.shortName || item.id}</span>
                      </span>
                    </td>
                    <td style={td}>
                      <input
                        type="number"
                        step="any"
                        value={toDisplay(row?.buy ?? 0)}
                        onChange={(e) =>
                          patchRow(item.id, { buy: fromDisplay(Number(e.target.value) || 0) })
                        }
                        style={{ ...input(border), width: 64 }}
                      />
                    </td>
                    <td style={td}>
                      <input
                        type="number"
                        step="any"
                        value={toDisplay(row?.sell ?? 0)}
                        onChange={(e) =>
                          patchRow(item.id, { sell: fromDisplay(Number(e.target.value) || 0) })
                        }
                        style={{ ...input(border), width: 64 }}
                      />
                    </td>
                    <td style={{ ...td, color: (result.payoffs[item.id] ?? 0) > 0 ? red : dim }}>
                      {fmtInUnit(result.payoffs[item.id] ?? 0, priceUnit, chaosPerDiv)}
                    </td>
                    <td style={td}>{((weightPct[item.id] ?? 0) * 100).toFixed(1)}</td>
                    <td style={td}>{fmtChaos(result.afterCounts[item.id] ?? 0)}</td>
                    <td style={{ ...td, color: isFlip ? red : green, fontWeight: 600 }}>
                      {isFlip ? 'FLIP' : 'KEEP'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ===== Profits ===== */}
        <div style={{ overflow: 'auto', border: `1px solid ${border}`, borderRadius: 6, padding: 8 }}>
          <div style={{ color: accent, fontWeight: 700, marginBottom: 6 }}>Profits &amp; Losses</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <Toggle
              active={strategy === 'one-step'}
              onClick={() => setStrategy('one-step')}
              accent={accent}
              border={border}
            >
              One-step
            </Toggle>
            <Toggle
              active={strategy === 'optimal'}
              onClick={() => setStrategy('optimal')}
              accent={accent}
              border={border}
            >
              Optimal
            </Toggle>
          </div>
          <div style={{ color: dim, fontSize: 11, lineHeight: 1.55 }}>
            <div>Spent (buy): {fmtInUnit(result.buyTotalChaos, priceUnit, chaosPerDiv)}</div>
            <div>Sell as-is: {fmtInUnit(result.sellAsIsChaos, priceUnit, chaosPerDiv)}</div>
            <div>Sell after: {fmtInUnit(result.sellAfterChaos, priceUnit, chaosPerDiv)}</div>
            <div>
              LF needed: {fmtChaos(result.lifeforceNeeded)} ({fmtInUnit(result.lifeforceChaosCost, priceUnit, chaosPerDiv)})
            </div>
            <div style={{ color: text, marginTop: 6, fontSize: 13 }}>
              Profit:{' '}
              <strong style={{ color: result.expectedProfitChaos >= 0 ? green : red }}>
                {fmtInUnit(result.expectedProfitChaos, priceUnit, chaosPerDiv)}
              </strong>
            </div>
            <div>ROI {fmtPct(result.roiPct)}</div>
            <div>Expected flips: {fmtChaos(result.expectedFlipsTotal)}</div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ color: green, fontWeight: 600, marginBottom: 4 }}>
              KEEP ({pool.items.length - result.flipIds.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
              {pool.items
                .filter((i) => !flipSet.has(i.id))
                .map((i) => (
                  <ItemChip key={i.id} name={i.shortName} icon={icons[i.id]} border={border} />
                ))}
            </div>
            <div style={{ color: red, fontWeight: 600, marginBottom: 4 }}>
              FLIP ({result.flipIds.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {pool.items
                .filter((i) => flipSet.has(i.id))
                .map((i) => (
                  <ItemChip key={i.id} name={i.shortName} icon={icons[i.id]} border={border} />
                ))}
            </div>
          </div>
        </div>
      </div>

      {status ? <div style={{ color: dim, fontSize: 11 }}>{status}</div> : null}
    </div>
  )
}

function Section({
  title,
  accent,
  children,
}: {
  title: string
  accent: string
  children: ReactNode
}): JSX.Element {
  return (
    <div style={{ marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid #222' }}>
      <div style={{ color: accent, fontWeight: 600, marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  )
}

function Toggle({
  active,
  onClick,
  accent,
  border,
  children,
}: {
  active: boolean
  onClick: () => void
  accent: string
  border: string
  children: ReactNode
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...btn(accent, border),
        background: active ? accent : 'transparent',
        color: active ? '#171821' : accent,
        flex: 1,
      }}
    >
      {children}
    </button>
  )
}

function ItemChip({
  name,
  icon,
  border,
}: {
  name: string
  icon?: string
  border: string
}): JSX.Element {
  return (
    <span
      style={{
        border: `1px solid ${border}`,
        borderRadius: 4,
        padding: '2px 5px 2px 3px',
        fontSize: 10,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {icon ? <img src={icon} alt="" width={16} height={16} style={{ objectFit: 'contain' }} /> : null}
      {name}
    </span>
  )
}

const th: CSSProperties = { padding: '4px 6px', fontWeight: 600, whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '3px 6px', textAlign: 'center', borderTop: '1px solid #222' }

function lab(dim: string): CSSProperties {
  return { display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10, color: dim }
}

function btn(accent: string, border: string): CSSProperties {
  return {
    background: 'transparent',
    color: accent,
    border: `1px solid ${border}`,
    borderRadius: 4,
    padding: '3px 8px',
    cursor: 'pointer',
    fontSize: 11,
  }
}

function input(border: string): CSSProperties {
  return {
    background: '#14141c',
    color: '#e8e6e3',
    border: `1px solid ${border}`,
    borderRadius: 3,
    padding: '2px 4px',
    width: 72,
  }
}

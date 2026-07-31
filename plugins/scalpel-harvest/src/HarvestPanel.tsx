import type { ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
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
  fmtPct,
  indexPrices,
  lifeforceChaosPerUnit,
} from './prices'
import type { Catalog, CatalogPool, FlipStrategy, RowState } from './types'

const catalog = catalogJson as Catalog

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

export function HarvestPanel({ ctx }: { ctx: ScalpelPluginContext }): JSX.Element {
  const [poolId, setPoolId] = useState(catalog.pools[0]?.id ?? 'essences')
  const pool = catalog.pools.find((p) => p.id === poolId) ?? catalog.pools[0]
  const [rows, setRows] = useState<Record<string, RowState>>(() => defaultRows(pool))
  const [strategy, setStrategy] = useState<FlipStrategy>('one-step')
  const [chaosPerDiv, setChaosPerDiv] = useState(180)
  const [lfPerDivine, setLfPerDivine] = useState(15)
  const [status, setStatus] = useState('')
  const [icons, setIcons] = useState<Record<string, string>>({})

  const flipChances = useMemo(() => buildFlipChances(pool.items), [pool])
  const weightPct = useMemo(() => tierWeightPercents(pool.items), [pool])

  useEffect(() => {
    setRows(defaultRows(pool))
  }, [pool.id])

  const patchRow = useCallback((id: string, patch: Partial<RowState>) => {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }, [])

  const importPrices = useCallback(async () => {
    setStatus('Fetching poe.ninja…')
    try {
      await ctx.prices.refresh()
      const { prices } = await ctx.prices.getPrices()
      const byName = indexPrices(prices)
      setChaosPerDiv(divineRate(byName))
      const nextIcons: Record<string, string> = {}
      setRows((prev) => {
        const next = { ...prev }
        for (const item of pool.items) {
          const chaos = chaosForName(byName, item.id)
          const icon = byName.get(item.id)?.icon
          if (icon) nextIcons[item.id] = icon
          if (chaos != null) {
            next[item.id] = {
              ...next[item.id],
              buy: Math.round(chaos * 100) / 100,
              sell: Math.round(chaos * 100) / 100,
            }
          }
        }
        return next
      })
      setIcons((prev) => ({ ...prev, ...nextIcons }))
      const lf = lifeforceChaosPerUnit(byName, catalog, pool.lfType)
      if (lf != null && lf > 0) {
        const perDiv = divineRate(byName) / lf
        setLfPerDivine(Math.round(perDiv * 100) / 100)
      }
      setStatus(`Prices loaded · ${ctx.getLeague()}`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    }
  }, [ctx, pool])

  const rerollCostChaos = useMemo(() => {
    // lfPerDivine = how many LF one divine buys ⇒ chaos per LF = chaosPerDiv / lfPerDivine
    return (pool.lfCost * chaosPerDiv) / Math.max(lfPerDivine, 1e-9)
  }, [lfPerDivine, chaosPerDiv, pool.lfCost])

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

  const setAllQty = (qty: number) => {
    setRows((prev) => {
      const next = { ...prev }
      for (const item of pool.items) next[item.id] = { ...next[item.id], qty }
      return next
    })
  }

  const panelBg = cssVar('--bg', '#0c0c12')
  const text = cssVar('--text', '#e8e6e3')
  const dim = cssVar('--text-dim', '#9a9690')
  const accent = cssVar('--accent', '#c4a574')
  const border = cssVar('--border', '#2a2a32')

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
          Import prices
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

      {pool.notice && <div style={{ color: '#e6c35c', fontSize: 11 }}>{pool.notice}</div>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', color: dim }}>
        <label>
          Chaos/Divine{' '}
          <input
            type="number"
            value={chaosPerDiv}
            onChange={(e) => setChaosPerDiv(Number(e.target.value) || 0)}
            style={input(border)}
          />
        </label>
        <label>
          1 Divine buys LF{' '}
          <input
            type="number"
            value={lfPerDivine}
            onChange={(e) => setLfPerDivine(Number(e.target.value) || 0)}
            style={input(border)}
          />
        </label>
        <span>
          Convert cost: {pool.lfCost}× {pool.lfType} ({fmtChaos(rerollCostChaos)}c)
        </span>
        <span style={{ display: 'inline-flex', gap: 4 }}>
          <button
            type="button"
            onClick={() => setStrategy('one-step')}
            style={{
              ...btn(accent, border),
              background: strategy === 'one-step' ? accent : 'transparent',
              color: strategy === 'one-step' ? '#171821' : text,
            }}
          >
            One-step
          </button>
          <button
            type="button"
            onClick={() => setStrategy('optimal')}
            style={{
              ...btn(accent, border),
              background: strategy === 'optimal' ? accent : 'transparent',
              color: strategy === 'optimal' ? '#171821' : text,
            }}
          >
            Optimal
          </button>
        </span>
        <button type="button" onClick={() => setAllQty(25)} style={btn(accent, border)}>
          Qty 25
        </button>
        <button type="button" onClick={() => setAllQty(0)} style={btn(accent, border)}>
          Qty 0
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: `1px solid ${border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ position: 'sticky', top: 0, background: '#14141c', color: dim }}>
              <th style={th}>Flip?</th>
              <th style={th}>#</th>
              <th style={{ ...th, textAlign: 'left' }}>Item</th>
              <th style={th}>Buy</th>
              <th style={th}>Sell</th>
              <th style={th}>EV Δ</th>
              <th style={th}>%</th>
              <th style={th}>After</th>
            </tr>
          </thead>
          <tbody>
            {pool.items.map((item) => {
              const row = rows[item.id]
              const isFlip = flipSet.has(item.id)
              return (
                <tr key={item.id} style={{ background: isFlip ? 'rgba(180,60,60,0.12)' : 'transparent' }}>
                  <td style={td}>
                    <span style={{ color: isFlip ? '#e07070' : '#6dbf8a' }}>{isFlip ? 'FLIP' : 'KEEP'}</span>
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
                        <img src={icons[item.id]} alt="" width={18} height={18} style={{ objectFit: 'contain' }} />
                      ) : null}
                      {item.shortName || item.id}
                    </span>
                  </td>
                  <td style={td}>
                    <input
                      type="number"
                      value={row?.buy ?? 0}
                      onChange={(e) => patchRow(item.id, { buy: Number(e.target.value) || 0 })}
                      style={{ ...input(border), width: 64 }}
                    />
                  </td>
                  <td style={td}>
                    <input
                      type="number"
                      value={row?.sell ?? 0}
                      onChange={(e) => patchRow(item.id, { sell: Number(e.target.value) || 0 })}
                      style={{ ...input(border), width: 64 }}
                    />
                  </td>
                  <td style={{ ...td, color: (result.payoffs[item.id] ?? 0) > 0 ? '#e07070' : dim }}>
                    {fmtChaos(result.payoffs[item.id] ?? 0)}
                  </td>
                  <td style={td}>{((weightPct[item.id] ?? 0) * 100).toFixed(1)}</td>
                  <td style={td}>{fmtChaos(result.afterCounts[item.id] ?? 0)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          borderTop: `1px solid ${border}`,
          paddingTop: 8,
          color: dim,
        }}
      >
        <div>
          <div style={{ color: accent, marginBottom: 4 }}>Summary</div>
          <div>Buy total: {fmtChaos(result.buyTotalChaos)}c</div>
          <div>Sell as-is: {fmtChaos(result.sellAsIsChaos)}c</div>
          <div>Sell after: {fmtChaos(result.sellAfterChaos)}c</div>
          <div>
            LF needed: {fmtChaos(result.lifeforceNeeded)} ({fmtChaos(result.lifeforceChaosCost)}c)
          </div>
          <div style={{ color: text, marginTop: 4 }}>
            Expected profit: <strong>{fmtChaos(result.expectedProfitChaos)}c</strong> · ROI{' '}
            {fmtPct(result.roiPct)}
          </div>
          <div>Expected flips: {fmtChaos(result.expectedFlipsTotal)}</div>
        </div>
        <div>
          <div style={{ color: '#6dbf8a' }}>KEEP ({pool.items.length - result.flipIds.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            {pool.items
              .filter((i) => !flipSet.has(i.id))
              .map((i) => (
                <span key={i.id} style={chip(border)}>
                  {i.shortName}
                </span>
              ))}
          </div>
          <div style={{ color: '#e07070' }}>FLIP ({result.flipIds.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {pool.items
              .filter((i) => flipSet.has(i.id))
              .map((i) => (
                <span key={i.id} style={chip(border)}>
                  {i.shortName}
                </span>
              ))}
          </div>
        </div>
      </div>

      {status ? <div style={{ color: dim, fontSize: 11 }}>{status}</div> : null}
    </div>
  )
}

const th: CSSProperties = { padding: '4px 6px', fontWeight: 600, whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '3px 6px', textAlign: 'center', borderTop: '1px solid #222' }

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

function chip(border: string): CSSProperties {
  return {
    border: `1px solid ${border}`,
    borderRadius: 3,
    padding: '1px 5px',
    fontSize: 10,
  }
}

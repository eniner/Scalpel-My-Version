import type { PriceEntry, ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { useCallback, useEffect, useMemo, useState } from 'react'
import currencyItemsJson from '../data/currency-items-ref.json'
import { indexPriceIcons } from '../shared/icons'
import { ItemName } from '../shared/ItemName'
import { chaosForName, fmtChaos, historicalChaos, indexPrices, lastGraphPct } from '../shared/prices'
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
} from '../shared/ui'

type CurrencyItem = { id: string; name: string }

const ITEMS = currencyItemsJson as CurrencyItem[]

export function CurrencyTrendsTool({
  ctx,
  onBack,
}: {
  ctx: ScalpelPluginContext
  onBack: () => void
}): JSX.Element {
  const [cpd, setCpd] = useState(180)
  const [status, setStatus] = useState('')
  const [entriesByName, setEntriesByName] = useState<Map<string, PriceEntry>>(() => new Map())
  const [priceIcons, setPriceIcons] = useState<Map<string, string>>(() => new Map())

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<CurrencyItem | null>(null)

  const league = ctx.getLeague()

  const refreshPrices = useCallback(async () => {
    setStatus('Fetching prices…')
    try {
      await ctx.prices.refresh()
      const { prices: list } = await ctx.prices.getPrices()
      const byName = indexPrices(list)
      setEntriesByName(byName)
      setPriceIcons(indexPriceIcons(list))
      setCpd(chaosForName(byName, 'Divine Orb') ?? 180)
      setStatus(`poe.ninja · ${league}`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    }
  }, [ctx, league])

  useEffect(() => {
    void refreshPrices()
  }, [refreshPrices])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return ITEMS.slice(0, 60)
    return ITEMS.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 60)
  }, [search])

  const selectedEntry = selected
    ? entriesByName.get(selected.name) ?? entriesByName.get(selected.name.toLowerCase()) ?? null
    : null

  const livePrice = selectedEntry?.chaosValue ?? null
  const weekPct = lastGraphPct(selectedEntry?.graph)

  const series = useMemo(() => {
    if (!selectedEntry || livePrice == null) return [] as Array<{ label: string; chaos: number | null; pct: number | null }>
    const graph = selectedEntry.graph ?? []
    if (graph.length === 0) {
      return [{ label: 'today', chaos: livePrice, pct: 0 }]
    }
    const todayPct = lastGraphPct(graph) ?? 0
    return graph.map((pct, i) => ({
      label: i === graph.length - 1 ? 'today' : `d${i + 1}`,
      pct: typeof pct === 'number' && Number.isFinite(pct) ? pct : null,
      chaos:
        typeof pct === 'number' && Number.isFinite(pct)
          ? historicalChaos(livePrice, todayPct, pct)
          : null,
    }))
  }, [selectedEntry, livePrice])

  const maxPrice = useMemo(() => {
    let max = 0
    for (const p of series) {
      if (p.chaos != null && p.chaos > max) max = p.chaos
    }
    return max
  }, [series])

  return (
    <Workbench>
      <ToolHeader
        toolId="currency-trends"
        title="Currency Trends"
        onBack={onBack}
        status={status}
        onRefresh={() => void refreshPrices()}
        refreshLabel="Refresh"
      />
      <Blurb>
        Search tracked items and view the 7-day price sparkline from Scalpel / poe.ninja (same series as Economy).
      </Blurb>

      <SplitBody
        railWidth={260}
        rail={
          <>
            <SetupGroup title="Items">
              <FieldLabel label="Search" wide>
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="text"
                  placeholder="Search items…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </FieldLabel>
              <Blurb>{ITEMS.length} items total · showing {filteredItems.length}</Blurb>
            </SetupGroup>

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: `1px solid ${theme.border}` }}>
              {filteredItems.map((item) => (
                <ListRow
                  key={item.id}
                  muted={selected?.id !== item.id}
                  leading={
                    <button
                      type="button"
                      onClick={() => setSelected(item)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: selected?.id === item.id ? theme.accent : theme.text,
                        fontSize: 12,
                      }}
                    >
                      <ItemName name={item.name} opts={{ priceIcons }}>
                        {item.name}
                      </ItemName>
                    </button>
                  }
                />
              ))}
              {filteredItems.length === 0 ? (
                <div style={{ color: theme.dim, fontSize: 11, padding: 8 }}>No matches</div>
              ) : null}
            </div>
          </>
        }
        stage={
          !selected ? (
            <Blurb>Select an item to view its 7-day trend.</Blurb>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ItemName name={selected.name} size={22} opts={{ priceIcons }}>
                  <strong style={{ fontSize: 16, color: theme.ink }}>{selected.name}</strong>
                </ItemName>
                <span style={{ fontSize: 11, color: theme.dim }}>7-day window</span>
              </div>
              <HeroRow>
                <HeroMetric
                  label="Live price"
                  value={livePrice != null ? fmtChaos(livePrice, cpd) : '—'}
                  tone={livePrice != null ? 'good' : 'warn'}
                />
                <HeroMetric
                  label="7-day change"
                  value={weekPct != null ? `${weekPct >= 0 ? '+' : ''}${weekPct.toFixed(1)}%` : '—'}
                  tone={weekPct != null && weekPct >= 0 ? 'accent' : 'warn'}
                />
              </HeroRow>

              <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {livePrice == null ? (
                  <Blurb>No poe.ninja price for this item in the current league snapshot.</Blurb>
                ) : series.filter((p) => p.chaos != null).length < 2 ? (
                  <Blurb>No sparkline history for this item (ninja omitted the 7-day graph).</Blurb>
                ) : (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        gap: 1,
                        height: 80,
                        borderBottom: `1px solid ${theme.border}`,
                        flexShrink: 0,
                      }}
                    >
                      {series.map((p, i) => {
                        const heightPct = p.chaos != null && maxPrice > 0 ? Math.max((p.chaos / maxPrice) * 100, 2) : 0
                        return (
                          <div
                            key={i}
                            title={`${p.label} — ${p.chaos != null ? fmtChaos(p.chaos, cpd) : 'n/a'}${
                              p.pct != null ? ` (${p.pct >= 0 ? '+' : ''}${p.pct.toFixed(1)}%)` : ''
                            }`}
                            style={{
                              flex: 1,
                              height: `${heightPct}%`,
                              background: theme.accent,
                              opacity: p.chaos != null ? 0.85 : 0.15,
                              minWidth: 1,
                            }}
                          />
                        )
                      })}
                    </div>

                    <div style={{ border: `1px solid ${theme.border}` }}>
                      {[...series].reverse().map((p, i) => (
                        <ListRow
                          key={i}
                          leading={
                            <span style={{ fontSize: 12, color: theme.text, textTransform: 'capitalize' }}>
                              {p.label}
                            </span>
                          }
                          trailing={
                            <>
                              <span className="sa-num" style={{ minWidth: 72, textAlign: 'right' }}>
                                {p.chaos != null ? fmtChaos(p.chaos, cpd) : '—'}
                              </span>
                              <span
                                className="sa-num"
                                style={{
                                  color: p.pct != null && p.pct >= 0 ? theme.blue : theme.red,
                                  minWidth: 56,
                                  textAlign: 'right',
                                  fontSize: 11,
                                }}
                              >
                                {p.pct != null ? `${p.pct >= 0 ? '+' : ''}${p.pct.toFixed(1)}%` : '—'}
                              </span>
                            </>
                          }
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )
        }
      />
    </Workbench>
  )
}

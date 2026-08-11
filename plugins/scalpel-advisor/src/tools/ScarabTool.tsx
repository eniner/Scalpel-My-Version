import type { ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { useCallback, useEffect, useMemo, useState } from 'react'
import scarabsRefJson from '../data/scarabs-ref.json'
import {
  buildVendorGuide,
  computeOptimalStrategy,
  computeScarabPool,
  VENDOR_CATEGORY_ORDER,
  type Scarab,
  type ScarabsRef,
} from '../engines/scarab'
import { indexPriceIcons } from '../shared/icons'
import { ItemName } from '../shared/ItemName'
import { chaosForId, chaosForName, fmtChaos, idToName, indexPrices } from '../shared/prices'
import { ToolHeader } from '../shared/ToolChrome'
import { inputStyle } from '../shared/theme'
import {
  ActionChip,
  Blurb,
  FieldLabel,
  HeroMetric,
  HeroRow,
  ListRow,
  SetupGroup,
  SplitBody,
  TabStrip,
  Workbench,
  accentBtnStyle,
  btnStyle,
  fonts,
  theme,
} from '../shared/ui'

const REF = scarabsRefJson as ScarabsRef

export function ScarabTool({
  ctx,
  onBack,
  view = 'farming',
}: {
  ctx: ScalpelPluginContext
  onBack: () => void
  view?: 'farming' | 'vendor'
}): JSX.Element {
  const [tab, setTab] = useState<'farming' | 'vendor'>(view)
  const [prices, setPrices] = useState<Record<string, number | null>>({})
  const [priceOverrides] = useState<Record<string, number>>({})
  const [remarkableRelics, setRemarkableRelics] = useState(true)
  const [blocked, setBlocked] = useState<Set<string>>(new Set())
  const [boosted, setBoosted] = useState<Set<string>>(new Set())
  const [invested, setInvested] = useState<Set<string>>(new Set())
  const [cpd, setCpd] = useState(180)
  const [status, setStatus] = useState('')
  const [priceIcons, setPriceIcons] = useState<Map<string, string>>(() => new Map())
  const [filter, setFilter] = useState('')

  useEffect(() => setTab(view), [view])

  const priceFor = useCallback((scarab: Scarab): number | null => prices[scarab.id] ?? null, [prices])

  const refresh = useCallback(async () => {
    setStatus('Syncing…')
    try {
      await ctx.prices.refresh()
      const { prices: list } = await ctx.prices.getPrices()
      const byName = indexPrices(list)
      setPriceIcons(indexPriceIcons(list))
      setCpd(chaosForName(byName, 'Divine Orb') ?? 180)
      const next: Record<string, number | null> = {}
      for (const cat of REF.categories) {
        for (const s of cat.scarabs) {
          next[s.id] = chaosForId(byName, s.id) ?? chaosForName(byName, s.name)
        }
      }
      setPrices(next)
      setStatus(`${ctx.getLeague()} · ninja`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    }
  }, [ctx])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const pool = useMemo(
    () =>
      computeScarabPool({
        categories: REF.categories,
        priceFor,
        priceOverrides,
        remarkableRelics,
        blocked,
        boosted,
        invested,
      }),
    [priceFor, priceOverrides, remarkableRelics, blocked, boosted, invested],
  )

  const optimal = useMemo(
    () =>
      computeOptimalStrategy({
        categories: REF.categories,
        priceFor,
        priceOverrides,
        remarkableRelics,
      }),
    [priceFor, priceOverrides, remarkableRelics],
  )

  const vendorGuide = useMemo(
    () => buildVendorGuide({ categories: REF.categories, priceFor, priceOverrides }),
    [priceFor, priceOverrides],
  )

  const applyOptimal = () => {
    setBlocked(new Set(optimal.blocks))
    setBoosted(new Set(optimal.boosts))
    setInvested(new Set(optimal.investments))
  }

  const resetBiases = () => {
    setBlocked(new Set())
    setBoosted(new Set())
    setInvested(new Set())
  }

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setter(next)
  }

  const sortedCategories = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return [...pool.categories]
      .filter((c) => !q || c.category.name.toLowerCase().includes(q))
      .sort((a, b) => b.ev - a.ev)
  }, [pool.categories, filter])

  const vendorByCategory = useMemo(() => {
    const map = new Map<string, typeof vendorGuide.rows>()
    for (const row of vendorGuide.rows) {
      const list = map.get(row.category.id) ?? []
      list.push(row)
      map.set(row.category.id, list)
    }
    return map
  }, [vendorGuide.rows])

  const delta = pool.poolEV - pool.baselineEV

  return (
    <Workbench>
      <ToolHeader
        toolId="scarab-atlas"
        title="Scarab Atlas"
        onBack={onBack}
        status={status}
        onRefresh={() => void refresh()}
      />

      <TabStrip
        tabs={[
          { id: 'farming', label: 'Pool EV' },
          { id: 'vendor', label: 'Vendor' },
        ]}
        value={tab}
        onChange={(id) => setTab(id as 'farming' | 'vendor')}
      />

      {tab === 'farming' ? (
        <SplitBody
          rail={
            <>
              <SetupGroup title="Strategy">
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: theme.text }}>
                  <input
                    type="checkbox"
                    checked={remarkableRelics}
                    onChange={(e) => setRemarkableRelics(e.target.checked)}
                  />
                  Remarkable Relics
                </label>
                <button type="button" style={accentBtnStyle} onClick={applyOptimal}>
                  Snap to optimal
                </button>
                <button type="button" style={btnStyle} onClick={resetBiases}>
                  Clear biases
                </button>
                <Blurb>
                  Optimal wants {optimal.blocks.length} blocks, {optimal.boosts.length} boosts,{' '}
                  {optimal.investments.length} invests.
                </Blurb>
              </SetupGroup>
              <SetupGroup title="Find category" defaultOpen={false}>
                <FieldLabel label="Filter">
                  <input
                    style={{ ...inputStyle, width: '100%' }}
                    value={filter}
                    placeholder="Abyss, Breach…"
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </FieldLabel>
              </SetupGroup>
            </>
          }
          stage={
            <>
              <HeroRow>
                <HeroMetric label="Your pool" value={fmtChaos(pool.poolEV, cpd)} tone="accent" />
                <HeroMetric
                  label="vs baseline"
                  value={`${delta >= 0 ? '+' : ''}${fmtChaos(delta, cpd)}`}
                  tone={delta >= 0 ? 'good' : 'warn'}
                  sub={`baseline ${fmtChaos(pool.baselineEV, cpd)}`}
                />
                <HeroMetric
                  label="Optimal"
                  value={fmtChaos(optimal.ev, cpd)}
                  tone="good"
                  sub={`${fmtChaos(optimal.ev - pool.poolEV, cpd)} left on table`}
                />
              </HeroRow>

              <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: `1px solid ${theme.border}` }}>
                {sortedCategories.map(({ category, ev, multiplier, blocked: isBlocked }) => (
                  <ListRow
                    key={category.id}
                    muted={isBlocked}
                    leading={
                      <div>
                        <ItemName
                          name={category.scarabs[0]?.name ?? category.name}
                          size={22}
                          opts={{
                            priceIcons,
                            aliases: category.scarabs[0] ? [idToName(category.scarabs[0].id)] : undefined,
                          }}
                        >
                          <span style={{ fontFamily: fonts.display, fontSize: 15, color: theme.ink }}>
                            {category.name}
                          </span>
                        </ItemName>
                        <div style={{ fontSize: 10, color: theme.muted, marginTop: 2 }}>
                          {category.atlasModifier} · {multiplier.toFixed(2)}× weight
                        </div>
                      </div>
                    }
                    trailing={
                      <>
                        <span className="sa-num" style={{ color: theme.purple, minWidth: 56, textAlign: 'right' }}>
                          {fmtChaos(ev, cpd)}
                        </span>
                        <ActionChip
                          label="Block"
                          tone="warn"
                          active={blocked.has(category.id)}
                          disabled={category.atlasModifier !== 'blockable'}
                          onClick={
                            category.atlasModifier === 'blockable'
                              ? () => toggle(blocked, setBlocked, category.id)
                              : undefined
                          }
                        />
                        <ActionChip
                          label="Boost"
                          tone="accent"
                          active={boosted.has(category.id)}
                          disabled={category.atlasModifier !== 'boostable'}
                          onClick={
                            category.atlasModifier === 'boostable'
                              ? () => toggle(boosted, setBoosted, category.id)
                              : undefined
                          }
                        />
                        <ActionChip
                          label="Invest"
                          tone="good"
                          active={invested.has(category.id)}
                          disabled={!category.investmentBoost}
                          onClick={
                            category.investmentBoost
                              ? () => toggle(invested, setInvested, category.id)
                              : undefined
                          }
                        />
                      </>
                    }
                  />
                ))}
              </div>
            </>
          }
        />
      ) : (
        <SplitBody
          railWidth={280}
          rail={
            <>
              <SetupGroup title="Recipe">
                <Blurb>
                  Three scarabs → one random worth{' '}
                  <span className="sa-num" style={{ color: theme.purple }}>
                    {fmtChaos(vendorGuide.rawBaselineEV, cpd)}
                  </span>
                  . Vendor under{' '}
                  <span className="sa-num" style={{ color: theme.accentHot }}>
                    {fmtChaos(vendorGuide.vendorThreshold, cpd)}
                  </span>
                  .
                </Blurb>
              </SetupGroup>
              <SetupGroup title="Trade search">
                <FieldLabel label="Regex" wide>
                  <input
                    readOnly
                    style={{ ...inputStyle, width: '100%', fontFamily: fonts.mono }}
                    value={vendorGuide.searchString}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                </FieldLabel>
                <div style={{ fontSize: 11, color: theme.dim }} className="sa-num">
                  {vendorGuide.includedCount}/{vendorGuide.totalVendorable} · {vendorGuide.searchString.length}/248
                </div>
              </SetupGroup>
            </>
          }
          stage={
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[...REF.categories]
                .sort((a, b) => VENDOR_CATEGORY_ORDER.indexOf(a.id) - VENDOR_CATEGORY_ORDER.indexOf(b.id))
                .map((cat) => {
                  const rows = vendorByCategory.get(cat.id) ?? []
                  if (rows.length === 0) return null
                  return (
                    <div key={cat.id} style={{ borderBottom: `1px solid ${theme.border}`, padding: '10px 4px 12px' }}>
                      <div
                        style={{
                          fontFamily: fonts.display,
                          fontSize: 14,
                          color: theme.ink,
                          marginBottom: 6,
                        }}
                      >
                        {cat.name}{' '}
                        <span style={{ color: theme.muted, fontFamily: fonts.ui, fontSize: 11 }}>
                          {rows.length} to vendor
                        </span>
                      </div>
                      {rows.map((row) => (
                        <div
                          key={row.scarab.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr auto auto',
                            gap: 10,
                            fontSize: 12,
                            padding: '3px 0',
                          }}
                        >
                          <ItemName
                            name={row.scarab.name}
                            opts={{ priceIcons, aliases: [idToName(row.scarab.id)] }}
                            style={{ color: theme.dim }}
                          >
                            {row.scarab.name.replace(/Scarab of /i, '').replace(/ Scarab$/i, '')}
                          </ItemName>
                          <span className="sa-num">{fmtChaos(row.price, cpd)}</span>
                          <span className="sa-num" style={{ color: theme.green }}>
                            +{fmtChaos(row.profit, cpd)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                })}
            </div>
          }
        />
      )}
    </Workbench>
  )
}

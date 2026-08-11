import type { PluginTradeSearchItem, PriceEntry, ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { Button, ErrorBanner, TextInput, formatPrice } from '@scalpelpoe/plugin-sdk'
import { useCallback, useEffect, useMemo, useState, type ImgHTMLAttributes } from 'react'
import { evaluateBuildGear, needsTradePriceCheck, priceCheckSearchPayload } from './build-value'
import { fetchNinjaCharacterModelDirect } from './fetch-ninja-character'
import { mapEquippedGear, type EquippedItem, type EquippedModKind } from './map-equipped'
import { mapAscendancyAndKeystones, type PassiveNodeCard } from './map-passives'
import {
  formatCompact,
  mapCharacterModel,
  type MappedCharacter,
  type SkillDpsEntry,
} from './map-skill-dps'
import { parseNinjaCharacterUrl, profileUrl } from './parse-ninja-url'
import { equippedToTradeSearch } from './upgrade-search'

const DEFAULT_URL = 'https://poe.ninja/poe2/profile/Enin9-6394/runesofaldur/character/Aenthan'

const COLORS = {
  bg: '#12151c',
  panel: '#1a1f2a',
  border: '#2a3344',
  text: '#e8ecf4',
  muted: '#8b95a8',
  accent: '#6eb5ff',
  cold: '#6ec8ff',
  fire: '#ff8a6e',
  lightning: '#ffe66e',
  chaos: '#c98cff',
  phys: '#d0d4dc',
  unique: '#af6025',
  rare: '#ffff77',
  magic: '#8888ff',
  normal: '#c8c8c8',
}

function rarityColor(rarity: EquippedItem['rarity']): string {
  if (rarity === 'Unique') return COLORS.unique
  if (rarity === 'Rare') return COLORS.rare
  if (rarity === 'Magic') return COLORS.magic
  return COLORS.normal
}

function flatColor(type: string): string {
  const t = type.toLowerCase()
  if (t.includes('cold')) return COLORS.cold
  if (t.includes('fire')) return COLORS.fire
  if (t.includes('lightning')) return COLORS.lightning
  if (t.includes('chaos')) return COLORS.chaos
  return COLORS.phys
}

function summaryLine(s: SkillDpsEntry): string {
  const parts: string[] = []
  if (s.rate > 0) parts.push(`${s.rate.toFixed(1)}/s`)
  if (s.critChance > 0) parts.push(`${Math.round(s.critChance)}% crit`)
  if (s.critMultiplier > 0) parts.push(`${Math.round(s.critMultiplier * 100)}% crit multi`)
  if (s.aoeRadius != null && s.aoeRadius > 0) parts.push(`${s.aoeRadius.toFixed(1)}m radius`)
  if (s.duration != null && s.duration > 0) parts.push(`${s.duration.toFixed(0)}s duration`)
  return parts.join(', ')
}

function SkillRow({ skill }: { skill: SkillDpsEntry }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      style={{
        borderBottom: `1px solid ${COLORS.border}`,
        padding: '10px 0',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          gap: 12,
          width: '100%',
          color: COLORS.text,
          alignItems: 'center',
        }}
      >
        <IconThumb src={skill.iconUrl} alt={skill.name} size={40} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{skill.name}</div>
          <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }}>{summaryLine(skill)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.accent, fontVariantNumeric: 'tabular-nums' }}>
            {formatCompact(skill.averageDamage)}
          </div>
          <div style={{ color: COLORS.muted, fontSize: 11 }}>Average Damage</div>
          {skill.dps > 0 && skill.dps !== skill.averageDamage ? (
            <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 2 }}>
              {formatCompact(skill.dps)} DPS
            </div>
          ) : null}
        </div>
      </button>
      {open ? (
        <div style={{ marginTop: 10, paddingLeft: 52, fontSize: 12, color: COLORS.muted }}>
          {skill.flat
            .filter((f) => f.average > 0)
            .map((f) => (
              <div key={f.type} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span style={{ color: flatColor(f.type) }}>{f.type} Damage</span>
                <span style={{ color: COLORS.text, fontVariantNumeric: 'tabular-nums' }}>
                  {formatCompact(f.average)}
                </span>
              </div>
            ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
            <span>Cast rate</span>
            <span style={{ color: COLORS.text }}>{skill.rate.toFixed(2)}/s</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
            <span>Crit chance</span>
            <span style={{ color: COLORS.text }}>{skill.critChance.toFixed(1)}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
            <span>Crit multiplier</span>
            <span style={{ color: COLORS.text }}>{Math.round(skill.critMultiplier * 100)}%</span>
          </div>
          {skill.aoeRadius != null ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span>AoE radius</span>
              <span style={{ color: COLORS.text }}>{skill.aoeRadius.toFixed(1)}m</span>
            </div>
          ) : null}
          {skill.duration != null ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span>Duration</span>
              <span style={{ color: COLORS.text }}>{skill.duration.toFixed(2)}s</span>
            </div>
          ) : null}
          {skill.supportGems.length > 0 ? (
            <div style={{ marginTop: 8 }}>
              <div style={{ marginBottom: 6, color: COLORS.muted }}>Supports</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {skill.supportGems.map((name, i) => (
                  <div
                    key={`${name}-${i}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: COLORS.bg,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 6,
                      padding: '4px 8px 4px 4px',
                      color: COLORS.text,
                    }}
                  >
                    <IconThumb src={skill.supportIconUrls[i] ?? null} alt={name} size={22} />
                    <span>{name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function kindLabel(kind: EquippedModKind): string {
  if (kind === 'explicit') return ''
  return kind
}

function GearRow({
  item,
  selectedModIds,
  onToggleMod,
  onFind,
  busy,
  error,
}: {
  item: EquippedItem
  selectedModIds: Set<string>
  onToggleMod: (modId: string, checked: boolean) => void
  onFind: () => void
  busy: boolean
  error: string | null
}) {
  const color = rarityColor(item.rarity)
  const checkedCount = item.mods.filter((m) => selectedModIds.has(m.id)).length
  return (
    <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: '8px 0' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          gap: 10,
          alignItems: 'start',
        }}
      >
        <IconThumb src={item.iconUrl} alt={item.name} size={36} />
        <div style={{ minWidth: 0, color: COLORS.text }}>
          <div style={{ fontSize: 11, color: COLORS.muted }}>
            {item.slotLabel}
            {item.corrupted ? ' · Corrupted' : ''}
          </div>
          <div style={{ fontWeight: 600, fontSize: 13, color, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.name}
          </div>
          {item.name !== item.baseType ? (
            <div style={{ fontSize: 11, color: COLORS.muted }}>{item.baseType}</div>
          ) : null}
          {item.mods.length > 0 ? (
            <div style={{ marginTop: 6, fontSize: 11 }}>
              {item.mods.map((m) => {
                const checked = selectedModIds.has(m.id)
                const label = kindLabel(m.kind)
                return (
                  <label
                    key={m.id}
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'flex-start',
                      padding: '2px 0',
                      cursor: item.rarity === 'Unique' ? 'default' : 'pointer',
                      opacity: item.rarity === 'Unique' ? 0.85 : checked ? 1 : 0.55,
                      color: COLORS.text,
                      lineHeight: 1.35,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={item.rarity === 'Unique'}
                      onChange={(e) => onToggleMod(m.id, e.target.checked)}
                      style={{ marginTop: 2 }}
                    />
                    <span>
                      {label ? (
                        <span style={{ color: COLORS.muted, marginRight: 6 }}>{label}</span>
                      ) : null}
                      {m.text}
                    </span>
                  </label>
                )
              })}
            </div>
          ) : (
            <div style={{ marginTop: 4, fontSize: 11, color: COLORS.muted }}>No mods on model</div>
          )}
        </div>
        <Button onClick={onFind} disabled={busy || (item.rarity !== 'Unique' && checkedCount === 0)}>
          {busy ? '…' : 'Find upgrades'}
        </Button>
      </div>
      {error ? (
        <div style={{ marginTop: 6, fontSize: 11, color: COLORS.fire }}>{error}</div>
      ) : null}
    </div>
  )
}

interface AppProps {
  ctx: ScalpelPluginContext
}

export function App({ ctx }: AppProps) {
  const [url, setUrl] = useState(DEFAULT_URL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mapped, setMapped] = useState<MappedCharacter | null>(null)
  const [gear, setGear] = useState<EquippedItem[]>([])
  const [passives, setPassives] = useState<PassiveNodeCard[]>([])
  const [modelVersion, setModelVersion] = useState<number | null>(null)
  const [similarItems, setSimilarItems] = useState(false)
  const [searchingId, setSearchingId] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  /** itemId → set of checked mod ids (default: all checked on load). */
  const [selectedByItem, setSelectedByItem] = useState<Record<string, Set<string>>>({})
  const [priceMap, setPriceMap] = useState<Map<string, PriceEntry>>(() => new Map())
  const [tradeOverrides, setTradeOverrides] = useState<
    Record<string, { divine: number | null; note: string | null }>
  >({})
  const [buildValueOpen, setBuildValueOpen] = useState(true)
  const [upgradesOpen, setUpgradesOpen] = useState(true)
  const [passivesOpen, setPassivesOpen] = useState(true)
  const [pricing, setPricing] = useState(false)
  const [pricingStatus, setPricingStatus] = useState<string | null>(null)

  const parsed = useMemo(() => parseNinjaCharacterUrl(url), [url])

  useEffect(() => {
    const next: Record<string, Set<string>> = {}
    for (const item of gear) {
      next[item.id] = new Set(
        item.mods.filter((m) => !/^bonded:/i.test(m.text)).map((m) => m.id),
      )
    }
    setSelectedByItem(next)
  }, [gear])

  useEffect(() => {
    let cancelled = false
    const loadPrices = async () => {
      try {
        const { prices } = await ctx.prices.getPrices()
        if (cancelled) return
        const next = new Map<string, PriceEntry>()
        for (const p of prices) next.set(p.name.toLowerCase(), p)
        setPriceMap(next)
      } catch {
        if (!cancelled) setPriceMap(new Map())
      }
    }
    void loadPrices()
    const unsub = ctx.prices.onChange(() => {
      void loadPrices()
    })
    return () => {
      cancelled = true
      unsub?.()
    }
  }, [ctx])

  const buildValue = useMemo(
    () => evaluateBuildGear(gear, priceMap, tradeOverrides),
    [gear, priceMap, tradeOverrides],
  )

  const load = useCallback(async () => {
    const ref = parseNinjaCharacterUrl(url)
    if (!ref) {
      setError('Paste a poe.ninja PoE2 character URL (…/poe2/profile/…/character/…)')
      return
    }
    setLoading(true)
    setError(null)
    setRowErrors({})
    setTradeOverrides({})
    try {
      type GetModel = (opts: {
        account: string
        league: string
        name: string
        modelVersion?: number
      }) => Promise<{ type: string; charModel: unknown; modelVersion: number }>
      const fromCtx = ctx.ninja?.getCharacterModel
      const fromApi = (
        window as unknown as { api?: { ninjaGetCharacterModel?: GetModel } }
      ).api?.ninjaGetCharacterModel
      const getModel: GetModel | undefined = fromCtx ?? fromApi
      const result = getModel
        ? await getModel(ref)
        : await fetchNinjaCharacterModelDirect(ctx.fetch ?? fetch.bind(window), ref)
      setMapped(mapCharacterModel(result.charModel))
      setGear(mapEquippedGear(result.charModel))
      setPassives(mapAscendancyAndKeystones(result.charModel))
      setModelVersion(result.modelVersion)
    } catch (e) {
      setMapped(null)
      setGear([])
      setPassives([])
      setModelVersion(null)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [ctx, url])

  const toggleMod = useCallback((itemId: string, modId: string, checked: boolean) => {
    setSelectedByItem((prev) => {
      const cur = new Set(prev[itemId] ?? [])
      if (checked) cur.add(modId)
      else cur.delete(modId)
      return { ...prev, [itemId]: cur }
    })
  }, [])

  const findUpgrades = useCallback(
    async (item: EquippedItem) => {
      if (!ctx.trade?.openSearch) {
        setRowErrors((prev) => ({ ...prev, [item.id]: 'Trade API unavailable in this Scalpel build' }))
        return
      }
      const selectedIds = selectedByItem[item.id] ?? new Set<string>()
      const selectedMods = item.mods.filter((m) => selectedIds.has(m.id))
      if (item.rarity !== 'Unique' && selectedMods.length === 0) {
        setRowErrors((prev) => ({ ...prev, [item.id]: 'Check at least one mod to search for' }))
        return
      }
      setSearchingId(item.id)
      setRowErrors((prev) => {
        const next = { ...prev }
        delete next[item.id]
        return next
      })
      try {
        const payload: PluginTradeSearchItem = equippedToTradeSearch(item, {
          similarItems,
          selectedMods,
        })
        const result = await ctx.trade.openSearch(payload)
        if (result.unmatchedMods && result.unmatchedMods.length > 0 && (result.matchedStats ?? 0) > 0) {
          // Soft notice: some checked lines were skipped, but search still has filters.
          setRowErrors((prev) => ({
            ...prev,
            [item.id]: `Applied ${result.matchedStats} filter(s). Skipped: ${result.unmatchedMods!.slice(0, 2).join(' · ')}`,
          }))
        }
        ctx.openExternal(result.url)
      } catch (e) {
        setRowErrors((prev) => ({
          ...prev,
          [item.id]: e instanceof Error ? e.message : 'Trade search failed',
        }))
      } finally {
        setSearchingId(null)
      }
    },
    [ctx, selectedByItem, similarItems],
  )

  const priceBuildViaTrade = useCallback(async () => {
    if (!ctx.trade?.priceCheck) {
      setError('Trade price-check unavailable — reinstall Scalpel from this repo (needs host update).')
      return
    }
    const targets = gear.filter(needsTradePriceCheck)
    if (targets.length === 0) {
      setPricingStatus('Nothing to trade-price (no rares / spirit-variant uniques).')
      return
    }
    setPricing(true)
    setError(null)
    setBuildValueOpen(true)
    const next: Record<string, { divine: number | null; note: string | null }> = { ...tradeOverrides }
    try {
      for (let i = 0; i < targets.length; i++) {
        const item = targets[i]!
        setPricingStatus(`Pricing ${item.slotLabel}: ${item.name} (${i + 1}/${targets.length})…`)
        const selectedIds = selectedByItem[item.id] ?? new Set<string>()
        const selectedMods = item.mods.filter((m) => selectedIds.has(m.id))
        try {
          const payload = priceCheckSearchPayload(
            item,
            item.rarity === 'Unique' ? undefined : selectedMods.length > 0 ? selectedMods : undefined,
            similarItems,
          )
          if (item.rarity !== 'Unique' && (payload.statPriority?.length ?? 0) === 0) {
            next[item.id] = { divine: null, note: 'check mods first' }
            continue
          }
          const result = await ctx.trade.priceCheck(payload)
          if (result.estimateDivine != null) {
            const cheap =
              result.cheapestDivine != null && result.cheapestDivine !== result.estimateDivine
                ? ` (cheapest ${formatPrice(result.cheapestDivine)})`
                : ''
            next[item.id] = {
              divine: result.estimateDivine,
              note: `trade ~${formatPrice(result.estimateDivine)} div${cheap}`,
            }
          } else {
            next[item.id] = {
              divine: null,
              note: result.total > 0 ? 'listings unpriced' : 'no trade listings',
            }
          }
        } catch (e) {
          next[item.id] = {
            divine: null,
            note: e instanceof Error ? e.message.slice(0, 80) : 'trade failed',
          }
        }
        setTradeOverrides({ ...next })
      }
      setPricingStatus(`Done — priced ${targets.length} item(s) via trade.`)
    } finally {
      setPricing(false)
    }
  }, [ctx, gear, selectedByItem, similarItems, tradeOverrides])

  const d = mapped?.defenses

  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        background: COLORS.bg,
        color: COLORS.text,
        padding: 16,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Skill DPS</div>
        <div style={{ color: COLORS.muted, fontSize: 12 }}>
          poe.ninja PoB sim numbers + market upgrade search for equipped gear.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>poe.ninja character URL</div>
          <TextInput
            fullWidth
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={DEFAULT_URL}
          />
        </div>
        <Button onClick={() => void load()} disabled={loading || !parsed}>
          {loading ? 'Loading…' : 'Load'}
        </Button>
      </div>

      {error ? <ErrorBanner message={error} inline /> : null}

      {d ? (
        <div
          style={{
            background: COLORS.panel,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            padding: 12,
            marginBottom: 14,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
              <IconThumb src={d.classIconUrl} alt={d.className ?? 'class'} size={56} radius={6} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {d.name ?? '—'}
                  {d.level != null ? ` · L${d.level}` : ''}
                  {d.className ? ` ${d.className}` : ''}
                </div>
                <div style={{ color: COLORS.muted, fontSize: 12 }}>
                  {d.account ?? '—'} · {d.league ?? '—'}
                  {modelVersion != null ? ` · model ${modelVersion}` : ''}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const ref = parseNinjaCharacterUrl(url)
                if (ref) ctx.openExternal(profileUrl(ref))
              }}
              style={{
                all: 'unset',
                cursor: 'pointer',
                color: COLORS.accent,
                fontSize: 12,
                alignSelf: 'flex-start',
              }}
            >
              Open on poe.ninja
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 8,
              marginTop: 10,
              fontSize: 12,
            }}
          >
            <Stat label="Life" value={d.life} />
            <Stat label="Energy Shield" value={d.energyShield} />
            <Stat label="Mana" value={d.mana} />
            <Stat label="Spirit" value={d.spirit} />
          </div>
        </div>
      ) : null}

      {gear.length > 0 ? (
        <div
          style={{
            background: COLORS.panel,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            padding: 12,
            marginBottom: 14,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setBuildValueOpen((o) => !o)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                textAlign: 'left',
                color: COLORS.text,
                flex: 1,
                minWidth: 160,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.muted }}>
                {buildValueOpen ? '▼' : '▶'} Build value
              </div>
              <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
                Uniques from ninja. Rares + spirit charms (Owl etc.) via live trade mins.
              </div>
            </button>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.accent, fontVariantNumeric: 'tabular-nums' }}>
                  {buildValue.pricedCount > 0 ? `~${formatPrice(buildValue.totalDivine)} div` : '—'}
                </div>
                <div style={{ fontSize: 11, color: COLORS.muted }}>
                  {buildValue.pricedCount} priced
                  {buildValue.unpricedCount > 0 ? ` · ${buildValue.unpricedCount} unpriced` : ''}
                </div>
              </div>
              <Button onClick={() => void priceBuildViaTrade()} disabled={pricing}>
                {pricing ? 'Pricing…' : 'Price via trade'}
              </Button>
            </div>
          </div>
          {pricingStatus ? (
            <div style={{ marginTop: 8, fontSize: 11, color: COLORS.muted }}>{pricingStatus}</div>
          ) : null}
          {buildValueOpen ? (
            <div style={{ marginTop: 10, fontSize: 12 }}>
              {buildValue.rows.map((row) => (
                <div
                  key={row.item.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '88px 1fr auto',
                    gap: 8,
                    padding: '4px 0',
                    borderBottom: `1px solid ${COLORS.border}`,
                    alignItems: 'baseline',
                  }}
                >
                  <span style={{ color: COLORS.muted }}>{row.item.slotLabel}</span>
                  <span style={{ color: rarityColor(row.item.rarity), overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.item.name}
                  </span>
                  <span
                    style={{
                      fontVariantNumeric: 'tabular-nums',
                      color: row.divine != null ? COLORS.text : COLORS.muted,
                      textAlign: 'right',
                      maxWidth: 160,
                    }}
                    title={row.note ?? undefined}
                  >
                    {row.divine != null ? `~${formatPrice(row.divine)} div` : row.note ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {mapped ? (
        <div
          style={{
            background: COLORS.panel,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            padding: '4px 14px 10px',
            marginBottom: 14,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, padding: '10px 0 4px', color: COLORS.muted }}>
            Skill DPS Estimation
          </div>
          {mapped.skills.length === 0 ? (
            <div style={{ color: COLORS.muted, padding: '12px 0' }}>No skills with DPS on this profile.</div>
          ) : (
            mapped.skills.map((s) => <SkillRow key={s.name} skill={s} />)
          )}

          {passives.length > 0 ? (
            <div style={{ marginTop: 8, borderTop: `1px solid ${COLORS.border}`, paddingTop: 4 }}>
              <button
                type="button"
                onClick={() => setPassivesOpen((o) => !o)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '8px 0 6px',
                  cursor: 'pointer',
                  color: COLORS.muted,
                  fontSize: 13,
                  fontWeight: 600,
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                {passivesOpen ? '▼' : '▶'} Ascendancy &amp; Keystones
                <span style={{ fontWeight: 400, marginLeft: 8, color: COLORS.muted }}>
                  ({passives.length})
                </span>
              </button>
              {passivesOpen ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: 10,
                    paddingBottom: 8,
                  }}
                >
                  {passives.map((p) => (
                    <PassiveCard key={p.id} node={p} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {gear.length > 0 ? (
        <div
          style={{
            background: COLORS.panel,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            padding: '4px 14px 12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'baseline',
              padding: '10px 0 6px',
            }}
          >
            <button
              type="button"
              onClick={() => setUpgradesOpen((o) => !o)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                textAlign: 'left',
                color: COLORS.text,
                flex: 1,
                minWidth: 160,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.muted }}>
                {upgradesOpen ? '▼' : '▶'} Find upgrades
              </div>
              <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
                Check mods to use as minimums. Trade opens in Scalpel (log into PoE in Scalpel Settings first if
                Cloudflare loops).
              </div>
            </button>
          </div>

          {upgradesOpen ? (
            <>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginBottom: 8,
                  fontSize: 12,
                  color: COLORS.muted,
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={similarItems}
                    onChange={(e) => setSimilarItems(e.target.checked)}
                  />
                  Any base in slot (still uses checked mods)
                </label>
              </div>

              {gear.map((item) => (
                <GearRow
                  key={item.id}
                  item={item}
                  selectedModIds={selectedByItem[item.id] ?? new Set()}
                  onToggleMod={(modId, checked) => toggleMod(item.id, modId, checked)}
                  onFind={() => void findUpgrades(item)}
                  busy={searchingId === item.id}
                  error={rowErrors[item.id] ?? null}
                />
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function PassiveCard({ node }: { node: PassiveNodeCard }) {
  return (
    <div
      style={{
        background: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 6,
        padding: 10,
        minHeight: 72,
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <IconThumb src={node.iconUrl} alt={node.name} size={28} referrerPolicy="origin" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 12, color: COLORS.text }}>{node.name}</div>
          <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 1 }}>
            {node.kind === 'ascendancy' ? `${node.ascendancyName ?? 'Ascendancy'}` : 'Keystone'}
          </div>
        </div>
      </div>
      {node.stats.length > 0 ? (
        <div style={{ marginTop: 8, fontSize: 11, color: COLORS.muted, lineHeight: 1.4 }}>
          {node.stats.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div style={{ color: COLORS.muted }}>{label}</div>
      <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {value == null ? '—' : value.toLocaleString()}
      </div>
    </div>
  )
}

function IconThumb({
  src,
  alt,
  size,
  radius = 4,
  referrerPolicy = 'no-referrer',
}: {
  src: string | null
  alt: string
  size: number
  radius?: number
  /** Passive icons on poe2db need a referrer; default stays no-referrer for ninja/CDN item art. */
  referrerPolicy?: ImgHTMLAttributes<HTMLImageElement>['referrerPolicy']
}) {
  if (!src) {
    return (
      <div
        aria-hidden
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          background: COLORS.bg,
          border: `1px solid ${COLORS.border}`,
          flexShrink: 0,
        }}
      />
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy={referrerPolicy}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        borderRadius: radius,
        background: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        flexShrink: 0,
      }}
    />
  )
}

import { useEffect, useMemo, useState } from 'react'
import dustIcon from '../../assets/currency/thaumaturgic-dust.png'
import { iconFor } from '../../shared/constants'
import { CurrencyIcon } from '../../shared/CurrencyIcon'
import { SortHeader } from './SortHeader'
import type { ActiveFilter, FilterType, SortDir, SortKey, UniqueTierEntry } from './types'
import {
  ALL_FILTER_TYPES,
  cachedBaseEntries,
  COL_DUST,
  COL_PRICE,
  COL_TIER,
  dropTierFor,
  persistedState,
  TIER_ORDER,
} from './constants'
import { scaleRange } from './utils'
import { defaultFilter, EmptyFilterRow, FilterRow } from './FilterRow'
import { UniqueTierEntryRow } from './UniqueTierEntryRow'

function sanitizePersistedFilters(filters: ActiveFilter[]): ActiveFilter[] {
  const valid = new Set<string>(TIER_ORDER)
  return filters
    .filter((f) => ALL_FILTER_TYPES.includes(f.type))
    .map((f) => (f.type === 'tier' ? { ...f, tiers: f.tiers.filter((t) => valid.has(t)) } : f))
    .filter((f) => f.type !== 'tier' || f.tiers.length > 0)
}

export function UniqueTiersExplorer({
  onSelectItem,
  onPriceCheckItem,
}: {
  onSelectItem?: () => void
  onPriceCheckItem?: () => void
} = {}): JSX.Element {
  const [sortKey, setSortKey] = useState<SortKey>(
    persistedState.sortKey === 'name' ||
      persistedState.sortKey === 'chaosValue' ||
      persistedState.sortKey === 'dustIlvl84' ||
      persistedState.sortKey === 'tier'
      ? persistedState.sortKey
      : 'tier',
  )
  const [sortDir, setSortDir] = useState<SortDir>(persistedState.sortDir)
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [divineRate, setDivineRate] = useState(0)
  const [mirrorRate, setMirrorRate] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filters, setFiltersState] = useState<ActiveFilter[]>(() => sanitizePersistedFilters(persistedState.filters))
  const [visibility, setVisibility] = useState<Record<string, 'Show' | 'Hide'>>({})
  const [filterVersion, setFilterVersion] = useState(0)
  /** Bumps when main harvests new icons so rows re-resolve via iconFor. */
  const [iconTick, setIconTick] = useState(0)

  const setFilters = (fn: ActiveFilter[] | ((prev: ActiveFilter[]) => ActiveFilter[])) => {
    setFiltersState((prev) => {
      const next = typeof fn === 'function' ? fn(prev) : fn
      persistedState.filters = next
      return next
    })
  }

  const baseEntries = cachedBaseEntries

  useEffect(() => {
    let cancelled = false
    const fetchPrices = async (attempt = 0): Promise<void> => {
      try {
        const settings = await window.api.getSettings()
        const result: Record<string, number> = {}
        const names = baseEntries.map((e) => e.name)
        const chunkSize = 200
        for (let i = 0; i < names.length; i += chunkSize) {
          const chunk = names.slice(i, i + chunkSize)
          const p = await window.api.batchLookupPrices(chunk, settings.activeProfile?.league ?? '')
          for (const [name, info] of Object.entries(p)) {
            if (info?.chaosValue) result[name] = info.chaosValue
          }
        }
        if (cancelled) return
        if (Object.keys(result).length === 0 && attempt < 3) {
          await new Promise((r) => setTimeout(r, 2000))
          if (!cancelled) return fetchPrices(attempt + 1)
          return
        }
        setPrices(result)
        const currPrices = await window.api.batchLookupPrices(
          ['Divine Orb', 'Mirror of Kalandra'],
          settings.activeProfile?.league ?? '',
        )
        const divPrice = currPrices['Divine Orb']?.chaosValue ?? 0
        const mirPrice = currPrices['Mirror of Kalandra']?.chaosValue ?? 0
        if (divPrice > 0) setDivineRate(divPrice)
        if (mirPrice > 0) setMirrorRate(mirPrice)
      } catch {
        if (!cancelled && attempt < 3) {
          await new Promise((r) => setTimeout(r, 2000))
          if (!cancelled) return fetchPrices(attempt + 1)
          return
        }
      }
      setLoading(false)
    }
    void fetchPrices()
    return () => {
      cancelled = true
    }
  }, [baseEntries])

  useEffect(() => window.api.onFilterChanged(() => setFilterVersion((v) => v + 1)), [])
  useEffect(() => window.api.onIconCacheUpdated(() => setIconTick((t) => t + 1)), [])

  useEffect(() => {
    let cancelled = false
    window.api
      .getUniqueVisibility()
      .then((v) => {
        if (!cancelled) setVisibility(v)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [filterVersion])

  const entries: UniqueTierEntry[] = useMemo(() => {
    void iconTick
    return baseEntries.map((e) => {
      const chaos = prices[e.name] ?? null
      return {
        ...e,
        iconUrl: iconFor(e.name, e.baseType) ?? null,
        chaosValue: chaos,
        divineValue: chaos != null && divineRate > 0 ? chaos / divineRate : null,
        tier: dropTierFor(e.name),
      }
    })
  }, [baseEntries, prices, divineRate, iconTick])

  /** List is driven by drop-weight tiers; prices are optional display data. */
  const listed = useMemo(() => entries.filter((e) => e.tier != null), [entries])

  const maxValues = useMemo(
    () => ({
      chaosValue: Math.max(...listed.map((e) => e.chaosValue ?? 0), 1),
      dustIlvl84: Math.max(...listed.map((e) => e.dustIlvl84 ?? 0), 1),
    }),
    [listed],
  )

  const minValues = useMemo(
    () => ({
      chaosValue: 0,
      dustIlvl84: listed.some((e) => e.dustIlvl84 != null)
        ? Math.min(...listed.filter((e) => e.dustIlvl84 != null).map((e) => e.dustIlvl84!))
        : 0,
    }),
    [listed],
  )

  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(TIER_ORDER.map((t) => [t, 0]))
    for (const e of listed) {
      if (e.tier) counts[e.tier]++
    }
    return counts
  }, [listed])

  const filtered = useMemo(() => {
    let result = listed
    for (const f of filters) {
      if (f.type === 'name') {
        const lower = f.value.toLowerCase()
        if (lower)
          result = result.filter(
            (e) => e.name.toLowerCase().includes(lower) || e.baseType.toLowerCase().includes(lower),
          )
      } else if (f.type === 'tier') {
        if (f.tiers.length > 0 && f.tiers.length < TIER_ORDER.length) {
          const allow = new Set(f.tiers)
          result = result.filter((e) => e.tier != null && allow.has(e.tier))
        }
      } else {
        const mn = minValues[f.type]
        const mx = maxValues[f.type]
        const minVal = scaleRange(f.min, mn, mx, f.type)
        const maxVal = scaleRange(f.max, mn, mx, f.type)
        result = result.filter((e) => {
          const v = e[f.type]
          if (v === null || typeof v !== 'number') return false
          return v >= minVal && v <= maxVal
        })
      }
    }
    return result
  }, [listed, filters, maxValues, minValues])

  const sorted = useMemo(() => {
    const copy = [...filtered]
    const tierRank: Record<string, number> = {
      TF: 0,
      T0: 1,
      T1: 2,
      T2: 3,
      T3: 4,
      T4: 5,
      T5: 6,
    }
    copy.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortKey === 'tier') cmp = (tierRank[a.tier!] ?? 99) - (tierRank[b.tier!] ?? 99)
      else {
        const av = a[sortKey] ?? -Infinity
        const bv = b[sortKey] ?? -Infinity
        cmp = (av as number) - (bv as number)
      }
      return sortDir === 'desc' ? -cmp : cmp
    })
    return copy
  }, [filtered, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      const next = sortDir === 'desc' ? 'asc' : 'desc'
      setSortDir(next)
      persistedState.sortDir = next
    } else {
      setSortKey(key)
      setSortDir('desc')
      persistedState.sortKey = key
      persistedState.sortDir = 'desc'
    }
  }

  const updateFilter = (idx: number, updates: Partial<ActiveFilter>) => {
    setFilters((prev) => prev.map((f, i) => (i === idx ? { ...f, ...updates } : f)))
  }

  const removeFilter = (idx: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== idx))
  }

  const changeFilterType = (idx: number, newType: FilterType) => {
    setFilters((prev) => prev.map((f, i) => (i === idx ? defaultFilter(newType) : f)))
  }

  const addFilterRow = () => {
    const used = new Set(filters.map((f) => f.type))
    const next = ALL_FILTER_TYPES.find((t) => !used.has(t))
    if (next) setFilters((prev) => [...prev, defaultFilter(next)])
  }

  const availableTypesFor = (currentType: FilterType) => {
    const used = new Set(filters.map((f) => f.type))
    return ALL_FILTER_TYPES.filter((t) => t === currentType || !used.has(t))
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="bg-bg-card px-3 py-[10px] flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="section-title">Unique Tiers</span>
          <span className="text-[10px] text-text-dim">{loading ? 'Fetching prices...' : `${sorted.length} items`}</span>
        </div>
        <p className="text-[10px] text-text-dim leading-snug m-0">
          Drop-weight tiers (T0–T5) from the wiki unique-tier analysis — not filter tags or divine prices.
        </p>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px]">
          {TIER_ORDER.map((t) => (
            <span key={t} className="text-text-dim">
              <span className="font-bold" style={{ color: 'var(--accent)' }}>
                {t}
              </span>{' '}
              {tierCounts[t] ?? 0}
            </span>
          ))}
        </div>

        {filters.length === 0 && <EmptyFilterRow onAdd={(t) => setFilters([defaultFilter(t)])} />}

        {filters.map((f, idx) => (
          <FilterRow
            key={`${f.type}-${idx}`}
            filter={f}
            idx={idx}
            availableTypes={availableTypesFor(f.type)}
            minValues={minValues}
            maxValues={maxValues}
            divineRate={divineRate}
            mirrorRate={mirrorRate}
            onTypeChange={changeFilterType}
            onUpdate={updateFilter}
            onRemove={removeFilter}
          />
        ))}

        {filters.length > 0 && filters.length < ALL_FILTER_TYPES.length && (
          <button onClick={addFilterRow} className="self-start px-3 py-1 text-[11px]">
            + Add another filter
          </button>
        )}
      </div>

      <div className="flex items-center gap-[6px] px-3 py-1 bg-bg-card border-b border-border">
        <div className="w-[22px] shrink-0" />
        <SortHeader label="Unique" sortKey="name" active={sortKey} dir={sortDir} onSort={handleSort} flex />
        <SortHeader label="Tier" sortKey="tier" active={sortKey} dir={sortDir} onSort={handleSort} width={COL_TIER} />
        <SortHeader
          label={<CurrencyIcon name="chaos" className="w-[10px] h-[10px]" />}
          sortKey="chaosValue"
          active={sortKey}
          dir={sortDir}
          onSort={handleSort}
          width={COL_PRICE}
        />
        <SortHeader
          label={<img src={dustIcon} alt="" className="w-[10px] h-[10px]" />}
          sortKey="dustIlvl84"
          active={sortKey}
          dir={sortDir}
          onSort={handleSort}
          width={COL_DUST}
        />
      </div>

      <div className="flex-1 overflow-y-auto bg-bg-solid">
        {sorted.map((entry, i) => (
          <UniqueTierEntryRow
            key={entry.name}
            entry={entry}
            index={i}
            divineRate={divineRate}
            mirrorRate={mirrorRate}
            onSelectItem={onSelectItem}
            onPriceCheckItem={onPriceCheckItem}
            visibility={visibility[entry.name]}
          />
        ))}
      </div>

      <style>{`
        .range-thumb::-webkit-slider-thumb {
          pointer-events: auto !important;
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--accent);
          border: none;
          cursor: pointer;
        }
      `}</style>
    </div>
  )
}

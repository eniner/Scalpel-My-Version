import type { ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { useMemo, useState } from 'react'
import { categoriesWithData, categoryLabel } from './economy-categories'
import { agoText, entryMatchesQuery, groupEntriesByCategory, normSearch } from './economy-prices'
import { EconomyRow } from './EconomyRow'
import { useEconomyPrices, useStoredCategory } from './use-economy-prices'

interface EconomyPanelProps {
  ctx: ScalpelPluginContext
  compact?: boolean
}

export function EconomyPanel({ ctx, compact = false }: EconomyPanelProps): JSX.Element {
  const { entries, updatedAt, loading, error, refresh, poeVersion } = useEconomyPrices(ctx)
  const byCat = useMemo(() => groupEntriesByCategory(entries), [entries])
  const categories = useMemo(() => categoriesWithData(poeVersion, byCat.keys()), [poeVersion, byCat])
  const validSlugs = useMemo(() => new Set(categories.map((c) => c.slug)), [categories])
  const [selectedSlug, setSelectedSlug] = useStoredCategory(ctx, validSlugs)
  const [query, setQuery] = useState('')
  const league = ctx.getLeague() || (poeVersion === 1 ? 'PoE1' : 'PoE2')

  const queryNorm = normSearch(query)

  const activeSlug = validSlugs.has(selectedSlug) ? selectedSlug : (categories[0]?.slug ?? 'currency')

  const rows = useMemo(() => {
    const list = byCat.get(activeSlug) ?? []
    return list.filter((e) => entryMatchesQuery(e, queryNorm))
  }, [byCat, queryNorm, activeSlug])

  return (
    <div
      className={`flex flex-col overflow-hidden bg-[#171821] text-[#e2e8f0] ${
        compact ? 'h-full rounded-none border-0' : 'h-full rounded-[22px] border border-[#38384d]/65 shadow-[0_8px_32px_rgba(0,0,0,0.75)]'
      }`}
      style={{ fontFamily: 'system-ui, sans-serif' }}
    >
      <div className="px-3 pt-3 pb-2 border-b border-white/10 shrink-0">
        <div className="font-bold text-[12px] text-[#c8a96e] mb-2">{league}</div>
        <style>{`
          .scalpel-economy-filter::placeholder { color: #6b7280; opacity: 1; }
          .scalpel-economy-filter::-webkit-input-placeholder { color: #6b7280; opacity: 1; }
        `}</style>
        <div className="flex flex-col gap-2">
          <select
            value={activeSlug}
            onChange={(e) => setSelectedSlug(e.target.value)}
            className="w-full bg-[#12131a] text-[#e2e8f0] border border-white/12 rounded-lg px-2 py-1.5 text-[11px]"
          >
            {categories.map((cat) => {
              const count = byCat.get(cat.slug)?.length ?? 0
              return (
                <option key={cat.slug} value={cat.slug}>
                  {cat.label} ({count})
                </option>
              )
            })}
          </select>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter items…"
            className="scalpel-economy-filter w-full rounded-lg px-2 py-1.5 text-[11px] border border-white/12"
            style={{
              backgroundColor: '#12131a',
              color: '#e2e8f0',
              colorScheme: 'dark',
              WebkitAppearance: 'none',
              appearance: 'none',
            }}
          />
        </div>
      </div>

      <div className="px-3 py-1.5 text-[10px] text-[#6b7280] border-b border-white/[0.06] shrink-0 flex items-center justify-between gap-2">
        <span>
          {categoryLabel(activeSlug, poeVersion)} · {rows.length} items ·{' '}
          {loading ? 'refreshing…' : agoText(updatedAt)}
        </span>
        {!compact && (
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="text-[10px] text-[#c8a96e] hover:text-[#ffd24a] disabled:opacity-50"
          >
            Refresh
          </button>
        )}
      </div>

      {error && (
        <div className="px-3 py-2 text-[11px] text-amber-200/90 border-b border-white/10 shrink-0">{error}</div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0">
        {rows.length === 0 ? (
          <div className="px-3 py-4 text-[11px] text-[#9e9480]">
            {queryNorm
              ? 'No items match your filter in this category.'
              : 'No prices in this category yet — try Refresh to update economy data.'}
          </div>
        ) : (
          rows.map((entry, i) => (
            <EconomyRow key={`${entry.name}-${i}`} entry={entry} zebra={i % 2 === 0} poeVersion={poeVersion} />
          ))
        )}
      </div>
    </div>
  )
}

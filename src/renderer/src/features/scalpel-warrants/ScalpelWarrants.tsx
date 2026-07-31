import { useCallback, useMemo, useState } from 'react'
import type { WarrantScanResult, WarrantSkillGroup } from '@shared/warrants'
import { getTradeUrls } from '@shared/endpoints'
import { zebraRowBg } from '../../shared/utils'

function formatChaos(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n >= 100) return `${Math.round(n)}c`
  if (n >= 10) return `${n.toFixed(1)}c`
  return `${n.toFixed(2)}c`
}

function SkillLinks({ group }: { group: WarrantSkillGroup }): JSX.Element {
  const skills = group.sample.skills
  if (skills.length === 0) {
    return <div className="text-[11px] text-text-dim">No skill data on listing</div>
  }
  return (
    <div className="space-y-1.5 py-1">
      {skills.map((skill) => (
        <div key={`${skill.hash}-${skill.name}`} className="flex items-start gap-2 text-[11px]">
          {skill.icon ? (
            <img src={skill.icon} alt="" className="w-5 h-5 object-contain shrink-0 mt-0.5" draggable={false} />
          ) : (
            <div className="w-5 h-5 shrink-0 mt-0.5 rounded bg-white/5" />
          )}
          <div className="min-w-0">
            <div className="text-text font-medium">{skill.name}</div>
            {skill.supports.length > 0 && (
              <div className="text-text-dim leading-snug">
                {skill.supports.map((s, i) => (
                  <span key={`${s.hash}-${i}`}>
                    {i > 0 ? ' → ' : ''}
                    <span className={s.tier != null && s.tier >= 3 ? 'text-amber-300' : undefined}>
                      {s.name}
                      {s.tier != null ? ` (T${s.tier})` : ''}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export function ScalpelWarrants(): JSX.Element {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<WarrantScanResult | null>(null)
  const [limit, setLimit] = useState(50)
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const scan = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await window.api.warrantsScan({ limit, onlineOnly, pricedOnly: true })
      setResult(next)
      setExpanded(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [limit, onlineOnly])

  const groups = useMemo(() => {
    if (!result) return []
    const q = filter.trim().toLowerCase()
    if (!q) return result.groups
    return result.groups.filter((g) => {
      const hay = `${g.build} ${g.sample.mercenaryName} ${g.fingerprint} ${g.skillKey}`.toLowerCase()
      return hay.includes(q)
    })
  }, [result, filter])

  const openTrade = useCallback(() => {
    if (!result?.queryId) return
    void window.api.openExternal(getTradeUrls(1).webSearch(result.league, result.queryId))
  }, [result])

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 p-3 text-xs overflow-hidden">
      <div className="shrink-0 space-y-1">
        <div className="text-[13px] font-semibold text-text">Scalpel Warrants</div>
        <p className="text-text-dim leading-snug">
          Live Mercenary Warrant market scan. Groups identical skill + support link packages and ranks
          them by ask price (chaos-equivalent via poe.ninja rates).
        </p>
      </div>

      <div className="shrink-0 flex flex-wrap items-center gap-2">
        <button type="button" className="primary text-[11px] px-3 py-1.5" disabled={loading} onClick={() => void scan()}>
          {loading ? 'Scanning trade…' : 'Scan trade'}
        </button>
        <label className="flex items-center gap-1 text-text-dim">
          Sample
          <select
            className="bg-black/40 border border-border rounded px-1.5 py-1"
            value={limit}
            disabled={loading}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-text-dim">
          <input
            type="checkbox"
            checked={onlineOnly}
            disabled={loading}
            onChange={(e) => setOnlineOnly(e.target.checked)}
          />
          Online only
        </label>
        {result?.queryId && (
          <button type="button" className="text-[11px] px-2 py-1 border border-border rounded" onClick={openTrade}>
            Open search
          </button>
        )}
        <input
          type="search"
          placeholder="Filter build / skill…"
          className="flex-1 min-w-[140px] bg-black/40 border border-border rounded px-2 py-1"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {error && <div className="shrink-0 text-red-400 text-[11px]">{error}</div>}

      {result && (
        <div className="shrink-0 text-[11px] text-text-dim">
          {result.league}: fetched {result.fetched} of {result.total.toLocaleString()} priced warrants ·{' '}
          {groups.length} unique skill packages
          {result.scannedAt ? ` · ${new Date(result.scannedAt).toLocaleTimeString()}` : ''}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto border border-border/60 rounded">
        {!result && !loading && (
          <div className="p-4 text-text-dim text-[11px]">
            Hit Scan trade to pull live Mercenary Warrant listings. Rankings use median chaos value of
            identical skill-link fingerprints.
          </div>
        )}
        {loading && <div className="p-4 text-text-dim text-[11px]">Fetching warrants (rate-limited)…</div>}
        {result && !loading && groups.length === 0 && (
          <div className="p-4 text-text-dim text-[11px]">No packages match this filter.</div>
        )}
        {result && !loading && groups.length > 0 && (
          <div>
            {groups.map((g, i) => {
              const open = expanded === g.fingerprint
              return (
                <div key={g.fingerprint} className="border-b border-border/40" style={{ background: zebraRowBg(i) }}>
                  <button
                    type="button"
                    className="w-full text-left px-2 py-1.5 grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_auto_auto_auto] gap-2 items-start"
                    onClick={() => setExpanded(open ? null : g.fingerprint)}
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-text truncate">{g.build}</div>
                      <div className="text-text-dim truncate">{g.sample.mercenaryName}</div>
                    </div>
                    <div className="text-text-dim line-clamp-2">{g.skillKey || '—'}</div>
                    <div className="tabular-nums text-right">{g.count}</div>
                    <div className="tabular-nums text-right text-accent font-medium">{formatChaos(g.medianChaos)}</div>
                    <div className="tabular-nums text-right text-text-dim">
                      {formatChaos(g.minChaos)}–{formatChaos(g.maxChaos)}
                    </div>
                  </button>
                  {open && (
                    <div className="px-2 pb-2 space-y-1">
                      <SkillLinks group={g} />
                      <div className="text-[10px] text-text-dim">
                        {g.sample.level != null ? `lvl ${g.sample.level} · ` : ''}
                        {g.sample.priceAmount != null && g.sample.priceCurrency
                          ? `sample ask ${g.sample.priceAmount} ${g.sample.priceCurrency}`
                          : 'unpriced sample'}
                        {g.sample.account ? ` · ${g.sample.account}` : ''}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

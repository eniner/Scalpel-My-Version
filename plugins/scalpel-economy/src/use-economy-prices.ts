import type { PriceEntry, ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { useCallback, useEffect, useState } from 'react'
import { economySlugsFor } from './economy-categories'

export interface EconomyData {
  entries: PriceEntry[]
  updatedAt: number | null
  loading: boolean
  error: string | null
  poeVersion: 1 | 2
}

export function useEconomyPrices(ctx: ScalpelPluginContext): EconomyData & { refresh: () => Promise<void> } {
  const poeVersion = ctx.getPoeVersion() === 1 ? 1 : 2
  const [entries, setEntries] = useState<PriceEntry[]>([])
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const { prices, updatedAt: ts } = await ctx.prices.getPrices()
      const slugs = economySlugsFor(poeVersion)
      setEntries(prices.filter((p) => slugs.has(p.category || 'currency')))
      setUpdatedAt(ts)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [ctx, poeVersion])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      await ctx.prices.refresh()
    } catch (e) {
      ctx.log(`scalpel-economy: refresh failed (${e instanceof Error ? e.message : String(e)})`)
    }
    await load()
  }, [ctx, load])

  useEffect(() => {
    void load()
    const off = ctx.prices.onChange(() => {
      void load()
    })
    return off
  }, [ctx, load])

  return { entries, updatedAt, loading, error, refresh, poeVersion }
}

export function useStoredCategory(
  ctx: ScalpelPluginContext,
  validSlugs: Set<string>,
): [string, (slug: string) => void] {
  const storageKey = `economySlug:poe${ctx.getPoeVersion() === 1 ? 1 : 2}`
  const [slug, setSlugState] = useState('currency')

  useEffect(() => {
    void (async () => {
      const saved = await ctx.storage.get<string>(storageKey)
      if (saved && validSlugs.has(saved)) setSlugState(saved)
      else if (!validSlugs.has('currency') && validSlugs.size > 0) {
        setSlugState([...validSlugs][0]!)
      } else {
        setSlugState('currency')
      }
    })()
  }, [ctx, storageKey, validSlugs])

  const setSlug = useCallback(
    (next: string) => {
      setSlugState(next)
      void ctx.storage.set(storageKey, next)
    },
    [ctx, storageKey],
  )

  return [slug, setSlug]
}

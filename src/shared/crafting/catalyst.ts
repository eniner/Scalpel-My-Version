import type { CraftCatalystEntry, CraftDataset, CraftItemState, CraftMod } from './types'

export function resolveCatalyst(data: CraftDataset, key: string | undefined): CraftCatalystEntry | undefined {
  if (!key?.trim() || !data.catalysts?.length) return undefined
  const q = key.trim().toLowerCase()
  return data.catalysts.find((c) => c.id === key || c.name.toLowerCase() === q)
}

export function catalystMatchesMod(mod: CraftMod, catalystTags: string[]): boolean {
  if (!catalystTags.length || !mod.a?.length) return false
  const tags = new Set(mod.a.map((t) => t.toLowerCase()))
  return catalystTags.some((t) => tags.has(t.toLowerCase()))
}

/** PoE-style: each 1% quality → +1% weight on matching tags. */
export function applyCatalystWeights(
  pool: Array<CraftMod & { weight: number }>,
  catalyst: CraftCatalystEntry | undefined,
  quality: number,
): Array<CraftMod & { weight: number }> {
  if (!catalyst?.tags.length || quality <= 0) return pool
  const mult = 1 + quality / 100
  return pool.map((m) =>
    catalystMatchesMod(m, catalyst.tags) ? { ...m, weight: m.weight * mult } : m,
  )
}

export function catalystFromState(
  data: CraftDataset,
  state: CraftItemState,
): { catalyst?: CraftCatalystEntry; quality: number } {
  const quality = Math.min(100, Math.max(0, state.quality ?? 20))
  const catalyst = resolveCatalyst(data, state.catalyst)
  return { catalyst, quality }
}

export function withCatalystWeights(
  data: CraftDataset,
  state: CraftItemState,
  pool: Array<CraftMod & { weight: number }>,
): Array<CraftMod & { weight: number }> {
  const { catalyst, quality } = catalystFromState(data, state)
  return applyCatalystWeights(pool, catalyst, quality)
}

import { getBaseTags } from './pool'
import { spawnWeight } from './weights'
import type { CraftDataset, CraftMod, GenKind } from './types'
import type { ModPoolSource } from './mod-pool'

export type ModPoolTag = 'craft' | 'marksman' | 'desecrated'

export interface ModSearchHit {
  baseType: string
  itemClass: string
  modId: string
  group: string
  kind: GenKind
  tierName: string
  text: string
  ilvl: number
  spawnWeight: number
  pool: ModPoolTag
}

export interface ModSearchQuery {
  query: string
  itemLevel?: number
  poolSource?: ModPoolSource
  itemClass?: string
  kind?: 'all' | 'p' | 's'
  limit?: number
}

function poolTagFor(mod: CraftMod): ModPoolTag {
  if (mod.pool === 'marksman') return 'marksman'
  if (mod.desecrated) return 'desecrated'
  return 'craft'
}

function modListsForSource(
  data: CraftDataset,
  poolSource: ModPoolSource,
): Array<{ mods: CraftMod[]; pool: ModPoolTag }> {
  const out: Array<{ mods: CraftMod[]; pool: ModPoolTag }> = []
  const includeCraft = poolSource === 'craft' || poolSource === 'all'
  const includeMarksman = poolSource === 'marksman' || poolSource === 'all'
  const includeDesecrated = poolSource === 'desecrated' || poolSource === 'all'

  if (includeCraft) {
    out.push({
      mods: data.mods.filter((m) => !m.desecrated && m.pool !== 'marksman'),
      pool: 'craft',
    })
  }
  if (includeDesecrated) {
    out.push({ mods: data.mods.filter((m) => m.desecrated), pool: 'desecrated' })
  }
  if (includeMarksman && data.marksmanMods?.length) {
    out.push({ mods: data.marksmanMods, pool: 'marksman' })
  }
  return out
}

function modMatchesQuery(mod: CraftMod, q: string): boolean {
  const hay = `${mod.g} ${mod.n} ${mod.t}`.toLowerCase()
  return hay.includes(q)
}

type TagIndex = {
  byTag: Map<string, string[]>
  baseNames: Set<string>
}

const tagIndexCache = new WeakMap<CraftDataset, TagIndex>()

function tagIndexFor(data: CraftDataset): TagIndex {
  let cached = tagIndexCache.get(data)
  if (cached) return cached
  const byTag = new Map<string, string[]>()
  const baseNames = new Set<string>()
  for (const [name, base] of Object.entries(data.bases)) {
    baseNames.add(name)
    for (const tag of base.tags) {
      if (!byTag.has(tag)) byTag.set(tag, [])
      byTag.get(tag)!.push(name)
    }
  }
  cached = { byTag, baseNames }
  tagIndexCache.set(data, cached)
  return cached
}

function basesForWeightTag(data: CraftDataset, tag: string, index: TagIndex): string[] {
  if (index.baseNames.has(tag)) return [tag]
  return index.byTag.get(tag) ?? []
}

/** Find mod tiers matching text across all CoE bases (cheat sheet global lookup). */
export function searchModTiers(data: CraftDataset, query: ModSearchQuery): ModSearchHit[] {
  const q = query.query.trim().toLowerCase()
  if (q.length < 2) return []

  const ilvl = Math.max(1, query.itemLevel ?? 100)
  const limit = query.limit ?? 400
  const poolSource = query.poolSource ?? 'all'
  const kind = query.kind ?? 'all'
  const index = tagIndexFor(data)
  const hits: ModSearchHit[] = []
  const seen = new Set<string>()

  for (const { mods, pool } of modListsForSource(data, poolSource)) {
    for (const mod of mods) {
      if (mod.l > ilvl) continue
      if (kind === 'p' && mod.k !== 'p') continue
      if (kind === 's' && mod.k !== 's') continue
      if (!modMatchesQuery(mod, q)) continue

      const bases = new Set<string>()
      for (const [tag] of mod.w) {
        for (const baseType of basesForWeightTag(data, tag, index)) {
          bases.add(baseType)
        }
      }

      for (const baseType of bases) {
        const base = data.bases[baseType]
        if (!base) continue
        if (query.itemClass && base.c !== query.itemClass) continue
        const tags = getBaseTags(data, baseType)
        if (!tags) continue
        const tagSet = new Set(tags)
        if (pool === 'marksman') tagSet.add('can_roll_marksman')
        const weight = spawnWeight(mod, tagSet, baseType)
        if (weight <= 0) continue
        const key = `${baseType}:${mod.id}`
        if (seen.has(key)) continue
        seen.add(key)
        hits.push({
          baseType,
          itemClass: base.c,
          modId: mod.id,
          group: mod.g,
          kind: mod.k,
          tierName: mod.n,
          text: mod.t || mod.n || mod.g,
          ilvl: mod.l,
          spawnWeight: weight,
          pool,
        })
        if (hits.length >= limit) return sortModSearchHits(hits)
      }
    }
  }

  return sortModSearchHits(hits)
}

function sortModSearchHits(hits: ModSearchHit[]): ModSearchHit[] {
  return hits.sort(
    (a, b) =>
      a.text.localeCompare(b.text) ||
      a.baseType.localeCompare(b.baseType) ||
      b.spawnWeight - a.spawnWeight,
  )
}

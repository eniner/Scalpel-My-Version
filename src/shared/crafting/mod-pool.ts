import { allEligibleForExalt, getBaseTags, itemStateFromPoeItem, MARKSMAN_TAG } from './pool'
import { groupedOutcomesToFlat, poolToGroups, poolToSections } from './group-pool'
import type { ModGroupOutcome, ModPoolSection } from './group-pool'
import { spawnWeight } from './weights'
import type { CraftCatalystEntry, CraftDataset, CraftMod, CraftOutcome, GenKind } from './types'
import type { PoeItem } from '../contracts/items'

export type { ModGroupOutcome, ModPoolSection, ModTierOutcome } from './group-pool'

/** Which mod tables to include in the cheat sheet lookup. */
export type ModPoolSource = 'craft' | 'marksman' | 'desecrated' | 'all'

export interface ModPoolEssenceHit {
  id: string
  name: string
  kind: GenKind
  text: string
  modName: string
  minIlvl: number
  group: string
}

export interface ModPoolQuery {
  baseType: string
  itemLevel: number
  kind?: 'all' | 'p' | 's'
  /** When provided, weights reflect tags/groups from this item (exalt-style). */
  item?: PoeItem | null
  /** `fresh` = base tags only; `item` = include current mod tags/groups (exalt pool). */
  context?: 'fresh' | 'item'
  /** Which mod table(s) to show. Default `craft`. */
  poolSource?: ModPoolSource
  /** Include marksman rune pool alongside craft pool (belt/quiver implicit). */
  marksmanEnabled?: boolean
  /** Greater/Perfect orb tier floor (hide tiers below this ilvl). */
  tierFloor?: number
  /** Catalyst name or id — boosts matching affix-tag weights. */
  catalyst?: string
  /** Item quality for catalyst preview (default 20). */
  quality?: number
}

export interface ModPoolReport {
  baseType: string
  itemLevel: number
  kind: 'all' | 'p' | 's'
  context: 'fresh' | 'item'
  poolSource: ModPoolSource
  modCount: number
  groupCount: number
  totalWeight: number
  outcomes: CraftOutcome[]
  groups: ModGroupOutcome[]
  sections: ModPoolSection[]
  note: string
  /** Available catalysts from the CoE dataset (for cheat sheet UI). */
  catalysts?: CraftCatalystEntry[]
  /** CoE runes / soul cores / talismans. */
  socketables?: import('./types').CraftSocketableEntry[]
  /** Essences that force a mod on this base. */
  essencesForBase?: ModPoolEssenceHit[]
  catalystApplied?: { name: string; quality: number; tags: string[] } | null
  tierFloor?: number
}

function catalystMatchesMod(mod: CraftMod, catalystTags: string[]): boolean {
  if (!catalystTags.length || !mod.a?.length) return false
  const tags = new Set(mod.a.map((t) => t.toLowerCase()))
  return catalystTags.some((t) => tags.has(t.toLowerCase()))
}

/** PoE-style: each 1% quality → +1% weight on matching tags. */
function applyCatalystWeights(
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

function resolveCatalyst(data: CraftDataset, key: string | undefined): CraftCatalystEntry | undefined {
  if (!key?.trim() || !data.catalysts?.length) return undefined
  const q = key.trim().toLowerCase()
  return data.catalysts.find((c) => c.id === key || c.name.toLowerCase() === q)
}

function essencesForBase(data: CraftDataset, baseType: string): ModPoolEssenceHit[] {
  const out: ModPoolEssenceHit[] = []
  for (const e of data.essences ?? []) {
    const hit = e.bases?.[baseType]
    if (!hit) continue
    out.push({
      id: e.id,
      name: e.name,
      kind: hit.kind,
      text: hit.text,
      modName: hit.name,
      minIlvl: hit.minIlvl,
      group: hit.group,
    })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

function poolForBase(
  data: CraftDataset,
  baseType: string,
  ilvl: number,
  kinds: GenKind[],
  opts: {
    tags: Set<string>
    includeCraft: boolean
    includeMarksman: boolean
    includeDesecrated: boolean
    tierFloor?: number
  },
): Array<CraftMod & { weight: number }> {
  const out: Array<CraftMod & { weight: number }> = []
  const seen = new Set<string>()

  const tryPush = (mod: CraftMod) => {
    if (!kinds.includes(mod.k)) return
    if (mod.l > ilvl) return
    if (mod.l < (opts.tierFloor ?? 0)) return
    const weight = mod.pool === 'marksman' ? spawnWeight(mod, opts.tags) : spawnWeight(mod, opts.tags, baseType)
    if (weight <= 0 || seen.has(mod.id)) return
    seen.add(mod.id)
    out.push({ ...mod, weight })
  }

  if (opts.includeCraft) {
    for (const mod of data.mods) {
      if (mod.desecrated || mod.pool === 'marksman') continue
      tryPush(mod)
    }
  }

  if (opts.includeDesecrated) {
    for (const mod of data.mods) {
      if (!mod.desecrated) continue
      tryPush(mod)
    }
  }

  if (opts.includeMarksman && data.marksmanMods?.length) {
    const marksmanTags = new Set(opts.tags)
    marksmanTags.add(MARKSMAN_TAG)
    for (const mod of data.marksmanMods) {
      if (!kinds.includes(mod.k)) continue
      if (mod.l > ilvl) continue
      if (mod.l < (opts.tierFloor ?? 0)) continue
      const weight = spawnWeight(mod, marksmanTags)
      if (weight <= 0 || seen.has(mod.id)) continue
      seen.add(mod.id)
      out.push({ ...mod, weight })
    }
  }

  return out
}

const POOL_SOURCE_NOTES: Record<ModPoolSource, string> = {
  craft:
    'Normal craft pool (alchemy / exalt weights) for this base at this item level. Skill-level mods like "+# to Level of all Projectile Skills" appear on quivers, bows, and rings — not on armour.',
  marksman:
    'Marksman rune pool only. Requires a belt or quiver with "Can roll Marksman modifiers" when crafting on other gear.',
  desecrated: 'Desecrated mods for this base (Abyss / bone crafting). Not part of normal currency crafting.',
  all: 'All pools for this base: craft + marksman rune pool + desecrated mods.',
}

export function buildModPoolReport(data: CraftDataset, query: ModPoolQuery): ModPoolReport {
  const kind = query.kind ?? 'all'
  const poolSource = query.poolSource ?? 'craft'
  const context = query.context ?? (query.item ? 'item' : 'fresh')
  const ilvl = Math.max(1, query.itemLevel || 1)
  const tierFloor = Math.max(0, query.tierFloor ?? 0)
  const quality = Math.min(100, Math.max(0, query.quality ?? 20))
  const catalyst = resolveCatalyst(data, query.catalyst)
  const baseTags = getBaseTags(data, query.baseType)
  if (!baseTags) throw new Error(`Unknown base type "${query.baseType}".`)

  const kinds: GenKind[] = kind === 'p' ? ['p'] : kind === 's' ? ['s'] : ['p', 's']
  let pool: Array<CraftMod & { weight: number }>
  let effectiveContext: 'fresh' | 'item' = context
  let marksmanOn = false

  const includeCraft = poolSource === 'craft' || poolSource === 'all'
  const includeMarksman =
    poolSource === 'marksman' || poolSource === 'all' || (poolSource === 'craft' && query.marksmanEnabled === true)
  const includeDesecrated = poolSource === 'desecrated' || poolSource === 'all'

  if (poolSource === 'craft' && context === 'item' && query.item) {
    const state = itemStateFromPoeItem(data, query.item)
    if (!state) throw new Error(`Could not resolve item state for "${query.baseType}".`)
    if (state.baseType !== query.baseType) {
      state.baseType = query.baseType
      state.tags = baseTags
    }
    state.itemLevel = ilvl
    if (query.marksmanEnabled !== undefined) state.marksmanEnabled = query.marksmanEnabled
    marksmanOn = query.marksmanEnabled === true || state.marksmanEnabled === true
    pool = allEligibleForExalt(data, state, { maxPrefix: 3, maxSuffix: 3, tierFloor })
    if (kind === 'p') pool = pool.filter((m) => m.k === 'p')
    if (kind === 's') pool = pool.filter((m) => m.k === 's')
  } else {
    effectiveContext = 'fresh'
    const tags = new Set(baseTags)
    if (includeMarksman) {
      tags.add(MARKSMAN_TAG)
      marksmanOn = true
    }
    pool = poolForBase(data, query.baseType, ilvl, kinds, {
      tags,
      includeCraft,
      includeMarksman,
      includeDesecrated,
      tierFloor,
    })
  }

  pool = applyCatalystWeights(pool, catalyst, quality)

  const sections = poolToSections(pool, kind)
  const groups = sections.flatMap((s) => s.groups)
  const outcomes = groupedOutcomesToFlat(groups)
  const totalWeight = pool.reduce((s, m) => s + m.weight, 0)
  const dataNote = data.source === 'coe' ? ' Scalpel Lab per-base weightings.' : ''
  const floorNote = tierFloor > 0 ? ` Tier floor iLvl ≥ ${tierFloor}.` : ''
  const catNote = catalyst
    ? ` ${catalyst.name} catalyst @ ${quality}% quality (+${quality}% weight on ${catalyst.tags.join(', ')}).`
    : ''
  const contextNote =
    effectiveContext === 'item'
      ? `Exalt-style pool on current item (tags, blocked groups, open slots).${dataNote}${floorNote}${catNote}`
      : `${POOL_SOURCE_NOTES[poolSource]}${dataNote}${floorNote}${catNote}`

  return {
    baseType: query.baseType,
    itemLevel: ilvl,
    kind,
    context: effectiveContext,
    poolSource,
    modCount: outcomes.length,
    groupCount: groups.length,
    totalWeight,
    outcomes,
    groups,
    sections,
    note: contextNote,
    catalysts: data.catalysts ?? [],
    socketables: data.socketables ?? [],
    essencesForBase: essencesForBase(data, query.baseType),
    catalystApplied: catalyst ? { name: catalyst.name, quality, tags: catalyst.tags } : null,
    tierFloor,
  }
}

export function searchBaseTypes(
  data: CraftDataset,
  query: string,
  limit = 50,
  itemClass?: string,
): string[] {
  let names = Object.keys(data.bases)
  if (itemClass) {
    names = names.filter((n) => data.bases[n]?.c === itemClass)
  }
  const q = query.trim().toLowerCase()
  if (!q) return names.sort((a, b) => a.localeCompare(b)).slice(0, limit)
  const matches: string[] = []
  for (const name of names) {
    if (name.toLowerCase().includes(q)) matches.push(name)
    if (matches.length >= limit) break
  }
  return matches.sort((a, b) => a.localeCompare(b))
}

export function listItemClasses(data: CraftDataset): string[] {
  const classes = new Set<string>()
  for (const base of Object.values(data.bases)) {
    if (base.c) classes.add(base.c)
  }
  return [...classes].sort()
}

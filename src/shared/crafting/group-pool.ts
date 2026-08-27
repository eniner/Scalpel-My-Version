import { pickWeighted } from './weights'
import type { CraftMod, GenKind } from './types'

export interface ModTierOutcome {
  id: string
  name: string
  text: string
  ilvl: number
  spawnWeight: number
  /** Chance within this mod group (tier roll). */
  tierChance: number
  /** Chance to hit this exact tier on one group→tier roll in the pool. */
  overallChance: number
  pool?: 'craft' | 'marksman' | 'desecrated'
}

export interface ModGroupOutcome {
  group: string
  kind: GenKind
  /** CoE mod template name, e.g. "+# to maximum Life". */
  displayName: string
  /** CoE affix tags (life, fire, caster, …). */
  tags: string[]
  groupWeight: number
  /** Chance to roll this mod group before picking a tier. */
  groupChance: number
  tierCount: number
  /** Highest eligible tier at this item level. */
  bestTierText: string
  bestTierIlvl: number
  tiers: ModTierOutcome[]
}

export interface ModPoolSection {
  kind: GenKind
  label: string
  groupCount: number
  modCount: number
  totalWeight: number
  groups: ModGroupOutcome[]
}

function groupKey(mod: CraftMod): string {
  const pool = mod.pool === 'marksman' ? 'm' : mod.desecrated ? 'd' : 'c'
  return `${pool}:${mod.k}:${mod.g}`
}

function poolTagFor(mod: CraftMod): 'craft' | 'marksman' | 'desecrated' {
  if (mod.pool === 'marksman') return 'marksman'
  if (mod.desecrated) return 'desecrated'
  return 'craft'
}

export function poolToGroups(pool: Array<CraftMod & { weight: number }>): ModGroupOutcome[] {
  const grouped = new Map<string, Array<CraftMod & { weight: number }>>()
  for (const mod of pool) {
    const key = groupKey(mod)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(mod)
  }

  const totalWeight = pool.reduce((s, m) => s + m.weight, 0)
  if (totalWeight <= 0) return []

  const groups: ModGroupOutcome[] = []
  for (const tiers of grouped.values()) {
    tiers.sort((a, b) => a.l - b.l || a.id.localeCompare(b.id))
    const mod = tiers[0]
    const groupWeight = tiers.reduce((s, t) => s + t.weight, 0)
    const groupChance = groupWeight / totalWeight
    const tierOutcomes: ModTierOutcome[] = tiers.map((t) => ({
      id: t.id,
      name: t.n,
      text: t.t || t.n || t.g,
      ilvl: t.l,
      spawnWeight: t.weight,
      tierChance: t.weight / groupWeight,
      overallChance: groupChance * (t.weight / groupWeight),
      pool: poolTagFor(t),
    }))
    const best = tiers[tiers.length - 1]
    groups.push({
      group: mod.g,
      kind: mod.k,
      displayName: mod.n || mod.t || mod.g,
      tags: mod.a ?? [],
      groupWeight,
      groupChance,
      tierCount: tiers.length,
      bestTierText: best.t || best.n || best.g,
      bestTierIlvl: best.l,
      tiers: tierOutcomes,
    })
  }

  return groups.sort((a, b) => b.groupChance - a.groupChance || a.group.localeCompare(b.group))
}

export function poolToSections(pool: Array<CraftMod & { weight: number }>, kind: 'all' | 'p' | 's'): ModPoolSection[] {
  if (kind === 'p') {
    const pPool = pool.filter((m) => m.k === 'p')
    const groups = poolToGroups(pPool)
    return [
      {
        kind: 'p',
        label: 'Prefixes',
        groupCount: groups.length,
        modCount: pPool.length,
        totalWeight: pPool.reduce((s, m) => s + m.weight, 0),
        groups,
      },
    ]
  }
  if (kind === 's') {
    const sPool = pool.filter((m) => m.k === 's')
    const groups = poolToGroups(sPool)
    return [
      {
        kind: 's',
        label: 'Suffixes',
        groupCount: groups.length,
        modCount: sPool.length,
        totalWeight: sPool.reduce((s, m) => s + m.weight, 0),
        groups,
      },
    ]
  }

  const sections: ModPoolSection[] = []
  for (const k of ['p', 's'] as const) {
    const slice = pool.filter((m) => m.k === k)
    if (!slice.length) continue
    const groups = poolToGroups(slice)
    sections.push({
      kind: k,
      label: k === 'p' ? 'Prefixes' : 'Suffixes',
      groupCount: groups.length,
      modCount: slice.length,
      totalWeight: slice.reduce((s, m) => s + m.weight, 0),
      groups,
    })
  }
  return sections
}

/** Pick a mod using group-first roll (group, then tier within group). */
export function pickGroupThenTier(
  pool: Array<CraftMod & { weight: number }>,
  rng: () => number,
): (CraftMod & { weight: number }) | null {
  if (!pool.length) return null
  const groups = poolToGroups(pool)
  const picked = pickWeighted(
    groups.map((g) => ({ group: g, weight: g.groupWeight })),
    rng,
  )
  if (!picked) return null
  const tierPool = pool.filter((m) => m.k === picked.group.kind && m.g === picked.group.group)
  return pickWeighted(tierPool, rng)
}

export function groupedOutcomesToFlat(groups: ModGroupOutcome[]): Array<{
  id: string
  tierName: string
  text: string
  group: string
  kind: GenKind
  probability: number
  weight?: number
  groupWeight?: number
  ilvl?: number
  groupChance?: number
  tierChance?: number
  pool?: 'craft' | 'marksman' | 'desecrated'
}> {
  const flat: Array<{
    id: string
    tierName: string
    text: string
    group: string
    kind: GenKind
    probability: number
    weight?: number
    groupWeight?: number
    ilvl?: number
    groupChance?: number
    tierChance?: number
    pool?: 'craft' | 'marksman' | 'desecrated'
  }> = []
  for (const g of groups) {
    for (const t of g.tiers) {
      flat.push({
        id: t.id,
        tierName: t.name,
        text: t.text,
        group: g.group,
        kind: g.kind,
        probability: t.overallChance,
        weight: t.spawnWeight,
        groupWeight: g.groupWeight,
        ilvl: t.ilvl,
        groupChance: g.groupChance,
        tierChance: t.tierChance,
        pool: t.pool,
      })
    }
  }
  return flat.sort((a, b) => b.probability - a.probability)
}

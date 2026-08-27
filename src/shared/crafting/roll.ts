import { pickGroupThenTier } from './group-pool'
import { modBindGroups, pickWeighted } from './weights'
import { buildItemTags, countByKind, eligibleMods, resolveModFromLine, rollTagsForState } from './pool'
import type { CraftDataset, CraftItemMod, CraftItemState, CraftMod, GenKind } from './types'

export const DEFAULT_MOD_COUNT_WEIGHTS: Array<[number, number]> = [
  [4, 8],
  [5, 3],
  [6, 1],
]

export const MAGIC_MOD_COUNT: Array<[number, number]> = [
  [1, 1],
  [2, 1],
]

export function makeRng(seed = Date.now()): () => number {
  let s = seed >>> 0
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 0xffffffff
  }
}

export function craftModToItemMod(mod: CraftMod): CraftItemMod {
  return {
    group: mod.g,
    kind: mod.k,
    text: mod.t,
    name: mod.n,
    bindGroups: modBindGroups(mod),
    ...(mod.pool ? { pool: mod.pool } : {}),
  }
}

export function cloneItemState(state: CraftItemState): CraftItemState {
  return {
    ...state,
    tags: [...state.tags],
    activeOmens: state.activeOmens ? [...state.activeOmens] : undefined,
    marksmanEnabled: state.marksmanEnabled,
    revealChoices: state.revealChoices
      ? { ...state.revealChoices, mods: state.revealChoices.mods.map((m) => ({ ...m })) }
      : undefined,
    mods: state.mods.map((m) => ({ ...m, bindGroups: m.bindGroups ? [...m.bindGroups] : undefined })),
  }
}

export function pickModCount(weights: Array<[number, number]>, rng: () => number): number {
  const items = weights.map(([count, weight]) => ({ count, weight }))
  return pickWeighted(items, rng)?.count ?? weights[0][0]
}

export function pickNextKind(
  prefixCount: number,
  suffixCount: number,
  maxP: number,
  maxS: number,
  rng: () => number,
): GenKind | null {
  const canP = prefixCount < maxP
  const canS = suffixCount < maxS
  if (canP && canS) return rng() < 0.5 ? 'p' : 's'
  if (canP) return 'p'
  if (canS) return 's'
  return null
}

export function rollOneMod(
  data: CraftDataset,
  tags: Set<string>,
  ilvl: number,
  kind: GenKind,
  blocked: Set<string>,
  prefixCount: number,
  suffixCount: number,
  maxP: number,
  maxS: number,
  rng: () => number,
  baseType: string,
  tierFloor = 0,
): CraftMod | null {
  const pool = eligibleMods(data, tags, ilvl, kind, blocked, {
    maxPrefix: maxP,
    maxSuffix: maxS,
    prefixCount,
    suffixCount,
    baseType,
    tierFloor,
  })
  return pickGroupThenTier(pool, rng) ?? null
}

export function rollMods(
  data: CraftDataset,
  state: CraftItemState,
  targetCount: number,
  maxP: number,
  maxS: number,
  blockedGroups: Set<string>,
  startTags: Set<string>,
  rng: () => number,
  tierFloor = 0,
): CraftMod[] {
  const tags = new Set(startTags)
  const blocked = new Set(blockedGroups)
  let prefixCount = 0
  let suffixCount = 0
  const rolled: CraftMod[] = []
  while (rolled.length < targetCount) {
    const kind = pickNextKind(prefixCount, suffixCount, maxP, maxS, rng)
    if (!kind) break
    const mod = rollOneMod(
      data,
      tags,
      state.itemLevel,
      kind,
      blocked,
      prefixCount,
      suffixCount,
      maxP,
      maxS,
      rng,
      state.baseType,
      tierFloor,
    )
    if (!mod) break
    rolled.push(mod)
    for (const g of modBindGroups(mod)) blocked.add(g)
    if (mod.a) for (const t of mod.a) tags.add(t)
    if (kind === 'p') prefixCount++
    else suffixCount++
  }
  return rolled
}

export function rollFreshRare(
  data: CraftDataset,
  state: CraftItemState,
  rng: () => number,
  tierFloor = 0,
  modCountWeights = DEFAULT_MOD_COUNT_WEIGHTS,
): CraftMod[] {
  const target = pickModCount(modCountWeights, rng)
  return rollMods(data, state, target, 3, 3, new Set(), rollTagsForState(state), rng, tierFloor)
}

export function rollFreshMagic(
  data: CraftDataset,
  state: CraftItemState,
  rng: () => number,
  tierFloor = 0,
): CraftMod[] {
  const target = pickModCount(MAGIC_MOD_COUNT, rng)
  return rollMods(data, state, target, 1, 1, new Set(), rollTagsForState(state), rng, tierFloor)
}

export function rollOneExaltMod(
  data: CraftDataset,
  state: CraftItemState,
  rng: () => number,
  tierFloor = 0,
  forcedKind?: GenKind,
): CraftMod | null {
  const tags = buildItemTags(data, state)
  const counts = countByKind(state.mods.filter((m) => !m.veiled))
  const blocked = new Set(state.mods.flatMap((m) => (m.bindGroups?.length ? m.bindGroups : [m.group])))
  const kind = forcedKind ?? pickNextKind(counts.p, counts.s, 3, 3, rng)
  if (!kind) return null
  if (forcedKind === 'p' && counts.p >= 3) return null
  if (forcedKind === 's' && counts.s >= 3) return null
  return rollOneMod(
    data,
    tags,
    state.itemLevel,
    kind,
    blocked,
    counts.p,
    counts.s,
    3,
    3,
    rng,
    state.baseType,
    tierFloor,
  )
}

export function pickRemovableModIndex(
  state: CraftItemState,
  rng: () => number,
  opts?: {
    kind?: GenKind
    desecratedOnly?: boolean
    lowestLevel?: boolean
    data?: CraftDataset
  },
): number {
  const mods = state.mods
  let candidates = mods.map((_, i) => i)
  if (opts?.desecratedOnly) {
    candidates = candidates.filter((i) => mods[i].desecrated)
  }
  if (opts?.kind) {
    candidates = candidates.filter((i) => mods[i].kind === opts.kind)
  }
  if (!candidates.length) candidates = mods.map((_, i) => i)

  if (opts?.lowestLevel && opts.data) {
    let best = candidates[0]
    let bestLvl = Infinity
    for (const i of candidates) {
      const mod = resolveModFromLine(opts.data, mods[i].text, mods[i].kind)
      const lvl = mod?.l ?? state.itemLevel
      if (lvl < bestLvl) {
        bestLvl = lvl
        best = i
      }
    }
    return best
  }

  return candidates[Math.floor(rng() * candidates.length)]
}

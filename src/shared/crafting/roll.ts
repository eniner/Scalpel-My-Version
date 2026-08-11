import { withCatalystWeights } from './catalyst'
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

function rollInRange(lo: number, hi: number, rng: () => number): number {
  const min = Math.min(lo, hi)
  const max = Math.max(lo, hi)
  if (Number.isInteger(min) && Number.isInteger(max)) {
    return Math.floor(min + rng() * (max - min + 1))
  }
  return Number((min + rng() * (max - min)).toFixed(1))
}

/** Fill `#` placeholders (or `(min-max)` / bare numbers) from CoE ranges. */
export function materializeModText(
  template: string,
  ranges: Array<[number, number]> | undefined,
  rng: () => number,
): string {
  if (!ranges?.length) return template
  let i = 0
  if (template.includes('#')) {
    return template.replace(/#/g, () => {
      if (i >= ranges.length) return '#'
      const [lo, hi] = ranges[i++]
      return String(rollInRange(lo, hi, rng))
    })
  }
  return template.replace(/\(([-+]?\d+(?:\.\d+)?)-([-+]?\d+(?:\.\d+)?)\)|([-+]?\d+(?:\.\d+)?)/g, (full, _a, _b, single) => {
    if (i >= ranges.length) return full
    const [lo, hi] = ranges[i++]
    return String(rollInRange(lo, hi, rng))
  })
}

export function craftModToItemMod(mod: CraftMod, rng?: () => number): CraftItemMod {
  const ranges = mod.ranges?.map((r) => [...r] as [number, number])
  const template = mod.n?.includes('#') ? mod.n : mod.t
  const text = rng && ranges?.length ? materializeModText(template, ranges, rng) : mod.t
  return {
    group: mod.g,
    kind: mod.k,
    text,
    name: mod.n,
    bindGroups: modBindGroups(mod),
    ...(ranges?.length ? { ranges } : {}),
    ...(mod.pool ? { pool: mod.pool } : {}),
  }
}

/** Re-roll numeric values on an item mod from stored ranges (Divine). */
export function divineRerollMod(mod: CraftItemMod, rng: () => number): CraftItemMod {
  let ranges = mod.ranges
  if (!ranges?.length) {
    const parsed: Array<[number, number]> = []
    const re = /\(([-+]?\d+(?:\.\d+)?)-([-+]?\d+(?:\.\d+)?)\)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(mod.text))) parsed.push([Number(m[1]), Number(m[2])])
    if (!parsed.length) return mod
    ranges = parsed
  }
  const template = mod.name?.includes('#')
    ? mod.name
    : mod.text.replace(/\(([-+]?\d+(?:\.\d+)?)-([-+]?\d+(?:\.\d+)?)\)/g, '#').replace(/(?<![.\d])[-+]?\d+(?:\.\d+)?(?![.\d])/g, '#')
  // Collapse accidental #### from double replace into single # tokens matching range count.
  let hashes = 0
  const cleaned = template.replace(/#+/g, () => {
    hashes++
    return '#'
  })
  const useTemplate = hashes === ranges.length ? cleaned : mod.name?.includes('#') ? mod.name : cleaned
  return { ...mod, ranges, text: materializeModText(useTemplate, ranges, rng) }
}

export function cloneItemState(state: CraftItemState): CraftItemState {
  return {
    ...state,
    tags: [...state.tags],
    activeOmens: state.activeOmens ? [...state.activeOmens] : undefined,
    marksmanEnabled: state.marksmanEnabled,
    quality: state.quality,
    catalyst: state.catalyst,
    sockets: state.sockets,
    socketed: state.socketed ? [...state.socketed] : undefined,
    revealChoices: state.revealChoices
      ? { ...state.revealChoices, mods: state.revealChoices.mods.map((m) => ({ ...m })) }
      : undefined,
    mods: state.mods.map((m) => ({
      ...m,
      bindGroups: m.bindGroups ? [...m.bindGroups] : undefined,
      ranges: m.ranges?.map((r) => [...r] as [number, number]),
    })),
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

/** CoE `crsim_ignhomotypes` — mtype 38 / poedb_id `drop` is ignored for homogenise. */
const HOMOGENISE_IGNORE = new Set(['drop'])

export function homogeniseAttrsOnItem(data: CraftDataset, state: CraftItemState): string[] {
  const tags = new Set<string>()
  for (const m of state.mods) {
    if (m.veiled) continue
    const resolved = resolveModFromLine(data, m.text, m.kind)
    if (!resolved?.a?.length) continue
    for (const t of resolved.a) {
      if (HOMOGENISE_IGNORE.has(t)) continue
      tags.add(t)
    }
  }
  return [...tags]
}

function filterHomogenisePool(
  pool: Array<CraftMod & { weight: number }>,
  attrs: string[],
): Array<CraftMod & { weight: number }> {
  if (!attrs.length) return pool
  const want = new Set(attrs)
  const filtered = pool.filter((m) => m.a?.some((t) => want.has(t) && !HOMOGENISE_IGNORE.has(t)))
  return filtered.length ? filtered : pool
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
  homogeniseAttrs?: string[],
  state?: CraftItemState,
): CraftMod | null {
  let pool = eligibleMods(data, tags, ilvl, kind, blocked, {
    maxPrefix: maxP,
    maxSuffix: maxS,
    prefixCount,
    suffixCount,
    baseType,
    tierFloor,
  })
  if (state) pool = withCatalystWeights(data, state, pool)
  if (homogeniseAttrs?.length) pool = filterHomogenisePool(pool, homogeniseAttrs)
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
      undefined,
      state,
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

export function rollFreshMagic(data: CraftDataset, state: CraftItemState, rng: () => number, tierFloor = 0): CraftMod[] {
  const target = pickModCount(MAGIC_MOD_COUNT, rng)
  return rollMods(data, state, target, 1, 1, new Set(), rollTagsForState(state), rng, tierFloor)
}

export function rollOneExaltMod(
  data: CraftDataset,
  state: CraftItemState,
  rng: () => number,
  tierFloor = 0,
  forcedKind?: GenKind,
  opts?: { homogenise?: boolean },
): CraftMod | null {
  const tags = buildItemTags(data, state)
  const counts = countByKind(state.mods.filter((m) => !m.veiled))
  const blocked = new Set(state.mods.flatMap((m) => (m.bindGroups?.length ? m.bindGroups : [m.group])))
  const kind = forcedKind ?? pickNextKind(counts.p, counts.s, 3, 3, rng)
  if (!kind) return null
  if (forcedKind === 'p' && counts.p >= 3) return null
  if (forcedKind === 's' && counts.s >= 3) return null
  const homogeniseAttrs = opts?.homogenise ? homogeniseAttrsOnItem(data, state) : undefined
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
    homogeniseAttrs,
    state,
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
  let candidates = mods
    .map((_, i) => i)
    .filter((i) => !mods[i].fractured && !mods[i].veiled)
  if (opts?.desecratedOnly) {
    candidates = candidates.filter((i) => mods[i].desecrated)
  }
  if (opts?.kind) {
    candidates = candidates.filter((i) => mods[i].kind === opts.kind)
  }
  if (!candidates.length) return -1

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

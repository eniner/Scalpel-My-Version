import { textsRoughlyMatch } from './text'
import type { CraftDataset, CraftItemMod, CraftItemState, CraftMod, GenKind } from './types'
import { isGroupBlocked, modBindGroups, spawnWeight } from './weights'

export const MARKSMAN_TAG = 'can_roll_marksman'

const MARKSMAN_IMPLICIT = /can roll marksman modifiers/i

export function itemHasMarksmanImplicit(item: {
  implicits?: string[]
  imbues?: string[]
  enchants?: string[]
}): boolean {
  const lines = [...(item.implicits ?? []), ...(item.imbues ?? []), ...(item.enchants ?? [])]
  return lines.some((line) => MARKSMAN_IMPLICIT.test(line))
}

export function marksmanActive(state: CraftItemState): boolean {
  return state.marksmanEnabled === true
}

export function rollTagsForState(state: CraftItemState): Set<string> {
  const tags = buildItemTagsFromState(state)
  if (marksmanActive(state)) tags.add(MARKSMAN_TAG)
  return tags
}

function buildItemTagsFromState(state: CraftItemState): Set<string> {
  const tags = new Set(state.tags)
  return tags
}

function appendMarksmanPool(
  data: CraftDataset,
  out: Array<CraftMod & { weight: number }>,
  opts: {
    tags: Set<string>
    ilvl: number
    kind: GenKind
    blockedGroups: Set<string>
    tierFloor: number
  },
): void {
  if (!opts.tags.has(MARKSMAN_TAG) || !data.marksmanMods?.length) return
  const seen = new Set(out.map((m) => m.id))
  for (const mod of data.marksmanMods) {
    if (mod.k !== opts.kind) continue
    if (mod.l > opts.ilvl || mod.l < opts.tierFloor) continue
    if (isGroupBlocked(mod, opts.blockedGroups)) continue
    const weight = spawnWeight(mod, opts.tags)
    if (weight <= 0 || seen.has(mod.id)) continue
    seen.add(mod.id)
    out.push({ ...mod, weight })
  }
}

export function getBaseTags(data: CraftDataset, baseType: string): string[] | null {
  const base = data.bases[baseType]
  if (!base) return null
  const tags = new Set(base.tags)
  tags.add(baseType)
  return [...tags]
}

export function resolveModFromLine(data: CraftDataset, line: string, kind: GenKind): CraftMod | null {
  let best: CraftMod | null = null
  let bestScore = 0
  for (const mod of data.mods) {
    if (mod.k !== kind) continue
    if (textsRoughlyMatch(line, mod.t)) {
      const score = mod.t.length
      if (score > bestScore) {
        bestScore = score
        best = mod
      }
    }
  }
  return best
}

export function buildItemTags(data: CraftDataset, state: CraftItemState): Set<string> {
  const tags = new Set(state.tags)
  for (const m of state.mods) {
    const mod = resolveModFromLine(data, m.text, m.kind)
    if (mod?.a) for (const t of mod.a) tags.add(t)
  }
  if (marksmanActive(state)) tags.add(MARKSMAN_TAG)
  return tags
}

export function countByKind(mods: CraftItemMod[]): { p: number; s: number } {
  let p = 0
  let s = 0
  for (const m of mods) {
    if (m.kind === 'p') p++
    else s++
  }
  return { p, s }
}

export function usedGroups(mods: CraftItemMod[]): Set<string> {
  const out = new Set<string>()
  for (const m of mods) {
    if (m.bindGroups?.length) {
      for (const g of m.bindGroups) out.add(g)
    } else {
      out.add(m.group)
    }
  }
  return out
}

export function eligibleMods(
  data: CraftDataset,
  tags: Set<string>,
  ilvl: number,
  kind: GenKind,
  blockedGroups: Set<string>,
  opts: {
    maxPrefix: number
    maxSuffix: number
    prefixCount: number
    suffixCount: number
    baseType?: string
    tierFloor?: number
  },
): Array<CraftMod & { weight: number }> {
  if (kind === 'p' && opts.prefixCount >= opts.maxPrefix) return []
  if (kind === 's' && opts.suffixCount >= opts.maxSuffix) return []
  const floor = opts.tierFloor ?? 0
  const out: Array<CraftMod & { weight: number }> = []
  for (const mod of data.mods) {
    if (mod.k !== kind) continue
    if (mod.l > ilvl || mod.l < floor) continue
    if (isGroupBlocked(mod, blockedGroups)) continue
    const weight = spawnWeight(mod, tags, opts.baseType)
    if (weight > 0) out.push({ ...mod, weight })
  }
  appendMarksmanPool(data, out, {
    tags,
    ilvl,
    kind,
    blockedGroups: blockedGroups,
    tierFloor: floor,
  })
  return out
}

export function allEligibleForExalt(
  data: CraftDataset,
  state: CraftItemState,
  opts: { maxPrefix: number; maxSuffix: number; tierFloor?: number },
): Array<CraftMod & { weight: number }> {
  const tags = buildItemTags(data, state)
  const counts = countByKind(state.mods)
  const blocked = usedGroups(state.mods)
  const tierFloor = opts.tierFloor ?? 0
  const pool: Array<CraftMod & { weight: number }> = []
  if (counts.p < opts.maxPrefix) {
    pool.push(...eligibleMods(data, tags, state.itemLevel, 'p', blocked, {
      maxPrefix: opts.maxPrefix,
      maxSuffix: opts.maxSuffix,
      prefixCount: counts.p,
      suffixCount: counts.s,
      baseType: state.baseType,
      tierFloor,
    }))
  }
  if (counts.s < opts.maxSuffix) {
    pool.push(...eligibleMods(data, tags, state.itemLevel, 's', blocked, {
      maxPrefix: opts.maxPrefix,
      maxSuffix: opts.maxSuffix,
      prefixCount: counts.p,
      suffixCount: counts.s,
      baseType: state.baseType,
      tierFloor,
    }))
  }
  return pool
}

export function itemStateFromPoeItem(
  data: CraftDataset,
  item: {
    baseType: string
    itemLevel: number
    rarity: string
    itemClass: string
    corrupted: boolean
    explicits: string[]
    implicits?: string[]
    imbues?: string[]
    enchants?: string[]
    advancedMods?: Array<{ type: string; name: string; lines: string[] }>
  },
  opts?: { marksmanEnabled?: boolean },
): CraftItemState | null {
  const baseTags = getBaseTags(data, item.baseType)
  if (!baseTags) return null
  const rarity =
    item.rarity === 'Magic' || item.rarity === 'Rare' || item.rarity === 'Unique' || item.rarity === 'Normal'
      ? item.rarity
      : 'Normal'

  const mods: CraftItemMod[] = []
  if (item.advancedMods?.length) {
    for (const am of item.advancedMods) {
      if (am.type !== 'prefix' && am.type !== 'suffix') continue
      const line = am.lines[0] ?? ''
      const kind: GenKind = am.type === 'prefix' ? 'p' : 's'
      const resolved = resolveModFromLine(data, line, kind)
      mods.push({
        group: (resolved?.g ?? am.name) || 'unknown',
        kind,
        text: line,
        name: am.name || resolved?.n,
        bindGroups: resolved ? modBindGroups(resolved) : undefined,
      })
    }
  } else if (item.rarity === 'Rare' || item.rarity === 'Magic') {
    for (const line of item.explicits) {
      const p = resolveModFromLine(data, line, 'p')
      const s = !p ? resolveModFromLine(data, line, 's') : null
      const resolved = p ?? s
      if (!resolved) continue
      mods.push({
        group: resolved.g,
        kind: resolved.k,
        text: line,
        name: resolved.n,
        bindGroups: modBindGroups(resolved),
      })
    }
  }

  const base = data.bases[item.baseType]
  return {
    baseType: item.baseType,
    itemLevel: item.itemLevel || 1,
    rarity,
    tags: baseTags,
    itemClass: item.itemClass || base?.c || 'Item',
    corrupted: item.corrupted,
    mods,
    marksmanEnabled:
      opts?.marksmanEnabled !== undefined ? opts.marksmanEnabled : itemHasMarksmanImplicit(item),
  }
}

/** Minimal PoeItem for craft IPC from emulator virtual state. */
export function itemStateToPoeItem(state: CraftItemState): import('../contracts/items').PoeItem {
  return {
    itemClass: state.itemClass,
    rarity: state.rarity,
    name: state.baseType,
    baseType: state.baseType,
    mapTier: 0,
    itemLevel: state.itemLevel,
    quality: 0,
    sockets: '',
    linkedSockets: 0,
    armour: 0,
    evasion: 0,
    energyShield: 0,
    ward: 0,
    block: 0,
    reqStr: 0,
    reqDex: 0,
    reqInt: 0,
    corrupted: state.corrupted,
    identified: true,
    mirrored: false,
    synthesised: false,
    fractured: false,
    transfigured: false,
    blighted: false,
    zanaMemory: false,
    implicitCount: 0,
    gemLevel: 0,
    stackSize: 1,
    influence: [],
    explicits: state.mods.map((m) => m.text),
    implicits: [],
    enchants: [],
    imbues: [],
    advancedMods: state.mods.map((m) => ({
      type: m.kind === 'p' ? 'prefix' : 'suffix',
      name: m.name ?? m.group,
      lines: [m.text],
    })),
  }
}

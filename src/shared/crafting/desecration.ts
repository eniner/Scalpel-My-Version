import { pickGroupThenTier } from './group-pool'
import { candidateModsForTags } from './mod-index'
import type { OmenEffect } from './omens'
import { modBindGroups, pickWeighted, spawnWeight } from './weights'
import { buildItemTags, countByKind, usedGroups } from './pool'
import { craftModToItemMod } from './roll'
import type {
  CraftDataset,
  CraftItemMod,
  CraftItemState,
  CraftMod,
  DesecrationRevealChoice,
  GenKind,
} from './types'

export const DESECRATION_SPAWN_RATE = [0.8, 0.15, 0.05]

export interface BoneDef {
  id: string
  name: string
  desc: string
  minModLevel?: number
  maxItemLevel?: number
  /** CoE bgroup id or special rule. */
  rule: 'jewellery' | 'weapon' | 'armour' | 'jewel'
}

export const DESECRATION_BONES: BoneDef[] = [
  {
    id: 'ancient_collarbone',
    name: 'Ancient Collarbone',
    desc: 'Rare Amulet, Ring or Belt · min mod level 40',
    minModLevel: 40,
    rule: 'jewellery',
  },
  {
    id: 'ancient_jawbone',
    name: 'Ancient Jawbone',
    desc: 'Rare Weapon or Quiver · min mod level 40',
    minModLevel: 40,
    rule: 'weapon',
  },
  {
    id: 'ancient_ribs',
    name: 'Ancient Rib',
    desc: 'Rare Armour · min mod level 40',
    minModLevel: 40,
    rule: 'armour',
  },
  {
    id: 'gnawed_collarbone',
    name: 'Gnawed Collarbone',
    desc: 'Rare Amulet, Ring or Belt · max iLvl 64',
    maxItemLevel: 64,
    rule: 'jewellery',
  },
  {
    id: 'gnawed_jawbone',
    name: 'Gnawed Jawbone',
    desc: 'Rare Weapon or Quiver · max iLvl 64',
    maxItemLevel: 64,
    rule: 'weapon',
  },
  {
    id: 'gnawed_ribs',
    name: 'Gnawed Rib',
    desc: 'Rare Armour · max iLvl 64',
    maxItemLevel: 64,
    rule: 'armour',
  },
  {
    id: 'preserved_collarbone',
    name: 'Preserved Collarbone',
    desc: 'Rare Amulet, Ring or Belt',
    rule: 'jewellery',
  },
  {
    id: 'preserved_cranium',
    name: 'Preserved Cranium',
    desc: 'Rare Jewel',
    rule: 'jewel',
  },
  {
    id: 'preserved_jawbone',
    name: 'Preserved Jawbone',
    desc: 'Rare Weapon or Quiver',
    rule: 'weapon',
  },
  {
    id: 'preserved_ribs',
    name: 'Preserved Rib',
    desc: 'Rare Armour',
    rule: 'armour',
  },
]

const JEWELLERY_BGROUP = '1'
const JEWEL_BGROUP = '9'
const ARMOUR_BGROUPS = new Set(['2', '3', '4', '5', '8'])
const WEAPON_BGROUPS = new Set(['6', '7', '11'])

export function boneAppliesToBase(bone: BoneDef, state: CraftItemState, data: CraftDataset): string | null {
  const base = data.bases[state.baseType]
  if (!base) return 'Unknown base.'
  if (state.rarity !== 'Rare') return 'Desecration requires a Rare item.'
  if (bone.maxItemLevel != null && state.itemLevel > bone.maxItemLevel) {
    return `This bone requires item level ${bone.maxItemLevel} or lower.`
  }
  const bg = base.bgroup
  switch (bone.rule) {
    case 'jewellery':
      if (bg !== JEWELLERY_BGROUP) return 'This bone only works on jewellery.'
      break
    case 'jewel':
      if (bg !== JEWEL_BGROUP) return 'This bone only works on jewels.'
      break
    case 'armour':
      if (!bg || !ARMOUR_BGROUPS.has(bg)) return 'This bone only works on armour.'
      break
    case 'weapon':
      if (!bg || !WEAPON_BGROUPS.has(bg)) return 'This bone only works on weapons.'
      break
  }
  if (state.mods.some((m) => m.veiled || m.desecrated)) {
    return 'Item already has a desecrated modifier pending or applied.'
  }
  return null
}

function desecratedPool(
  data: CraftDataset,
  state: CraftItemState,
  kind: GenKind,
  minModLevel: number,
): Array<CraftMod & { weight: number }> {
  const tags = buildItemTags(data, state)
  const blocked = usedGroups(state.mods)
  const out: Array<CraftMod & { weight: number }> = []
  for (const mod of candidateModsForTags(data, tags, kind, state.baseType)) {
    if (!mod.desecrated) continue
    if (mod.l < minModLevel && mod.l < state.itemLevel) continue
    if (mod.l > state.itemLevel) continue
    const weight = spawnWeight(mod, tags, state.baseType)
    if (weight <= 0) continue
    if (blocked.has(mod.g)) continue
    out.push({ ...mod, weight })
  }
  return out
}

function regularPool(
  data: CraftDataset,
  state: CraftItemState,
  kind: GenKind,
  minModLevel: number,
  blockedGroups: Set<string>,
): Array<CraftMod & { weight: number }> {
  const tags = buildItemTags(data, state)
  const out: Array<CraftMod & { weight: number }> = []
  for (const mod of candidateModsForTags(data, tags, kind, state.baseType)) {
    if (mod.desecrated) continue
    if (mod.pool === 'marksman') continue
    if (mod.l < minModLevel && mod.l < state.itemLevel) continue
    if (mod.l > state.itemLevel) continue
    const weight = spawnWeight(mod, tags, state.baseType)
    if (weight <= 0) continue
    let blocked = false
    for (const g of modBindGroups(mod)) {
      if (blockedGroups.has(g)) {
        blocked = true
        break
      }
    }
    if (blocked) continue
    out.push({ ...mod, weight })
  }
  return out
}

function pickFromPool(
  pool: Array<CraftMod & { weight: number }>,
  blocked: Set<string>,
  rng: () => number,
): CraftMod | null {
  const eligible = pool.filter((m) => !modBindGroups(m).some((g) => blocked.has(g)))
  return pickGroupThenTier(eligible, rng) ?? null
}

function rollDesecCount(rng: () => number): number {
  const roll = rng()
  let acc = 0
  for (let i = 0; i < DESECRATION_SPAWN_RATE.length; i++) {
    acc += DESECRATION_SPAWN_RATE[i]
    if (roll <= acc) return i + 1
  }
  return 1
}

/** CoE mtype tags for named desecration omens (Liege / Sovereign / Blackblooded). */
const NAMED_DESEC_ATTR: Record<NonNullable<OmenEffect['desecNamed']>, string> = {
  liege: 'amanamu_mod',
  sovereign: 'ulaman_mod',
  blackblooded: 'kurgal_mod',
}

export function rollDesecrationChoices(
  data: CraftDataset,
  state: CraftItemState,
  kind: GenKind,
  minModLevel: number,
  omen: OmenEffect,
  rng: () => number,
): CraftItemMod[] {
  const blocked = new Set(usedGroups(state.mods))
  const picks: CraftItemMod[] = []
  const desecTarget = rollDesecCount(rng)
  const desecPool = desecratedPool(data, state, kind, minModLevel)
  const namedTag = omen.desecNamed ? NAMED_DESEC_ATTR[omen.desecNamed] : null
  const namedPool = namedTag ? desecPool.filter((m) => m.a?.includes(namedTag)) : []

  // Guarantee a random Amanamu / Ulaman / Kurgal desecrated mod when omen is active.
  if (namedTag) {
    const mod = pickFromPool(namedPool.length ? namedPool : desecPool, blocked, rng)
    if (mod) {
      picks.push({ ...craftModToItemMod(mod), desecrated: true })
      for (const g of modBindGroups(mod)) blocked.add(g)
    }
  }

  for (let i = picks.length; i < desecTarget && picks.length < 3; i++) {
    const pool = namedTag && namedPool.length ? namedPool : desecPool
    const mod = pickFromPool(pool, blocked, rng)
    if (!mod) break
    picks.push({ ...craftModToItemMod(mod), desecrated: true })
    for (const g of modBindGroups(mod)) blocked.add(g)
  }

  while (picks.length < 3) {
    const mod = pickFromPool(regularPool(data, state, kind, minModLevel, blocked), blocked, rng)
    if (!mod) break
    picks.push(craftModToItemMod(mod))
    for (const g of modBindGroups(mod)) blocked.add(g)
  }

  return picks
}

export function pickVeiledKind(
  state: CraftItemState,
  forcedKind?: GenKind,
  rng: () => number = Math.random,
): GenKind | null {
  const counts = countByKind(state.mods.filter((m) => !m.veiled))
  if (forcedKind) {
    if (forcedKind === 'p' && counts.p >= 3) return null
    if (forcedKind === 's' && counts.s >= 3) return null
    return forcedKind
  }
  if (counts.p >= 3) return 's'
  if (counts.s >= 3) return 'p'
  return rng() < 0.5 ? 'p' : 's'
}

export function makeRevealChoices(
  mods: CraftItemMod[],
  veiledKind: GenKind,
  rerollsLeft: number,
): DesecrationRevealChoice {
  return { mods, veiledKind, rerollsLeft }
}

export function boneById(id: string): BoneDef | undefined {
  return DESECRATION_BONES.find((b) => b.id === id)
}

export interface RevealPickOpts {
  /** Prefer a choice that matches any of these conditions. */
  match?: (mod: CraftItemMod) => boolean
  /** Prefer desecrated pool lines when scores tie. */
  preferDesecrated?: boolean
}

/** Auto-pick index for Sequence / Monte Carlo (prefer condition match, then desecrated, else 0). */
export function pickRevealIndex(choices: DesecrationRevealChoice, opts?: RevealPickOpts): number {
  const mods = choices.mods
  if (!mods.length) return 0
  const preferDesecrated = opts?.preferDesecrated !== false
  let best = 0
  let bestScore = -1
  for (let i = 0; i < mods.length; i++) {
    const m = mods[i]
    let score = 0
    if (opts?.match?.(m)) score += 100
    if (preferDesecrated && m.desecrated) score += 10
    if (score > bestScore) {
      bestScore = score
      best = i
    }
  }
  return best
}

/** True when no choice matches and Abyssal Echoes-style rerolls remain. */
export function shouldRerollReveal(choices: DesecrationRevealChoice, match?: (mod: CraftItemMod) => boolean): boolean {
  if (!choices.rerollsLeft || choices.rerollsLeft <= 0) return false
  if (!match) return false
  return !choices.mods.some((m) => match(m))
}

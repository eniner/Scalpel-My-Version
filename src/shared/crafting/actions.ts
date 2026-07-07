import type { CraftDataset, CraftItemState, CraftAction, CraftMod, GenKind } from './types'
import { tierFloorForCurrency, simKeyForCurrencyName } from './currency-rules'
import { DESECRATION_BONES, boneAppliesToBase } from './desecration'
import { allEligibleForExalt, countByKind, eligibleMods, rollTagsForState } from './pool'
import { groupedOutcomesToFlat, poolToSections } from './group-pool'
import { spawnWeight } from './weights'

export interface CraftCurrencyEntry {
  name: string
  desc: string
  lvl: number
  cat: string
  essenceId?: string
  tierFloor?: number
}

function slug(name: string): string {
  return `currency:${name}`
}

const SIM_KEY: Record<string, string> = {
  'chaos orb': 'chaos',
  'exalted orb': 'exalt',
  'orb of annulment': 'annul',
  'orb of alteration': 'alteration',
  'orb of transmutation': 'transmutation',
  'orb of augmentation': 'augmentation',
  'regal orb': 'regal',
  'orb of alchemy': 'alchemy',
  'orb of scouring': 'scouring',
}

export function simKeyForCurrency(name: string, cat?: string): string | null {
  return simKeyForCurrencyName(name, cat) ?? SIM_KEY[name.toLowerCase()] ?? (name.includes('Essence') || cat === 'essence' ? `essence:${name}` : null)
}

function currencyCategory(name: string, tags: string[]): string {
  if (tags.includes('essence')) return 'essence'
  if (name.includes('Fossil')) return 'fossil'
  if (name.includes('Catalyst')) return 'catalyst'
  if (name.includes('Omen')) return 'omen'
  if (name.endsWith(' Orb') || name.startsWith('Orb of ')) return 'orb'
  return 'other'
}

export function buildCurrencyCatalog(baseItems: Record<string, { name?: string; tags?: string[]; drop_level?: number; properties?: { description?: string; directions?: string } }>): CraftCurrencyEntry[] {
  const skip = /\b(map|scarab|fragment|seal|invitation|contract|waystone|dedication|tribute|baptism|rite|tome|tablet|vault key|pinnacle|logbook|\[dnt\]|shard)\b/i
  const out: CraftCurrencyEntry[] = []
  for (const bi of Object.values(baseItems)) {
    if (!bi.name || !bi.tags?.includes('currency')) continue
    if (skip.test(bi.name)) continue
    const desc = [bi.properties?.description, bi.properties?.directions].filter(Boolean).join(' ')
    if (!desc.trim()) continue
    out.push({
      name: bi.name,
      desc: desc.replace(/\[([^|\]]+)\|([^\]]+)\]/g, '$2').replace(/\[([^\]]+)\]/g, '$1').replace(/\s+/g, ' ').trim(),
      lvl: bi.drop_level || 1,
      cat: currencyCategory(bi.name, bi.tags),
    })
  }
  out.sort((a, b) => a.cat.localeCompare(b.cat) || a.lvl - b.lvl || a.name.localeCompare(b.name))
  return out
}

function poolActions(state: CraftItemState | null): CraftAction[] {
  if (!state) return []
  return [
    {
      id: 'pool:chaos',
      label: 'Mod pool · chaos reroll',
      description: 'Every mod that can appear after a full chaos reroll on this base (single-roll weight).',
      applies: state.rarity === 'Rare',
      reason: state.rarity !== 'Rare' ? 'Chaos pool applies to Rare items.' : undefined,
    },
    {
      id: 'pool:exalt',
      label: 'Mod pool · exalt add',
      description: 'Every mod that could be added by an exalt on this item right now.',
      applies: state.rarity === 'Rare',
      reason: state.rarity !== 'Rare' ? 'Exalt pool applies to Rare items.' : undefined,
    },
    {
      id: 'pool:all',
      label: 'Mod pool · all affixes',
      description: 'All prefix and suffix mods that can roll on this base at this item level.',
      applies: true,
    },
  ]
}

function appliesForSim(sim: string | null, state: CraftItemState, cur: CraftCurrencyEntry, data: CraftDataset): { applies: boolean; reason?: string } {
  if (!sim) return { applies: false, reason: 'Exact odds not modeled for this currency yet.' }
  const counts = countByKind(state.mods)
  const total = state.mods.length
  switch (sim) {
    case 'chaos':
      return state.rarity === 'Rare'
        ? { applies: true }
        : { applies: false, reason: 'Only applies to Rare items.' }
    case 'exalt':
      if (state.rarity !== 'Rare') return { applies: false, reason: 'Only applies to Rare items.' }
      if (total >= 6 || (counts.p >= 3 && counts.s >= 3)) return { applies: false, reason: 'No open prefix or suffix slot.' }
      return { applies: true }
    case 'annul':
      return (state.rarity === 'Rare' || state.rarity === 'Magic') && total > 0
        ? { applies: true }
        : { applies: false, reason: 'Item needs at least one modifier.' }
    case 'alteration':
      return state.rarity === 'Magic' ? { applies: true } : { applies: false, reason: 'Only applies to Magic items.' }
    case 'transmutation':
      return state.rarity === 'Normal' ? { applies: true } : { applies: false, reason: 'Only applies to Normal items.' }
    case 'augmentation': {
      if (state.rarity !== 'Magic') return { applies: false, reason: 'Only applies to Magic items.' }
      if (total >= 2) return { applies: false, reason: 'Magic item already has two modifiers.' }
      if (total === 0) return { applies: false, reason: 'Use Transmutation first.' }
      return { applies: true }
    }
    case 'regal':
      return state.rarity === 'Magic' ? { applies: true } : { applies: false, reason: 'Only applies to Magic items.' }
    case 'alchemy':
      return state.rarity === 'Normal' ? { applies: true } : { applies: false, reason: 'Only applies to Normal items.' }
    case 'scouring':
      return state.rarity !== 'Normal' ? { applies: true } : { applies: false, reason: 'Item is already Normal.' }
    case 'divine':
      return total > 0 ? { applies: true } : { applies: false, reason: 'Item needs at least one modifier.' }
    case 'vaal':
      return !state.corrupted ? { applies: true } : { applies: false, reason: 'Item is already corrupted.' }
    case 'fracture':
      return state.rarity === 'Rare' && total > 0
        ? { applies: true }
        : { applies: false, reason: 'Only applies to Rare items with modifiers.' }
    default:
      if (sim.startsWith('essence:')) {
        if (state.rarity !== 'Magic') return { applies: false, reason: 'Essences apply to Magic items.' }
        const forced = data.essences?.find((e) => e.name === cur.name)?.bases?.[state.baseType]
        if (!forced) return { applies: false, reason: 'This essence cannot be used on this base.' }
        if (forced.minIlvl > state.itemLevel) {
          return { applies: false, reason: `Needs item level ${forced.minIlvl}+.` }
        }
        return { applies: true }
      }
      return { applies: false, reason: 'Exact odds not modeled yet.' }
  }
}

export function listCraftActions(data: CraftDataset, state: CraftItemState | null): CraftAction[] {
  const pools = poolActions(state)
  if (!state) {
    return [
      ...pools,
      {
        id: 'currency:Chaos Orb',
        label: 'Chaos Orb',
        description: 'Reroll all modifiers on a Rare item.',
        applies: false,
        reason: 'Import an item first.',
      },
    ]
  }

  const currencies = data.currencies ?? []
  const currencyActions: CraftAction[] = currencies.map((cur) => {
    const sim = simKeyForCurrency(cur.name, cur.cat)
    const { applies, reason } = appliesForSim(sim, state, cur, data)
    return {
      id: slug(cur.name),
      label: cur.name,
      description: cur.desc,
      applies,
      reason,
      simKey: sim ?? undefined,
      category: cur.cat,
    }
  })

  const boneActions: CraftAction[] = DESECRATION_BONES.map((bone) => {
    const reason = boneAppliesToBase(bone, state, data)
    return {
      id: `desecration:${bone.id}`,
      label: bone.name,
      description: bone.desc,
      applies: !reason,
      reason: reason ?? undefined,
      simKey: 'desecration',
      category: 'desecration',
    }
  })

  return [...pools, ...currencyActions, ...boneActions]
}

export function modPoolToOutcomes(
  pool: Array<CraftMod & { weight: number }>,
  kind: 'all' | 'p' | 's' = 'all',
): import('./types').CraftOutcome[] {
  const sections = poolToSections(pool, kind)
  return groupedOutcomesToFlat(sections.flatMap((s) => s.groups))
}

export function buildPoolForMode(
  data: CraftDataset,
  state: CraftItemState,
  mode: 'chaos' | 'exalt' | 'all' | 'prefix' | 'suffix',
): Array<CraftMod & { weight: number }> {
  const tags = rollTagsForState(state)
  if (mode === 'exalt') {
    return allEligibleForExalt(data, state, { maxPrefix: 3, maxSuffix: 3 })
  }
  const kinds: GenKind[] = mode === 'prefix' ? ['p'] : mode === 'suffix' ? ['s'] : ['p', 's']
  const blocked = new Set<string>()
  const pool: Array<CraftMod & { weight: number }> = []
  for (const kind of kinds) {
    pool.push(
      ...eligibleMods(data, tags, state.itemLevel, kind, blocked, {
        maxPrefix: 3,
        maxSuffix: 3,
        prefixCount: 0,
        suffixCount: 0,
        baseType: state.baseType,
      }),
    )
  }
  const seen = new Set<string>()
  return pool.filter((m) => {
    if (seen.has(m.id)) return false
    seen.add(m.id)
    return true
  })
}

export function resolveSimActionId(actionId: string, data: CraftDataset): string {
  if (actionId.startsWith('pool:') || ['chaos', 'exalt', 'annul', 'alteration', 'transmutation', 'augmentation', 'regal', 'alchemy', 'scouring'].includes(actionId)) {
    return actionId
  }
  if (actionId.startsWith('currency:')) {
    const name = actionId.slice('currency:'.length)
    const cur = data.currencies?.find((c) => c.name === name)
    return simKeyForCurrency(name, cur?.cat) ?? actionId
  }
  if (actionId.startsWith('essence:')) return actionId
  return actionId
}

export function labelForActionId(actionId: string, data: CraftDataset): string {
  if (actionId.startsWith('pool:')) {
    if (actionId === 'pool:chaos') return 'Mod pool · chaos reroll'
    if (actionId === 'pool:exalt') return 'Mod pool · exalt add'
    if (actionId === 'pool:all') return 'Mod pool · all affixes'
    return actionId
  }
  if (actionId.startsWith('currency:')) return actionId.slice('currency:'.length)
  const map: Record<string, string> = {
    chaos: 'Chaos Orb',
    exalt: 'Exalted Orb',
    annul: 'Orb of Annulment',
    alteration: 'Orb of Alteration',
    transmutation: 'Orb of Transmutation',
    augmentation: 'Orb of Augmentation',
    regal: 'Regal Orb',
    alchemy: 'Orb of Alchemy',
    scouring: 'Orb of Scouring',
  }
  if (map[actionId]) return map[actionId]
  if (actionId.startsWith('essence:')) return actionId.slice('essence:'.length)
  if (actionId.startsWith('desecration:')) {
    const bone = DESECRATION_BONES.find((b) => `desecration:${b.id}` === actionId)
    return bone?.name ?? actionId.slice('desecration:'.length)
  }
  return actionId
}

export function currencyDescription(data: CraftDataset, actionId: string): string | undefined {
  if (!actionId.startsWith('currency:')) return undefined
  const name = actionId.slice('currency:'.length)
  return data.currencies?.find((c) => c.name === name)?.desc
}

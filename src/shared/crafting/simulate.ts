import {
  buildPoolForMode,
  currencyDescription,
  labelForActionId,
  listCraftActions,
  modPoolToOutcomes,
  resolveSimActionId,
} from './actions'
import { allEligibleForExalt, buildItemTags, countByKind, rollTagsForState } from './pool'
import { tierFloorForCurrency } from './currency-rules'
import { pickGroupThenTier } from './group-pool'
import { essenceForcedMod } from './essence'
import {
  cloneItemState,
  DEFAULT_MOD_COUNT_WEIGHTS,
  makeRng,
  pickNextKind,
  rollFreshMagic,
  rollMods,
  rollOneExaltMod,
  rollOneMod,
} from './roll'
import type {
  CraftDataset,
  CraftEngineOptions,
  CraftItemState,
  CraftMod,
  CraftSimulationResult,
} from './types'

export { listCraftActions } from './actions'

const DEFAULT_OPTS: Required<CraftEngineOptions> = {
  maxPrefix: 3,
  maxSuffix: 3,
  maxMods: 6,
  modCountWeights: DEFAULT_MOD_COUNT_WEIGHTS,
  samples: 2500,
}

function mergeOpts(opts?: CraftEngineOptions): Required<CraftEngineOptions> {
  return { ...DEFAULT_OPTS, ...opts }
}

function aggregateMods(counts: Map<string, { mod: CraftMod; hits: number }>, mods: CraftMod[]): void {
  for (const mod of mods) {
    const prev = counts.get(mod.id)
    if (prev) prev.hits++
    else counts.set(mod.id, { mod, hits: 1 })
  }
}

function toOutcomes(counts: Map<string, { mod: CraftMod; hits: number }>, samples: number, minProb = 0.0005, limit = 200): CraftSimulationResult['outcomes'] {
  return [...counts.values()]
    .map(({ mod, hits }) => ({
      text: mod.t || mod.n || mod.g,
      group: mod.g,
      kind: mod.k,
      probability: hits / samples,
    }))
    .filter((o) => o.probability >= minProb)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, limit)
}

export function simulateCraft(
  data: CraftDataset,
  state: CraftItemState,
  actionId: string,
  opts?: CraftEngineOptions,
): CraftSimulationResult {
  const o = mergeOpts(opts)
  const label = labelForActionId(actionId, data)
  const tierFloor = actionId.startsWith('currency:') ? tierFloorForCurrency(actionId.slice('currency:'.length)) : 0
  const weightNote = data.source === 'coe' ? 'Scalpel Lab per-base weightings.' : 'RePoE spawn weights.'
  const rng = makeRng(0x9e3779b9)

  if (actionId === 'pool:chaos') {
    const pool = buildPoolForMode(data, state, 'all')
    return {
      actionId,
      label,
      samples: pool.length,
      outcomes: modPoolToOutcomes(pool, 'all'),
      note: 'Group → tier odds for one random affix on a fresh chaos reroll (ignores groups already on item).',
    }
  }
  if (actionId === 'pool:exalt') {
    const pool = buildPoolForMode(data, state, 'exalt')
    return {
      actionId,
      label,
      samples: pool.length,
      outcomes: modPoolToOutcomes(pool, 'all'),
      note: 'Group → tier odds for one exalt add on this item now (respects tags, groups, open slots).',
    }
  }
  if (actionId === 'pool:all') {
    const pool = buildPoolForMode(data, state, 'all')
    return {
      actionId,
      label,
      samples: pool.length,
      outcomes: modPoolToOutcomes(pool, 'all'),
      note: 'Group → tier odds by prefix/suffix pool on this base at this item level.',
    }
  }

  const sim = resolveSimActionId(actionId, data)

  if (sim === 'alchemy') {
    const modHits = new Map<string, { mod: CraftMod; hits: number }>()
    for (let i = 0; i < o.samples; i++) {
      const rolled = rollMods(data, state, 4, 3, 3, new Set(), rollTagsForState(state), rng, tierFloor)
      aggregateMods(modHits, rolled)
    }
    return {
      actionId,
      label,
      samples: o.samples,
      outcomes: toOutcomes(modHits, o.samples, 0.0005, 300),
      note: `Normal/Magic → Rare with 4 modifiers. ${weightNote}`,
    }
  }

  if (sim === 'chaos') {
    const modHits = new Map<string, { mod: CraftMod; hits: number }>()
    for (let i = 0; i < o.samples; i++) {
      const trial = cloneItemState(state)
      if (trial.mods.length === 0) continue
      trial.mods.splice(Math.floor(rng() * trial.mods.length), 1)
      const picked = rollOneExaltMod(data, trial, rng, tierFloor)
      if (picked) aggregateMods(modHits, [picked])
    }
    return {
      actionId,
      label,
      samples: o.samples,
      outcomes: toOutcomes(modHits, o.samples, 0.0005, 300),
      note: `PoE2 chaos: removes one random mod and adds one new mod. ${weightNote}${tierFloor ? ` Tier floor iLvl ${tierFloor}.` : ''}`,
    }
  }

  if (sim === 'exalt' || sim === 'regal') {
    const modHits = new Map<string, { mod: CraftMod; hits: number }>()
    for (let i = 0; i < o.samples; i++) {
      const pool = allEligibleForExalt(data, state, { maxPrefix: o.maxPrefix, maxSuffix: o.maxSuffix, tierFloor })
      const picked = pickGroupThenTier(pool, rng)
      if (picked) aggregateMods(modHits, [picked])
    }
    return {
      actionId,
      label,
      samples: o.samples,
      outcomes: toOutcomes(modHits, o.samples, 0.0005, 300),
      note:
        sim === 'regal'
          ? 'Regal keeps your magic mods and adds one random mod (same pool as exalt on the upgraded rare).'
          : `One added mod, respecting current tags, groups, and open prefix/suffix slots. ${weightNote}${tierFloor ? ` Tier floor iLvl ${tierFloor}.` : ''}`,
    }
  }

  if (sim === 'annul') {
    const n = state.mods.length
    const p = 1 / n
    return {
      actionId,
      label,
      samples: n,
      outcomes: state.mods.map((m) => ({
        text: m.text,
        group: m.group,
        kind: m.kind,
        probability: p,
      })),
      note: 'Annul removes one random mod with equal chance per mod.',
    }
  }

  if (sim === 'alteration') {
    const modHits = new Map<string, { mod: CraftMod; hits: number }>()
    for (let i = 0; i < o.samples; i++) {
      aggregateMods(modHits, rollFreshMagic(data, state, rng, tierFloor))
    }
    return {
      actionId,
      label,
      samples: o.samples,
      outcomes: toOutcomes(modHits, o.samples, 0.0005, 300),
      note: `Rerolls all magic modifiers (1–2 mods). ${weightNote}`,
    }
  }

  if (sim === 'transmutation') {
    const modHits = new Map<string, { mod: CraftMod; hits: number }>()
    for (let i = 0; i < o.samples; i++) {
      aggregateMods(modHits, rollMods(data, state, 1, 1, 1, new Set(), rollTagsForState(state), rng, tierFloor))
    }
    return {
      actionId,
      label,
      samples: o.samples,
      outcomes: toOutcomes(modHits, o.samples, 0.0005, 300),
      note: 'Normal → Magic with one random modifier.',
    }
  }

  if (sim === 'augmentation') {
    const blocked = new Set(state.mods.map((m) => m.group))
    const tags = buildItemTags(data, state)
    for (const m of state.mods) {
      const line = m.text
      // tags from existing mods already reflected in groups; base tags enough for v1
      void line
    }
    const counts = countByKind(state.mods)
    const modHits = new Map<string, { mod: CraftMod; hits: number }>()
    for (let i = 0; i < o.samples; i++) {
      const kind = pickNextKind(counts.p, counts.s, 1, 1, rng)
      if (!kind) continue
      const mod = rollOneMod(data, tags, state.itemLevel, kind, blocked, counts.p, counts.s, 1, 1, rng, state.baseType, tierFloor)
      if (mod) aggregateMods(modHits, [mod])
    }
    return {
      actionId,
      label,
      samples: o.samples,
      outcomes: toOutcomes(modHits, o.samples, 0.0005, 300),
      note: 'Adds one magic modifier to a magic item that has only one mod.',
    }
  }

  if (sim === 'scouring') {
    return {
      actionId,
      label,
      samples: 0,
      outcomes: [],
      note: 'Scouring removes all modifiers and resets rarity to Normal — no random mod roll.',
    }
  }

  if (sim.startsWith('essence:')) {
    const essenceName = sim.slice('essence:'.length)
    const forced = essenceForcedMod(data, essenceName, state.baseType)
    if (!forced) {
      return {
        actionId,
        label,
        samples: 0,
        outcomes: [],
        note: 'This essence does not apply to this base type.',
      }
    }
    return {
      actionId,
      label,
      samples: 1,
      outcomes: [
        {
          text: forced.text,
          group: forced.group,
          kind: forced.kind,
          probability: 1,
          ilvl: forced.ilvl,
        },
      ],
      note: 'Essence guarantees this modifier on a Magic item. Other magic mods are replaced.',
    }
  }

  if (sim === 'divine') {
    return {
      actionId,
      label,
      samples: 0,
      outcomes: state.mods.map((m) => ({
        text: m.text,
        group: m.group,
        kind: m.kind,
        probability: 1,
      })),
      note: 'Divine Orb randomises numeric values within each modifier\'s range — mod lines stay the same.',
    }
  }

  if (sim === 'vaal') {
    return {
      actionId,
      label,
      samples: 0,
      outcomes: [],
      note: 'Vaal Orb corrupts unpredictably (extra mods, white sockets, destroy item, etc.) — not modeled as fixed odds.',
    }
  }

  if (sim === 'fracture') {
    const n = state.mods.length
    const p = 1 / n
    return {
      actionId,
      label,
      samples: n,
      outcomes: state.mods.map((m) => ({
        text: m.text,
        group: m.group,
        kind: m.kind,
        probability: p,
      })),
      note: 'Fracturing Orb locks one random modifier (equal chance per mod).',
    }
  }

  if (actionId.startsWith('currency:')) {
    return {
      actionId,
      label,
      samples: 0,
      outcomes: [],
      note: currencyDescription(data, actionId) ?? 'Exact odds not modeled for this currency yet.',
    }
  }

  throw new Error(`Unknown craft action: ${actionId}`)
}

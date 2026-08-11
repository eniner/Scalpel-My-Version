import {
  buildPoolForMode,
  currencyDescription,
  labelForActionId,
  listCraftActions,
  modPoolToOutcomes,
  resolveSimActionId,
} from './actions'
import { buildItemTags, countByKind, rollTagsForState } from './pool'
import { tierFloorForCurrency } from './currency-rules'
import { essenceForcedMod } from './essence'
import { resolveOmenEffect, simKeyToOmenMethod, validateOmens } from './omens'
import {
  cloneItemState,
  DEFAULT_MOD_COUNT_WEIGHTS,
  makeRng,
  pickNextKind,
  pickRemovableModIndex,
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
  omens: [],
}

function mergeOpts(opts?: CraftEngineOptions): Required<CraftEngineOptions> {
  return {
    ...DEFAULT_OPTS,
    ...opts,
    omens: opts?.omens ?? DEFAULT_OPTS.omens,
    modCountWeights: opts?.modCountWeights ?? DEFAULT_OPTS.modCountWeights,
  }
}

function withOmens(state: CraftItemState, omens: string[]): CraftItemState {
  if (!omens.length && !state.activeOmens?.length) return state
  return { ...state, activeOmens: omens.length ? omens : state.activeOmens }
}

function aggregateMods(counts: Map<string, { mod: CraftMod; hits: number }>, mods: CraftMod[]): void {
  for (const mod of mods) {
    const prev = counts.get(mod.id)
    if (prev) prev.hits++
    else counts.set(mod.id, { mod, hits: 1 })
  }
}

function toOutcomes(
  counts: Map<string, { mod: CraftMod; hits: number }>,
  samples: number,
  minProb = 0.0005,
  limit = 200,
): CraftSimulationResult['outcomes'] {
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

function omenNote(omens: string[], method: string | null): string {
  if (!method || !omens.length) return ''
  const effect = resolveOmenEffect(omens, method)
  if (!effect.consume.length) return ''
  return ` Omens: ${effect.consume.join(', ')}.`
}

export function simulateCraft(
  data: CraftDataset,
  state: CraftItemState,
  actionId: string,
  opts?: CraftEngineOptions,
): CraftSimulationResult {
  const o = mergeOpts(opts)
  const label = labelForActionId(actionId, data)
  const tierFloor = actionId.startsWith('currency:')
    ? tierFloorForCurrency(actionId.slice('currency:'.length))
    : 0
  const weightNote =
    data.source === 'coe'
      ? 'CoE per-base weights · craft pool excludes desecrated (mgroup 10).'
      : 'RePoE spawn weights.'
  const rng = makeRng(0x9e3779b9)
  const item = withOmens(state, o.omens)
  const omens = item.activeOmens ?? []

  if (actionId === 'pool:chaos') {
    const pool = buildPoolForMode(data, item, 'all')
    return {
      actionId,
      label,
      samples: pool.length,
      outcomes: modPoolToOutcomes(pool, 'all'),
      note: 'Group → tier odds for one random affix on a fresh chaos reroll (ignores groups already on item).',
    }
  }
  if (actionId === 'pool:exalt') {
    const pool = buildPoolForMode(data, item, 'exalt')
    return {
      actionId,
      label,
      samples: pool.length,
      outcomes: modPoolToOutcomes(pool, 'all'),
      note: 'Group → tier odds for one exalt add on this item now (respects tags, groups, open slots).',
    }
  }
  if (actionId === 'pool:all') {
    const pool = buildPoolForMode(data, item, 'all')
    return {
      actionId,
      label,
      samples: pool.length,
      outcomes: modPoolToOutcomes(pool, 'all'),
      note: 'Group → tier odds by prefix/suffix pool on this base at this item level.',
    }
  }

  const sim = resolveSimActionId(actionId, data)
  const omenMethod = simKeyToOmenMethod(sim)
  if (omenMethod && omens.length) {
    const err = validateOmens(omens, omenMethod)
    if (err) {
      return { actionId, label, samples: 0, outcomes: [], note: err }
    }
  }
  const omen = omenMethod ? resolveOmenEffect(omens, omenMethod) : null

  if (sim === 'alchemy') {
    const modHits = new Map<string, { mod: CraftMod; hits: number }>()
    for (let i = 0; i < o.samples; i++) {
      // CoE PoE2 alchemy always forces 4 mods (forcenum=4).
      const rolled = rollMods(data, item, 4, 3, 3, new Set(), rollTagsForState(item), rng, tierFloor)
      aggregateMods(modHits, rolled)
    }
    return {
      actionId,
      label,
      samples: o.samples,
      outcomes: toOutcomes(modHits, o.samples, 0.0005, 300),
      modCountChances: [{ count: 4, probability: 1 }],
      note: `Normal/Magic → Rare with 4 modifiers (CoE PoE2 alchemy). ${weightNote}`,
    }
  }

  if (sim === 'chaos') {
    const modHits = new Map<string, { mod: CraftMod; hits: number }>()
    let valid = 0
    for (let i = 0; i < o.samples; i++) {
      const trial = cloneItemState(item)
      if (trial.mods.length === 0) continue
      const removeIdx = pickRemovableModIndex(trial, rng, {
        kind: omen?.removeKind,
        desecratedOnly: omen?.removeDesecratedOnly,
        lowestLevel: omen?.removeLowestLevel,
        data,
      })
      if (removeIdx < 0) continue
      trial.mods.splice(removeIdx, 1)
      const picked = rollOneExaltMod(data, trial, rng, tierFloor)
      if (picked) {
        valid++
        aggregateMods(modHits, [picked])
      }
    }
    const samples = valid || o.samples
    return {
      actionId,
      label,
      samples,
      outcomes: toOutcomes(modHits, samples, 0.0005, 300),
      note: `PoE2 chaos: removes one mod and adds one new mod. ${weightNote}${tierFloor ? ` Tier floor iLvl ${tierFloor}.` : ''}${omenNote(omens, 'chaos')}`,
    }
  }

  if (sim === 'exalt' || sim === 'regal') {
    const modHits = new Map<string, { mod: CraftMod; hits: number }>()
    let valid = 0
    const addCount = omen?.addCount ?? 1
    for (let i = 0; i < o.samples; i++) {
      const trial = cloneItemState(item)
      const added: CraftMod[] = []
      for (let n = 0; n < addCount; n++) {
        const picked = rollOneExaltMod(data, trial, rng, tierFloor, omen?.addKind, {
          homogenise: omen?.homogenise,
        })
        if (!picked) break
        trial.mods.push({
          group: picked.g,
          kind: picked.k,
          text: picked.t,
          name: picked.n,
          bindGroups: picked.bg?.length ? picked.bg : [picked.g],
        })
        added.push(picked)
      }
      if (added.length) {
        valid++
        aggregateMods(modHits, added)
      }
    }
    const samples = valid || o.samples
    return {
      actionId,
      label,
      samples,
      outcomes: toOutcomes(modHits, samples, 0.0005, 300),
      note:
        sim === 'regal'
          ? `Regal keeps magic mods and adds one random mod.${omenNote(omens, 'regal')}`
          : `Added mod(s), respecting tags/groups/slots. ${weightNote}${tierFloor ? ` Tier floor iLvl ${tierFloor}.` : ''}${omenNote(omens, 'exalt')}`,
    }
  }

  if (sim === 'annul') {
    const removable = item.mods.filter((m) => !m.fractured && !m.veiled)
    const removeCount = omen?.removeCount ?? 1
    const simple =
      removeCount === 1 && !omen?.removeKind && !omen?.removeDesecratedOnly && removable.length > 0
    if (simple) {
      const p = 1 / removable.length
      return {
        actionId,
        label,
        samples: removable.length,
        outcomes: removable.map((m) => ({
          text: m.text,
          group: m.group,
          kind: m.kind,
          probability: p,
        })),
        note: `Annul removes one random removable mod (fractured locked).${omenNote(omens, 'annul')}`,
      }
    }

    const hits = new Map<string, number>()
    let valid = 0
    for (let s = 0; s < o.samples; s++) {
      const trial = cloneItemState(item)
      let removedAny = false
      for (let r = 0; r < removeCount && trial.mods.length; r++) {
        const idx = pickRemovableModIndex(trial, rng, {
          kind: omen?.removeKind,
          desecratedOnly: omen?.removeDesecratedOnly,
          data,
        })
        if (idx < 0) break
        const target = trial.mods[idx]
        const key = `${target.kind}|${target.group}|${target.text}`
        hits.set(key, (hits.get(key) ?? 0) + 1)
        trial.mods.splice(idx, 1)
        removedAny = true
      }
      if (removedAny) valid++
    }
    const samples = valid || 1
    return {
      actionId,
      label,
      samples,
      outcomes: removable.map((m) => {
        const key = `${m.kind}|${m.group}|${m.text}`
        return {
          text: m.text,
          group: m.group,
          kind: m.kind,
          probability: (hits.get(key) ?? 0) / samples,
        }
      }),
      note: `Annul removes ${removeCount} random removable mod(s) (fractured locked).${omenNote(omens, 'annul')}`,
    }
  }

  if (sim === 'alteration') {
    const modHits = new Map<string, { mod: CraftMod; hits: number }>()
    for (let i = 0; i < o.samples; i++) {
      aggregateMods(modHits, rollFreshMagic(data, item, rng, tierFloor))
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
      aggregateMods(modHits, rollMods(data, item, 1, 1, 1, new Set(), rollTagsForState(item), rng, tierFloor))
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
    const blocked = new Set(item.mods.map((m) => m.group))
    const tags = buildItemTags(data, item)
    const counts = countByKind(item.mods)
    const modHits = new Map<string, { mod: CraftMod; hits: number }>()
    for (let i = 0; i < o.samples; i++) {
      const kind = pickNextKind(counts.p, counts.s, 1, 1, rng)
      if (!kind) continue
      const mod = rollOneMod(
        data,
        tags,
        item.itemLevel,
        kind,
        blocked,
        counts.p,
        counts.s,
        1,
        1,
        rng,
        item.baseType,
        tierFloor,
      )
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
    const forced = essenceForcedMod(data, essenceName, item.baseType)
    if (!forced) {
      return {
        actionId,
        label,
        samples: 0,
        outcomes: [],
        note: 'This essence does not apply to this base type.',
      }
    }
    const perfect = /perfect|alloy/i.test(essenceName)
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
      note: perfect
        ? `Perfect essence / alloy swaps one mod for this guarantee on a Rare.${omenNote(omens, 'poe2_perfect_essence')}`
        : 'Essence guarantees this modifier when applied to a Magic item.',
    }
  }

  if (sim === 'divine') {
    return {
      actionId,
      label,
      samples: 0,
      outcomes: item.mods.map((m) => ({
        text: m.text,
        group: m.group,
        kind: m.kind,
        probability: 1,
      })),
      note: "Divine Orb re-rolls numeric values within each modifier's stored CoE range (use Emulator to see new rolls).",
    }
  }

  if (sim === 'catalyst') {
    return {
      actionId,
      label,
      samples: 0,
      outcomes: [],
      note: 'Catalyst sets the active quality tag boost for subsequent crafts (weights × 1+Q%).',
    }
  }

  if (sim === 'artificer') {
    return {
      actionId,
      label,
      samples: 0,
      outcomes: [],
      note: "Artificer's Orb adds a socket up to the base's max, then rerolls when full.",
    }
  }

  if (sim === 'vaal') {
    return {
      actionId,
      label,
      samples: 0,
      outcomes: [],
      note: 'Vaal Orb corrupts with simplified outcomes (remove mod / add mod / no-op) — not full Vaal tables.',
    }
  }

  if (sim === 'fracture') {
    const candidates = item.mods.filter((m) => !m.fractured && !m.veiled)
    const n = candidates.length
    const p = n ? 1 / n : 0
    return {
      actionId,
      label,
      samples: n,
      outcomes: candidates.map((m) => ({
        text: m.text,
        group: m.group,
        kind: m.kind,
        probability: p,
      })),
      note: 'Fracturing Orb locks one random modifier (equal chance per removable mod).',
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

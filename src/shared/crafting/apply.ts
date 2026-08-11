import { labelForActionId, resolveSimActionId } from './actions'
import { tierFloorForCurrency } from './currency-rules'
import {
  boneAppliesToBase,
  boneById,
  makeRevealChoices,
  pickVeiledKind,
  rollDesecrationChoices,
} from './desecration'
import { essenceForcedMod } from './essence'
import { consumeOmens, resolveOmenEffect, simKeyToOmenMethod, validateOmens } from './omens'
import { countByKind, getBaseTags, rollTagsForState } from './pool'
import {
  cloneItemState,
  craftModToItemMod,
  divineRerollMod,
  makeRng,
  pickRemovableModIndex,
  rollFreshMagic,
  rollMods,
  rollOneExaltMod,
} from './roll'
import { resolveCatalyst } from './catalyst'
import { canApplySocketable, resolveSocketable, socketableEffectText } from './socketable'
import type {
  CraftApplyOptions,
  CraftApplyResult,
  CraftDataset,
  CraftItemMod,
  CraftItemState,
} from './types'

function fail(state: CraftItemState, actionId: string, label: string, error: string): CraftApplyResult {
  return { ok: false, state, actionId, label, message: error, error }
}

function ok(
  state: CraftItemState,
  actionId: string,
  label: string,
  message: string,
  extra?: Pick<CraftApplyResult, 'added' | 'removed' | 'revealChoices' | 'consumedOmens'>,
): CraftApplyResult {
  return { ok: true, state, actionId, label, message, ...extra }
}

function isPerfectEssenceOrAlloy(name: string): boolean {
  const n = name.toLowerCase()
  return n.includes('perfect') || n.includes('alloy')
}

function forcedModItem(forced: NonNullable<ReturnType<typeof essenceForcedMod>>): CraftItemMod {
  return {
    group: forced.group,
    kind: forced.kind,
    text: forced.text,
    name: forced.name,
    bindGroups: [forced.group],
  }
}

function mergeOmens(state: CraftItemState, opts?: CraftApplyOptions): string[] {
  return [...new Set([...(state.activeOmens ?? []), ...(opts?.omens ?? [])])]
}

function applyOmenConsume(state: CraftItemState, consumed: string[]): CraftItemState {
  const next = cloneItemState(state)
  next.activeOmens = consumeOmens(next.activeOmens, consumed)
  return next
}

export function createFreshItemState(
  data: CraftDataset,
  baseType: string,
  itemLevel: number,
  opts?: { marksmanEnabled?: boolean; quality?: number; catalyst?: string },
): CraftItemState | null {
  const tags = getBaseTags(data, baseType)
  if (!tags) return null
  const base = data.bases[baseType]
  return {
    baseType,
    itemLevel: Math.max(1, itemLevel),
    rarity: 'Normal',
    tags,
    itemClass: base.c,
    corrupted: false,
    mods: [],
    activeOmens: [],
    quality: opts?.quality ?? 20,
    sockets: 0,
    socketed: [],
    ...(opts?.catalyst ? { catalyst: opts.catalyst } : {}),
    ...(opts?.marksmanEnabled ? { marksmanEnabled: true } : {}),
  }
}

function applyDesecrationReveal(
  data: CraftDataset,
  state: CraftItemState,
  actionId: string,
  opts: CraftApplyOptions | undefined,
  seed: number | undefined,
): CraftApplyResult {
  const label = 'Reveal desecrated mod'
  const choices = state.revealChoices
  if (!choices) return fail(state, actionId, label, 'No desecration choices to reveal.')

  if (opts?.rerollReveal) {
    if (choices.rerollsLeft <= 0) return fail(state, actionId, label, 'No rerolls remaining.')
    const rng = makeRng(seed)
    const newMods = rollDesecrationChoices(
      data,
      state,
      choices.veiledKind,
      0,
      resolveOmenEffect([], 'desecration'),
      rng,
    )
    const next = cloneItemState(state)
    next.revealChoices = makeRevealChoices(newMods, choices.veiledKind, choices.rerollsLeft - 1)
    return ok(next, actionId, label, `Rerolled desecration choices (${next.revealChoices.rerollsLeft} reroll(s) left).`, {
      revealChoices: next.revealChoices,
    })
  }

  const pick = opts?.pickIndex
  if (pick == null || pick < 0 || pick >= choices.mods.length) {
    return fail(state, actionId, label, 'Pick a desecration mod (0–2).')
  }

  const picked = choices.mods[pick]
  const next = cloneItemState(state)
  const veiledIdx = next.mods.findIndex((m) => m.veiled)
  if (veiledIdx >= 0) next.mods.splice(veiledIdx, 1)
  next.mods.push({ ...picked, veiled: false })
  next.revealChoices = undefined
  return ok(next, actionId, label, `Revealed ${picked.text}`, { added: [picked] })
}

function applyDesecrationBone(
  data: CraftDataset,
  state: CraftItemState,
  boneId: string,
  seed: number | undefined,
  opts?: CraftApplyOptions,
): CraftApplyResult {
  const bone = boneById(boneId)
  if (!bone) return fail(state, `desecration:${boneId}`, boneId, 'Unknown bone type.')

  const label = bone.name
  const reason = boneAppliesToBase(bone, state, data)
  if (reason) return fail(state, `desecration:${boneId}`, label, reason)

  const omens = mergeOmens(state, opts)
  const omenErr = validateOmens(omens, 'desecration')
  if (omenErr) return fail(state, `desecration:${boneId}`, label, omenErr)

  const omen = resolveOmenEffect(omens, 'desecration')
  const rng = makeRng(seed)
  const veiledKind = pickVeiledKind(state, omen.addKind, rng)
  if (!veiledKind) return fail(state, `desecration:${boneId}`, label, 'No open prefix or suffix slot for desecration.')

  let next = cloneItemState(state)
  const counts = countByKind(next.mods.filter((m) => !m.veiled))
  if (counts.p + counts.s >= 6) {
    const removeIdx = pickRemovableModIndex(next, rng, { kind: veiledKind, data })
    if (removeIdx < 0) return fail(state, `desecration:${boneId}`, label, 'No removable modifier (fractured?).')
    next.mods.splice(removeIdx, 1)
  }

  const minModLevel = bone.minModLevel ?? 0
  const choices = rollDesecrationChoices(data, next, veiledKind, minModLevel, omen, rng)
  if (!choices.length) return fail(state, `desecration:${boneId}`, label, 'Could not roll desecration options.')

  const veiled: CraftItemMod = {
    group: 'Desecrated',
    kind: veiledKind,
    text: 'Desecrated Modifier (pick one)',
    veiled: true,
  }
  next.mods.push(veiled)
  next.revealChoices = makeRevealChoices(choices, veiledKind, omen.desecRerolls ?? 0)
  next = applyOmenConsume(next, omen.consume)

  return ok(next, `desecration:${boneId}`, label, `Desecrated — pick 1 of ${choices.length} modifier(s).`, {
    revealChoices: next.revealChoices,
    consumedOmens: omen.consume,
  })
}

export function applyCraftAction(
  data: CraftDataset,
  state: CraftItemState,
  actionId: string,
  seed?: number,
  opts?: CraftApplyOptions,
): CraftApplyResult {
  if (actionId === 'desecration:reveal') {
    return applyDesecrationReveal(data, state, actionId, opts, seed)
  }
  if (actionId.startsWith('desecration:')) {
    const boneId = actionId.slice('desecration:'.length)
    if (boneId !== 'reveal') return applyDesecrationBone(data, state, boneId, seed, opts)
  }
  if (actionId.startsWith('socketable:')) {
    const sid = actionId.slice('socketable:'.length)
    const entry = resolveSocketable(data, sid)
    const label = entry?.name ?? sid
    if (!entry) return fail(state, actionId, label, 'Unknown socketable.')
    const reason = canApplySocketable(data, state, entry)
    if (reason) return fail(state, actionId, label, reason)
    const next = cloneItemState(state)
    next.socketed = [...(next.socketed ?? []), entry.name]
    const effect = socketableEffectText(entry, next)
    return ok(next, actionId, label, `Socketed ${entry.name}: ${effect}`)
  }

  const label = labelForActionId(actionId, data)
  const sim = resolveSimActionId(actionId, data)
  const tierFloor = actionId.startsWith('currency:') ? tierFloorForCurrency(actionId.slice('currency:'.length)) : 0
  const rng = makeRng(seed)
  const next = cloneItemState(state)
  const omens = mergeOmens(state, opts)
  const omenMethod = simKeyToOmenMethod(sim)
  if (omenMethod) {
    const omenErr = validateOmens(omens, omenMethod)
    if (omenErr) return fail(state, actionId, label, omenErr)
  }
  const omen = omenMethod ? resolveOmenEffect(omens, omenMethod) : null

  if (sim.startsWith('pool:')) {
    return fail(state, actionId, label, 'Mod pool views are lookup-only — pick a currency.')
  }

  if (sim === 'transmutation') {
    if (next.rarity !== 'Normal') return fail(state, actionId, label, 'Only applies to Normal items.')
    const rolled = rollMods(data, next, 1, 1, 1, new Set(), rollTagsForState(next), rng, tierFloor)
    if (!rolled.length) return fail(state, actionId, label, 'No valid modifier could roll on this base.')
    next.rarity = 'Magic'
    next.mods = rolled.map((m) => craftModToItemMod(m, rng))
    return ok(next, actionId, label, `Magic item with ${next.mods[0].text}`, { added: next.mods })
  }

  if (sim === 'augmentation') {
    if (next.rarity !== 'Magic') return fail(state, actionId, label, 'Only applies to Magic items.')
    if (next.mods.length >= 2) return fail(state, actionId, label, 'Magic item already has two modifiers.')
    if (next.mods.length === 0) return fail(state, actionId, label, 'Use Transmutation first.')
    const mod = rollOneExaltMod(data, next, rng, tierFloor)
    if (!mod) return fail(state, actionId, label, 'No open prefix or suffix slot for a new mod.')
    const added = craftModToItemMod(mod, rng)
    next.mods.push(added)
    return ok(next, actionId, label, `Added ${added.text}`, { added: [added] })
  }

  if (sim === 'alteration') {
    if (next.rarity !== 'Magic') return fail(state, actionId, label, 'Only applies to Magic items.')
    const rolled = rollFreshMagic(data, next, rng, tierFloor)
    if (!rolled.length) return fail(state, actionId, label, 'No valid magic modifiers on this base.')
    const removed = [...next.mods]
    next.mods = rolled.map((m) => craftModToItemMod(m, rng))
    return ok(next, actionId, label, `Rerolled to ${next.mods.length} magic mod(s)`, { added: next.mods, removed })
  }

  if (sim === 'regal') {
    if (next.rarity !== 'Magic') return fail(state, actionId, label, 'Only applies to Magic items.')
    const mod = rollOneExaltMod(data, next, rng, tierFloor, omen?.addKind, { homogenise: omen?.homogenise })
    if (!mod) return fail(state, actionId, label, 'No open prefix or suffix slot for regal add.')
    const added = craftModToItemMod(mod, rng)
    next.rarity = 'Rare'
    next.mods.push(added)
    const out = applyOmenConsume(next, omen?.consume ?? [])
    return ok(out, actionId, label, `Rare item — added ${added.text}`, {
      added: [added],
      consumedOmens: omen?.consume,
    })
  }

  if (sim === 'alchemy') {
    if (next.rarity !== 'Normal' && next.rarity !== 'Magic') {
      return fail(state, actionId, label, 'Only applies to Normal or Magic items.')
    }
    // CoE PoE2 alchemy: poec_simRerollItem(..., forcenum=4) — always 4 mods.
    const rolled = rollMods(data, next, 4, 3, 3, new Set(), rollTagsForState(next), rng, tierFloor)
    if (rolled.length < 4) return fail(state, actionId, label, 'Could not roll four rare modifiers on this base.')
    const removed = [...next.mods]
    next.rarity = 'Rare'
    next.mods = rolled.map((m) => craftModToItemMod(m, rng))
    return ok(next, actionId, label, `Rare item with ${next.mods.length} modifiers`, { added: next.mods, removed })
  }

  if (sim === 'chaos') {
    if (next.rarity !== 'Rare') return fail(state, actionId, label, 'Only applies to Rare items.')
    if (next.mods.length === 0) return fail(state, actionId, label, 'Item has no modifiers to swap.')
    const removeIdx = pickRemovableModIndex(next, rng, {
      kind: omen?.removeKind,
      desecratedOnly: omen?.removeDesecratedOnly,
      lowestLevel: omen?.removeLowestLevel,
      data,
    })
    if (removeIdx < 0) return fail(state, actionId, label, 'No removable modifier (fractured?).')
    const removed = [next.mods[removeIdx]]
    next.mods.splice(removeIdx, 1)
    const mod = rollOneExaltMod(data, next, rng, tierFloor)
    if (!mod) {
      return fail(state, actionId, label, 'Removed a mod but nothing could be added — item may be full or blocked.')
    }
    const added = craftModToItemMod(mod, rng)
    next.mods.push(added)
    const out = applyOmenConsume(next, omen?.consume ?? [])
    return ok(out, actionId, label, `Removed ${removed[0].text} → added ${added.text}`, {
      added: [added],
      removed,
      consumedOmens: omen?.consume,
    })
  }

  if (sim === 'exalt') {
    if (next.rarity !== 'Rare') return fail(state, actionId, label, 'Only applies to Rare items.')
    const addCount = omen?.addCount ?? 1
    const added: CraftItemMod[] = []
    for (let i = 0; i < addCount; i++) {
      const mod = rollOneExaltMod(data, next, rng, tierFloor, omen?.addKind, { homogenise: omen?.homogenise })
      if (!mod) {
        if (i === 0) return fail(state, actionId, label, 'No open prefix or suffix slot.')
        break
      }
      const itemMod = craftModToItemMod(mod, rng)
      next.mods.push(itemMod)
      added.push(itemMod)
    }
    const out = applyOmenConsume(next, omen?.consume ?? [])
    return ok(out, actionId, label, `Added ${added.map((m) => m.text).join(', ')}`, {
      added,
      consumedOmens: omen?.consume,
    })
  }

  if (sim === 'annul') {
    if (next.mods.length === 0) return fail(state, actionId, label, 'Item has no modifiers.')
    const removeCount = omen?.removeCount ?? 1
    const removed: CraftItemMod[] = []
    for (let i = 0; i < removeCount && next.mods.length; i++) {
      const removeIdx = pickRemovableModIndex(next, rng, {
        kind: omen?.removeKind,
        desecratedOnly: omen?.removeDesecratedOnly,
        data,
      })
      if (removeIdx < 0) {
        if (i === 0) return fail(state, actionId, label, 'No removable modifier (fractured?).')
        break
      }
      removed.push(next.mods[removeIdx])
      next.mods.splice(removeIdx, 1)
    }
    if (next.rarity === 'Magic' && next.mods.length === 0) next.rarity = 'Normal'
    if (next.rarity === 'Rare' && next.mods.length === 0) next.rarity = 'Normal'
    const out = applyOmenConsume(next, omen?.consume ?? [])
    return ok(out, actionId, label, `Removed ${removed.map((m) => m.text).join(', ')}`, {
      removed,
      consumedOmens: omen?.consume,
    })
  }

  if (sim === 'scouring') {
    const removed = [...next.mods]
    next.mods = []
    next.rarity = 'Normal'
    next.revealChoices = undefined
    return ok(next, actionId, label, 'Item scoured to Normal.', { removed })
  }

  if (sim.startsWith('essence:')) {
    const essenceName = sim.slice('essence:'.length)
    const forced = essenceForcedMod(data, essenceName, next.baseType)
    if (!forced) return fail(state, actionId, label, 'This essence does not apply to this base.')

    const added = forcedModItem(forced)
    if (isPerfectEssenceOrAlloy(essenceName)) {
      if (next.rarity !== 'Rare') return fail(state, actionId, label, 'Perfect essences and alloys need a Rare item.')
      if (next.mods.length === 0) return fail(state, actionId, label, 'Item has no modifiers to swap.')
      const removeIdx = pickRemovableModIndex(next, rng, { kind: omen?.removeKind, data })
      if (removeIdx < 0) return fail(state, actionId, label, 'No removable modifier (fractured?).')
      const removed = [next.mods[removeIdx]]
      next.mods.splice(removeIdx, 1)
      next.mods.push(added)
      const out = applyOmenConsume(next, omen?.consume ?? [])
      return ok(out, actionId, label, `Removed ${removed[0].text} → added ${added.text}`, {
        added: [added],
        removed,
        consumedOmens: omen?.consume,
      })
    }

    if (next.rarity !== 'Magic') return fail(state, actionId, label, 'Essences apply to Magic items.')
    next.rarity = 'Rare'
    next.mods.push(added)
    return ok(next, actionId, label, `Rare item — added ${added.text}`, { added: [added] })
  }

  if (sim === 'divine') {
    if (next.mods.length === 0) return fail(state, actionId, label, 'Item has no modifiers.')
    next.mods = next.mods.map((m) => (m.fractured || m.veiled ? m : divineRerollMod(m, rng)))
    return ok(next, actionId, label, `Divine rerolled numeric values on ${next.mods.length} modifier(s).`)
  }

  if (sim === 'catalyst') {
    const name = actionId.startsWith('currency:') ? actionId.slice('currency:'.length) : label
    const cat = resolveCatalyst(data, name)
    if (!cat) return fail(state, actionId, label, `Unknown catalyst "${name}".`)
    next.catalyst = cat.name
    if (next.quality == null) next.quality = 20
    return ok(
      next,
      actionId,
      label,
      `Applied ${cat.name} catalyst (quality ${next.quality}%). Matching tags: ${cat.tags.join(', ') || 'none'}.`,
    )
  }

  if (sim === 'artificer') {
    if (next.corrupted) return fail(state, actionId, label, 'Cannot socket a corrupted item.')
    const max = data.maxSocketsByClass?.[next.itemClass] ?? 0
    if (max <= 0) return fail(state, actionId, label, 'This base cannot have sockets.')
    const prev = next.sockets ?? 0
    if (prev >= max) {
      next.socketed = []
      return ok(next, actionId, label, `Rerolled sockets (${max}/${max}).`)
    }
    next.sockets = prev + 1
    return ok(next, actionId, label, `Added a socket (${next.sockets}/${max}).`)
  }

  if (sim === 'fracture') {
    if (next.rarity !== 'Rare' || next.mods.length === 0) {
      return fail(state, actionId, label, 'Fracturing needs a Rare item with modifiers.')
    }
    const idx = Math.floor(rng() * next.mods.length)
    next.mods[idx] = { ...next.mods[idx], fractured: true }
    return ok(next, actionId, label, `Fractured ${next.mods[idx].text} (locked).`)
  }

  if (sim === 'vaal') {
    if (next.corrupted) return fail(state, actionId, label, 'Item is already corrupted.')
    next.corrupted = true
    const roll = rng()
    // Simplified PoE2-style outcomes for planning (not full Vaal tables).
    if (roll < 0.25 && next.mods.length > 0) {
      const idx = Math.floor(rng() * next.mods.length)
      const [removed] = next.mods.splice(idx, 1)
      return ok(next, actionId, label, `Corrupted — removed ${removed.text}.`, { removed: [removed] })
    }
    if (roll < 0.45) {
      const mod = rollOneExaltMod(data, next, rng, 0)
      if (mod) {
        const added = craftModToItemMod(mod, rng)
        next.mods.push(added)
        return ok(next, actionId, label, `Corrupted — added ${added.text}.`, { added: [added] })
      }
    }
    if (roll < 0.55 && next.rarity === 'Normal') {
      next.rarity = 'Rare'
      const rolled = rollMods(data, next, 4, 3, 3, new Set(), rollTagsForState(next), rng, 0)
      next.mods = rolled.map((m) => craftModToItemMod(m, rng))
      return ok(next, actionId, label, 'Corrupted — became Rare with new modifiers.', { added: next.mods })
    }
    return ok(next, actionId, label, 'Corrupted — no other change.')
  }

  if (actionId === 'omens:toggle') {
    const toggle = opts?.omens?.[0]
    if (!toggle) return fail(state, actionId, label, 'No omen specified.')
    const active = new Set(next.activeOmens ?? [])
    if (active.has(toggle)) active.delete(toggle)
    else active.add(toggle)
    next.activeOmens = [...active]
    return ok(next, actionId, label, active.has(toggle) ? `Activated Omen of ${toggle}` : `Deactivated ${toggle}`)
  }

  return fail(state, actionId, label, 'This currency is not supported in the emulator yet.')
}

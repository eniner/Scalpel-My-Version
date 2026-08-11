import type { CraftDataset, CraftItemState, CraftSocketableEntry } from './types'

const ARMOUR_CLASSES = new Set(['Body Armours', 'Boots', 'Gloves', 'Helmets', 'Offhands'])
const WEAPON_CLASSES = new Set(['One-Handed Weapons', 'Two-Handed Weapons'])
const CASTER_HINT = /staff|wand|sceptre|focus/i

export function resolveSocketable(data: CraftDataset, idOrName: string): CraftSocketableEntry | undefined {
  if (!data.socketables?.length) return undefined
  const q = idOrName.trim().toLowerCase()
  return data.socketables.find((s) => s.id === idOrName || s.name.toLowerCase() === q)
}

/** Pick CoE socketable mods key for this base. */
export function socketSlotKey(state: CraftItemState): string {
  const cls = state.itemClass || ''
  if (ARMOUR_CLASSES.has(cls)) return 'armour'
  if (WEAPON_CLASSES.has(cls)) {
    if (CASTER_HINT.test(state.baseType)) return 'caster'
    return 'weapons'
  }
  return 'all'
}

export function socketableEffectText(entry: CraftSocketableEntry, state: CraftItemState): string {
  const slot = socketSlotKey(state)
  const text = entry.texts?.[slot] || entry.texts?.all || entry.texts?.[Object.keys(entry.texts || {})[0] ?? '']
  if (text) return text
  const modId = entry.mods[slot] ?? entry.mods.all
  if (modId != null && modId !== '') return `${entry.name} (mod ${String(modId)})`
  return entry.name
}

export function canApplySocketable(
  data: CraftDataset,
  state: CraftItemState,
  entry: CraftSocketableEntry,
): string | null {
  if (state.corrupted) return 'Cannot socket a corrupted item.'
  const max = data.maxSocketsByClass?.[state.itemClass] ?? 0
  const sockets = state.sockets ?? 0
  if (max <= 0) return 'This base cannot have sockets.'
  if (sockets <= 0) return "Add a socket with Artificer's Orb first."
  const filled = state.socketed?.length ?? 0
  if (filled >= sockets) return 'All sockets are filled — use Artificer\'s Orb to reroll or add capacity.'
  const slot = socketSlotKey(state)
  const modId = entry.mods[slot] ?? entry.mods.all
  if (modId == null || modId === '') return `${entry.name} has no effect on this item type.`
  return null
}

import type { GenKind } from './types'

export interface OmenDef {
  id: string
  name: string
  desc: string
}

/** PoE2 omens from Craft of Exile (inventory-active, consumed on use). */
export const POE2_OMENS: OmenDef[] = [
  { id: 'dextral_annulment', name: 'Dextral Annulment', desc: 'Annul removes only suffix modifiers.' },
  { id: 'sinistral_annulment', name: 'Sinistral Annulment', desc: 'Annul removes only prefix modifiers.' },
  { id: 'greater_annulment', name: 'Greater Annulment', desc: 'Annul removes two modifiers.' },
  { id: 'light', name: 'Light', desc: 'Annul removes only desecrated modifiers.' },
  { id: 'dextral_coronation', name: 'Dextral Coronation', desc: 'Regal adds only a suffix.' },
  { id: 'sinistral_coronation', name: 'Sinistral Coronation', desc: 'Regal adds only a prefix.' },
  {
    id: 'homogenising_coronation',
    name: 'Homogenising Coronation',
    desc: 'Regal adds a mod matching existing mod types.',
  },
  { id: 'dextral_exaltation', name: 'Dextral Exaltation', desc: 'Exalt adds only a suffix.' },
  { id: 'sinistral_exaltation', name: 'Sinistral Exaltation', desc: 'Exalt adds only a prefix.' },
  { id: 'greater_exaltation', name: 'Greater Exaltation', desc: 'Exalt adds two modifiers.' },
  {
    id: 'homogenising_exaltation',
    name: 'Homogenising Exaltation',
    desc: 'Exalt adds a mod matching existing mod types.',
  },
  { id: 'dextral_erasure', name: 'Dextral Erasure', desc: 'Chaos removes only a suffix.' },
  { id: 'sinistral_erasure', name: 'Sinistral Erasure', desc: 'Chaos removes only a prefix.' },
  { id: 'whittling', name: 'Whittling', desc: 'Chaos removes the lowest-level modifier.' },
  { id: 'dextral_crystallisation', name: 'Dextral Crystallisation', desc: 'Perfect essence removes only a suffix.' },
  {
    id: 'sinistral_crystallisation',
    name: 'Sinistral Crystallisation',
    desc: 'Perfect essence removes only a prefix.',
  },
  { id: 'dextral_necromancy', name: 'Dextral Necromancy', desc: 'Desecration adds only a suffix.' },
  { id: 'sinistral_necromancy', name: 'Sinistral Necromancy', desc: 'Desecration adds only a prefix.' },
  { id: 'liege', name: 'the Liege', desc: 'Desecration guarantees an Amanamu desecrated mod.' },
  { id: 'sovereign', name: 'the Sovereign', desc: 'Desecration guarantees an Ulaman desecrated mod.' },
  { id: 'blackblooded', name: 'the Blackblooded', desc: 'Desecration guarantees a Kurgal desecrated mod.' },
  { id: 'abyssal_echoes', name: 'Abyssal Echoes', desc: 'Reroll desecration choices once.' },
  { id: 'blessed', name: 'the Blessed', desc: 'Divine rerolls only implicits (not modeled).' },
]

export const OMENS_FOR_METHOD: Record<string, string[]> = {
  annul: ['dextral_annulment', 'greater_annulment', 'sinistral_annulment', 'light'],
  regal: ['dextral_coronation', 'sinistral_coronation', 'homogenising_coronation'],
  chaos: ['whittling', 'sinistral_erasure', 'dextral_erasure'],
  exalt: ['sinistral_exaltation', 'dextral_exaltation', 'greater_exaltation', 'homogenising_exaltation'],
  poe2_perfect_essence: ['dextral_crystallisation', 'sinistral_crystallisation'],
  desecration: ['dextral_necromancy', 'sinistral_necromancy', 'liege', 'sovereign', 'blackblooded', 'abyssal_echoes'],
}

const OPPOSING_PAIRS: Array<[string, string]> = [
  ['dextral_annulment', 'sinistral_annulment'],
  ['dextral_coronation', 'sinistral_coronation'],
  ['dextral_exaltation', 'sinistral_exaltation'],
  ['dextral_erasure', 'sinistral_erasure'],
  ['dextral_crystallisation', 'sinistral_crystallisation'],
  ['dextral_necromancy', 'sinistral_necromancy'],
]

const NAMED_DESEC_OMENS = ['liege', 'sovereign', 'blackblooded']

export interface OmenEffect {
  addKind?: GenKind
  removeKind?: GenKind
  removeDesecratedOnly?: boolean
  removeLowestLevel?: boolean
  addCount?: number
  removeCount?: number
  homogenise?: boolean
  desecNamed?: 'liege' | 'sovereign' | 'blackblooded'
  desecRerolls?: number
  consume: string[]
}

function has(omens: string[], id: string): boolean {
  return omens.includes(id)
}

function filterForMethod(omens: string[], method: string): string[] {
  const allowed = OMENS_FOR_METHOD[method]
  if (!allowed) return []
  return omens.filter((o) => allowed.includes(o))
}

export function validateOmens(omens: string[], method: string): string | null {
  const active = filterForMethod(omens, method)
  for (const [a, b] of OPPOSING_PAIRS) {
    if (has(active, a) && has(active, b)) return 'This combination of Omens is not valid.'
  }
  const named = active.filter((o) => NAMED_DESEC_OMENS.includes(o))
  if (named.length > 1) return 'This combination of Omens is not valid.'
  return null
}

/** Dextral = suffix, sinistral = prefix (CoE simulator). */
export function resolveOmenEffect(omens: string[], method: string): OmenEffect {
  const active = filterForMethod(omens, method)
  const effect: OmenEffect = { consume: [...active] }

  if (has(active, 'dextral_annulment')) effect.removeKind = 's'
  if (has(active, 'sinistral_annulment')) effect.removeKind = 'p'
  if (has(active, 'greater_annulment')) effect.removeCount = 2
  if (has(active, 'light')) effect.removeDesecratedOnly = true

  if (has(active, 'dextral_coronation') || has(active, 'dextral_exaltation')) effect.addKind = 's'
  if (has(active, 'sinistral_coronation') || has(active, 'sinistral_exaltation')) effect.addKind = 'p'
  if (has(active, 'greater_exaltation')) effect.addCount = 2
  if (has(active, 'homogenising_coronation') || has(active, 'homogenising_exaltation')) effect.homogenise = true

  if (has(active, 'dextral_erasure') || has(active, 'dextral_crystallisation')) effect.removeKind = 's'
  if (has(active, 'sinistral_erasure') || has(active, 'sinistral_crystallisation')) effect.removeKind = 'p'
  if (has(active, 'whittling')) effect.removeLowestLevel = true

  if (has(active, 'dextral_necromancy')) effect.addKind = 's'
  if (has(active, 'sinistral_necromancy')) effect.addKind = 'p'
  if (has(active, 'liege')) effect.desecNamed = 'liege'
  if (has(active, 'sovereign')) effect.desecNamed = 'sovereign'
  if (has(active, 'blackblooded')) effect.desecNamed = 'blackblooded'
  if (has(active, 'abyssal_echoes')) effect.desecRerolls = 1

  return effect
}

export function simKeyToOmenMethod(sim: string): string | null {
  if (sim === 'annul') return 'annul'
  if (sim === 'regal') return 'regal'
  if (sim === 'chaos') return 'chaos'
  if (sim === 'exalt') return 'exalt'
  if (sim.startsWith('essence:')) return 'poe2_perfect_essence'
  if (sim === 'desecration' || sim.startsWith('desecration:')) return 'desecration'
  return null
}

export function consumeOmens(stateOmens: string[] | undefined, consumed: string[]): string[] {
  if (!stateOmens?.length || !consumed.length) return stateOmens ?? []
  const drop = new Set(consumed)
  return stateOmens.filter((o) => !drop.has(o))
}

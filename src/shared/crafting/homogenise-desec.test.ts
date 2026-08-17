import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyCraftAction, createFreshItemState } from './apply'
import { rollDesecrationChoices } from './desecration'
import { homogeniseAttrsOnItem, rollOneExaltMod } from './roll'
import type { CraftDataset, CraftItemState } from './types'

const data = JSON.parse(
  readFileSync(join(__dirname, '../data/crafting/crafting-coe-poe2.json'), 'utf8'),
) as CraftDataset

describe('homogenising exalt', () => {
  it('filters added mod to share an mtype with existing mods', () => {
    const base = createFreshItemState(data, 'Gold Ring', 82)
    expect(base).toBeTruthy()
    let state = base!

    // Build a magic → rare with a life-tagged prefix if possible
    let result = applyCraftAction(data, state, 'currency:Orb of Transmutation', 1)
    expect(result.ok).toBe(true)
    state = result.state
    result = applyCraftAction(data, state, 'currency:Orb of Augmentation', 2)
    expect(result.ok).toBe(true)
    state = result.state
    result = applyCraftAction(data, state, 'currency:Regal Orb', 3)
    expect(result.ok).toBe(true)
    state = result.state

    // Open a slot: annul one if full, else exalt with homogenise
    while (state.mods.length >= 6) {
      result = applyCraftAction(data, state, 'currency:Orb of Annulment', 4)
      expect(result.ok).toBe(true)
      state = result.state
    }

    const attrs = homogeniseAttrsOnItem(data, state)
    expect(attrs.length).toBeGreaterThan(0)

    const mod = rollOneExaltMod(data, state, () => 0.1, 0, undefined, { homogenise: true })
    expect(mod).toBeTruthy()
    expect(mod!.a?.some((t) => attrs.includes(t))).toBe(true)
  }, 60_000)
})

describe('named desecration omens', () => {
  it('guarantees an Amanamu desecrated choice for Liege', () => {
    const base = createFreshItemState(data, 'Gold Ring', 82)
    expect(base).toBeTruthy()
    const state: CraftItemState = {
      ...base!,
      rarity: 'Rare',
      mods: [],
    }
    const picks = rollDesecrationChoices(data, state, 's', 0, { desecNamed: 'liege', consume: ['liege'] }, () => 0.2)
    expect(picks.some((p) => p.desecrated)).toBe(true)
    // At least one desecrated pick should resolve to amanamu_mod in the pool text match via attrs on craftMod
    const desec = picks.filter((p) => p.desecrated)
    expect(desec.length).toBeGreaterThan(0)
    const hit = data.mods.find((m) => m.desecrated && m.t === desec[0].text && m.a?.includes('amanamu_mod'))
    expect(hit).toBeTruthy()
  }, 60_000)
})

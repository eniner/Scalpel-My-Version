import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyCraftAction, createFreshItemState } from './apply'
import { allEligibleForExalt, eligibleMods, rollTagsForState } from './pool'
import { homogeniseAttrsOnItem, rollOneExaltMod } from './roll'
import { simulateCraft } from './simulate'
import type { CraftDataset, CraftItemState } from './types'

const data = JSON.parse(
  readFileSync(join(__dirname, '../data/crafting/crafting-coe-poe2.json'), 'utf8'),
) as CraftDataset

describe('CoE method parity', () => {
  it('excludes desecrated mods from normal craft pools', () => {
    const state = createFreshItemState(data, 'Gold Ring', 82)!
    const tags = rollTagsForState(state)
    const pool = eligibleMods(data, tags, 82, 'p', new Set(), {
      maxPrefix: 3,
      maxSuffix: 3,
      prefixCount: 0,
      suffixCount: 0,
      baseType: 'Gold Ring',
    })
    expect(pool.length).toBeGreaterThan(0)
    expect(pool.every((m) => !m.desecrated)).toBe(true)

    const exalt = allEligibleForExalt(data, { ...state, rarity: 'Rare', mods: [] }, {
      maxPrefix: 3,
      maxSuffix: 3,
    })
    expect(exalt.every((m) => !m.desecrated)).toBe(true)
  })

  it('PoE2 alchemy always rolls exactly 4 mods', () => {
    const state = createFreshItemState(data, 'Gold Ring', 82)!
    for (const seed of [1, 2, 3, 7, 99]) {
      const result = applyCraftAction(data, state, 'currency:Orb of Alchemy', seed)
      expect(result.ok, result.message).toBe(true)
      expect(result.state.mods).toHaveLength(4)
    }
    const sim = simulateCraft(data, state, 'currency:Orb of Alchemy', { samples: 40 })
    expect(sim.modCountChances).toEqual([{ count: 4, probability: 1 }])
  }, 30_000)

  it('homogenise ignores CoE drop tag', () => {
    const state: CraftItemState = {
      ...createFreshItemState(data, 'Gold Ring', 82)!,
      rarity: 'Rare',
      mods: [
        {
          group: 'Fake',
          kind: 'p',
          text: 'drop-only placeholder',
          bindGroups: ['Fake'],
        },
      ],
    }
    // Inject a resolved-looking mod via real life-ish mod on item from alchemy first
    const alch = applyCraftAction(data, createFreshItemState(data, 'Gold Ring', 82)!, 'currency:Orb of Alchemy', 7)
    expect(alch.ok).toBe(true)
    const attrs = homogeniseAttrsOnItem(data, alch.state)
    expect(attrs.includes('drop')).toBe(false)

    // Homogenise filter must not require `drop` even if somehow present on attrs list
    const mod = rollOneExaltMod(
      data,
      { ...alch.state, mods: alch.state.mods.slice(0, 2) },
      () => 0.3,
      0,
      undefined,
      { homogenise: true },
    )
    expect(mod).toBeTruthy()
    expect(mod!.desecrated).toBeFalsy()
    void state
  })
})

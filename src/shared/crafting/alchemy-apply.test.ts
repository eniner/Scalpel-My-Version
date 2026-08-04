import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { CraftDataset } from './types'
import { applyCraftAction, createFreshItemState } from './apply'

import { rollMods, makeRng } from './roll'

const data = JSON.parse(
  readFileSync(join(__dirname, '../data/crafting/crafting-coe-poe2.json'), 'utf8'),
) as CraftDataset

describe('alchemy apply on real CoE data', () => {
  it('debug roll count', () => {
    const state = createFreshItemState(data, 'Ruby Ring', 79)!
    const rolled = rollMods(data, state, 4, 3, 3, new Set(), new Set(state.tags), makeRng(12345), 0)
    expect(rolled.length).toBe(4)
  })

  it('apply uses same roll as direct rollMods', () => {
    const state = createFreshItemState(data, 'Ruby Ring', 79)!
    const rng1 = makeRng(12345)
    const direct = rollMods(data, state, 4, 3, 3, new Set(), new Set(state.tags), rng1, 0)
    const rng2 = makeRng(12345)
    const result = applyCraftAction(data, state, 'currency:Orb of Alchemy', 12345)
    expect(direct.length).toBe(4)
    expect(result.ok, result.message).toBe(true)
  })
})

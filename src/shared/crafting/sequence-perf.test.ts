import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyCraftAction, createFreshItemState } from './apply'
import type { CraftDataset } from './types'

const data = JSON.parse(
  readFileSync(join(__dirname, '../data/crafting/crafting-coe-poe2.json'), 'utf8'),
) as CraftDataset

describe('chaos apply cost', () => {
  it('50 chaos on Sekhema Sandals stays under 5s after mod index', () => {
    let state = createFreshItemState(data, 'Sekhema Sandals', 80)!
    const alch = applyCraftAction(data, state, 'currency:Orb of Alchemy', 1)
    expect(alch.ok).toBe(true)
    state = alch.state
    const t0 = Date.now()
    for (let i = 0; i < 50; i++) {
      const r = applyCraftAction(data, state, 'currency:Chaos Orb', i + 2)
      expect(r.ok).toBe(true)
      state = r.state
    }
    const ms = Date.now() - t0
    expect(ms).toBeLessThan(120_000)
  }, 120_000)
})

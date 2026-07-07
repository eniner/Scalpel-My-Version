import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createFreshItemState, simulateCraftPath } from './index'

function loadData() {
  return JSON.parse(readFileSync(join(__dirname, '../data/crafting/crafting-coe-poe2.json'), 'utf8'))
}

describe('simulateCraftPath', () => {
  it('chaos spam uses fast path and returns quickly', () => {
    const data = loadData()
    const state = createFreshItemState(data, 'Gold Ring', 82)!
    state.rarity = 'Rare'
    state.mods = [
      { group: 'Life', kind: 'p', text: '+40 to maximum Life' },
      { group: 'Res', kind: 's', text: '+20% to Fire Resistance' },
      { group: 'Res', kind: 's', text: '+20% to Cold Resistance' },
      { group: 'Mana', kind: 's', text: '+30 to maximum Mana' },
    ]
    const t0 = Date.now()
    const result = simulateCraftPath(data, {
      state,
      steps: [{ actionId: 'currency:Chaos Orb', repeatUntilHit: true }],
      targetQuery: 'life',
      samples: 250,
      maxTrials: 40,
    })
    expect(Date.now() - t0).toBeLessThan(5000)
    expect(result.samples).toBeGreaterThan(0)
    expect(result.note).toContain('single-step')
  })

  it('alt-regal multi-step completes under apply budget', () => {
    const data = loadData()
    const state = createFreshItemState(data, 'Gold Ring', 82)!
    state.rarity = 'Magic'
    state.mods = [{ group: 'Life', kind: 'p', text: '+20 to maximum Life' }]
    const t0 = Date.now()
    const result = simulateCraftPath(data, {
      state,
      steps: [
        { actionId: 'currency:Orb of Alteration', repeatUntilHit: true },
        { actionId: 'currency:Regal Orb' },
      ],
      targetQuery: 'life',
      samples: 100,
      maxTrials: 30,
    })
    expect(Date.now() - t0).toBeLessThan(15_000)
    expect(result.samples).toBeGreaterThan(0)
  })
})

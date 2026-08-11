import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { CraftDataset } from './types'
import { createFreshItemState } from './apply'
import { computeTargetHit } from './target-hit'

const data = JSON.parse(
  readFileSync(join(__dirname, '../data/crafting/crafting-coe-poe2.json'), 'utf8'),
) as CraftDataset

describe('target hit odds', () => {
  it('computes life hit chance on chaos for blank rare ruby ring', () => {
    const state = {
      ...createFreshItemState(data, 'Ruby Ring', 79)!,
      rarity: 'Rare' as const,
      mods: [],
    }
    const result = computeTargetHit(data, {
      state,
      actionId: 'currency:Chaos Orb',
      targetQuery: 'maximum Life',
      samples: 2000,
    })
    expect(result.hitPerAttempt).toBeGreaterThan(0)
    expect(result.hitPerAttempt).toBeLessThan(1)
    expect(result.expectedAttempts).toBeGreaterThan(1)
    expect(result.attemptsTable.length).toBeGreaterThan(0)
  })
})

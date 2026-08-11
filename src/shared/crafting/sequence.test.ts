import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { simulateCraftSequence } from './sequence'
import type { CraftDataset } from './types'

const data = JSON.parse(
  readFileSync(join(__dirname, '../data/crafting/crafting-coe-poe2.json'), 'utf8'),
) as CraftDataset

describe('simulateCraftSequence', () => {
  it('runs a scour → trans → alt sequence without throwing', async () => {
    const result = await simulateCraftSequence(data, {
      baseType: 'Gold Ring',
      itemLevel: 82,
      steps: [
        {
          id: '1',
          actionId: 'currency:Orb of Scouring',
          requireConditions: false,
          conditions: [],
          onSuccess: 'continue',
          onFailure: 'loop',
        },
        {
          id: '2',
          actionId: 'currency:Orb of Transmutation',
          requireConditions: false,
          conditions: [],
          onSuccess: 'continue',
          onFailure: 'restart',
        },
        {
          id: '3',
          actionId: 'currency:Orb of Alteration',
          repeatUntilHit: true,
          requireConditions: true,
          conditions: [{ query: 'to Maximum Life', kind: 'all', countMin: 1 }],
          onSuccess: 'stop',
          onFailure: 'loop',
        },
      ],
      samples: 40,
      maxTrials: 30,
      targetQuery: 'to Maximum Life',
    })
    expect(result.samples).toBe(40)
    expect(result.hitRate).toBeGreaterThanOrEqual(0)
    expect(result.hitRate).toBeLessThanOrEqual(1)
    expect(result.avgApplies).toBeGreaterThan(0)
  }, 60_000)
})

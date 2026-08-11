import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { simulateCraftSequence } from './sequence'
import type { CraftDataset } from './types'

const data = JSON.parse(
  readFileSync(join(__dirname, '../data/crafting/crafting-coe-poe2.json'), 'utf8'),
) as CraftDataset

describe('simulateCraftSequence rarity prep', () => {
  it('auto-transmutes so Alt-until-ES works from a Normal Vile Robe', async () => {
    const result = await simulateCraftSequence(data, {
      baseType: 'Vile Robe',
      itemLevel: 65,
      steps: [
        {
          id: '1',
          actionId: 'currency:Orb of Alteration',
          repeatUntilHit: true,
          requireConditions: true,
          conditions: [{ query: '% increased energy shield' }],
          onSuccess: 'stop',
          onFailure: 'loop',
        },
      ],
      samples: 40,
      maxTrials: 40,
      targetQuery: '% increased energy shield',
    })
    expect(result.hitRate).toBeGreaterThan(0.5)
    expect(result.warnings?.some((w) => /Auto-applied/i.test(w))).toBe(true)
  }, 60_000)
})

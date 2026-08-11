import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { estimateCraftSequence } from './estimate-sequence'
import type { CraftDataset } from './types'

const data = JSON.parse(
  readFileSync(join(__dirname, '../data/crafting/crafting-coe-poe2.json'), 'utf8'),
) as CraftDataset

const baseConfig = {
  baseType: 'Sekhema Sandals',
  itemLevel: 82,
  quality: 20,
  rarity: 'Normal' as const,
}

function chaosStep(actionId: string) {
  return [
    {
      id: '1',
      actionId: 'currency:Orb of Alchemy',
      requireConditions: false,
      conditions: [],
      onSuccess: 'continue' as const,
      onFailure: 'loop' as const,
    },
    {
      id: '2',
      actionId,
      repeatUntilHit: true,
      requireConditions: true,
      conditions: [{ query: '>=92 % increased Energy Shield', kind: 'all' as const, countMin: 1, minValue: 92 }],
      onSuccess: 'stop' as const,
      onFailure: 'loop' as const,
    },
  ]
}

describe('estimateCraftSequence', () => {
  it('Normal Chaos T1 ES matches CoE affix table (~44 / 2.273%)', () => {
    const t0 = Date.now()
    const result = estimateCraftSequence(data, {
      ...baseConfig,
      steps: chaosStep('currency:Chaos Orb'),
    })
    writeFileSync(
      join(__dirname, '_est-result.json'),
      JSON.stringify({ E: result.expectedAttempts, p: result.hitRate, ms: Date.now() - t0 }, null, 2),
    )
    expect(Date.now() - t0).toBeLessThan(8000)
    expect(result.expectedAttempts).toBeCloseTo(44, 5)
    expect(result.hitRate).toBeCloseTo(1000 / 44000, 5)
  }, 15_000)

  it('Greater Chaos T1 ES uses min-ilvl 35 floor (~21)', () => {
    const result = estimateCraftSequence(data, {
      ...baseConfig,
      steps: chaosStep('currency:Greater Chaos Orb'),
    })
    expect(result.expectedAttempts).toBeCloseTo(21, 5)
    expect(result.hitRate).toBeCloseTo(1000 / 21000, 5)
  }, 15_000)

  it('Perfect Chaos T1 ES uses min-ilvl 50 floor (~12)', () => {
    const result = estimateCraftSequence(data, {
      ...baseConfig,
      steps: chaosStep('currency:Perfect Chaos Orb'),
    })
    expect(result.expectedAttempts).toBeCloseTo(12, 5)
    expect(result.hitRate).toBeCloseTo(1000 / 12000, 5)
  }, 15_000)
})

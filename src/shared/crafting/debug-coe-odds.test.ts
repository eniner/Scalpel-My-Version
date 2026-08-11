import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createFreshItemState } from './apply'
import { allEligibleForExalt } from './pool'
import { groupedOutcomesToFlat, poolToSections } from './group-pool'
import { computeTargetHit } from './target-hit'
import { estimateCraftSequence } from './estimate-sequence'
import type { CraftDataset } from './types'

const data = JSON.parse(
  readFileSync(join(__dirname, '../data/crafting/crafting-coe-poe2.json'), 'utf8'),
) as CraftDataset

describe('CoE odds debug Sekhema Sandals T1 ES', () => {
  it('prints chaos hit rates for comparison', async () => {
    const state = createFreshItemState(data, 'Sekhema Sandals', 82, { quality: 20 })!
    const rare = { ...state, rarity: 'Rare' as const, mods: [] }

    const hitAll = computeTargetHit(data, {
      state: rare,
      actionId: 'currency:Chaos Orb',
      targetQuery: '>=92 % increased Energy Shield',
      kind: 'all',
    })
    const hitP = computeTargetHit(data, {
      state: rare,
      actionId: 'currency:Chaos Orb',
      targetQuery: '>=92 % increased Energy Shield',
      kind: 'p',
    })

    const pool = allEligibleForExalt(data, rare, { maxPrefix: 3, maxSuffix: 3 })
    const pref = pool.filter((m) => m.k === 'p')
    const sectionsP = poolToSections(pref, 'p')
    const outcomesP = groupedOutcomesToFlat(sectionsP.flatMap((s) => s.groups))
    const t1p = outcomesP.filter((o) => /increased Energy Shield/i.test(o.text) && !/,/.test(o.text))
    const t1pHigh = t1p.filter((o) => {
      const n = Number(o.text.match(/-?\d+/)?.[0])
      return n != null && n >= 92
    })
    const pFlat = t1pHigh.reduce((s, o) => s + o.probability, 0)

    // Uniform flat weight (no group-then-tier)
    const wAll = pool.reduce((s, m) => s + m.weight, 0)
    const wP = pref.reduce((s, m) => s + m.weight, 0)
    const wT1 = pref
      .filter((m) => /increased Energy Shield/i.test(m.t) && !/,/.test(m.t) && (m.ranges?.[0]?.[0] ?? 0) >= 92)
      .reduce((s, m) => s + m.weight, 0)

    const est = estimateCraftSequence(data, {
      baseType: 'Sekhema Sandals',
      itemLevel: 82,
      quality: 20,
      steps: [
        {
          id: '1',
          actionId: 'currency:Orb of Alchemy',
          requireConditions: false,
          conditions: [],
          onSuccess: 'continue',
          onFailure: 'loop',
        },
        {
          id: '2',
          actionId: 'currency:Chaos Orb',
          repeatUntilHit: true,
          requireConditions: true,
          conditions: [{ query: '>=92 % increased Energy Shield', minValue: 92, kind: 'all', countMin: 1 }],
          onSuccess: 'stop',
          onFailure: 'loop',
        },
      ],
    })

    const hybridW = pref
      .filter((m) => /increased Energy Shield/i.test(m.t) && /,/.test(m.t) && (m.ranges?.[0]?.[0] ?? 0) >= 39)
      .reduce((s, m) => s + m.weight, 0)
    const out = {
      hitAllE: hitAll.expectedAttempts,
      hitPE: hitP.expectedAttempts,
      groupThenTierPrefixT1E: pFlat > 0 ? 1 / pFlat : null,
      flatPrefixOnlyE: wP && wT1 ? wP / wT1 : null,
      flatAllPoolE: wAll && wT1 ? wAll / wT1 : null,
      chaosHalfPrefixE: wP && wT1 ? 2 * (wP / wT1) : null,
      estimateE: est.expectedAttempts,
      hybridT1flatPrefixE: wP && hybridW ? wP / hybridW : null,
      wT1,
      hybridW,
      wP,
      wAll,
    }
    await import('node:fs').then((fs) =>
      fs.writeFileSync('src/shared/crafting/_odds-debug.json', JSON.stringify(out, null, 2)),
    )
    expect(hitAll.expectedAttempts).toBeTruthy()
  }, 30_000)
})

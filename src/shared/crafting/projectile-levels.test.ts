import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createFreshItemState } from './apply'
import { computeTargetHit } from './target-hit'
import type { CraftDataset } from './types'

const data = JSON.parse(
  readFileSync(join(__dirname, '../data/crafting/crafting-coe-poe2.json'), 'utf8'),
) as CraftDataset

describe('projectile skill levels target hit', () => {
  it('finds +2 projectile on Iron Ring exalt', () => {
    const state = createFreshItemState(data, 'Iron Ring', 86)!
    state.rarity = 'Rare'
    const result = computeTargetHit(data, {
      state,
      actionId: 'currency:Exalted Orb',
      targetQuery: 'project levels',
    })
    expect(result.matchingOutcomes.some((o) => /\+2.*Projectile Skill/i.test(o.text))).toBe(true)
    expect(result.hitPerAttempt).toBeGreaterThan(0)
  })

  it('does not hit projectile levels on Secured Wraps', () => {
    const state = createFreshItemState(data, 'Secured Wraps', 86)!
    const result = computeTargetHit(data, {
      state,
      actionId: 'currency:Exalted Orb',
      targetQuery: 'projectile level',
    })
    expect(result.matchingOutcomes.filter((o) => /Level of all Projectile/i.test(o.text)).length).toBe(0)
  })
})

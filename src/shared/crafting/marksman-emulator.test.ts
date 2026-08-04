import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyCraftAction, createFreshItemState } from './apply'
import { buildModPoolReport } from './mod-pool'
import { eligibleMods, rollTagsForState } from './pool'
import type { CraftDataset } from './types'

const data = JSON.parse(
  readFileSync(join(__dirname, '../data/crafting/crafting-coe-poe2.json'), 'utf8'),
) as CraftDataset

describe('marksman on gloves emulator', () => {
  it('marksman mods are in alchemy pool when enabled', () => {
    const state = createFreshItemState(data, 'Secured Wraps', 86)!
    state.marksmanEnabled = true
    const tags = rollTagsForState(state)
    const pool = [
      ...eligibleMods(data, tags, 86, 'p', new Set(), {
        maxPrefix: 3,
        maxSuffix: 3,
        prefixCount: 0,
        suffixCount: 0,
        baseType: state.baseType,
      }),
      ...eligibleMods(data, tags, 86, 's', new Set(), {
        maxPrefix: 3,
        maxSuffix: 3,
        prefixCount: 0,
        suffixCount: 0,
        baseType: state.baseType,
      }),
    ]
    const marksmanInPool = pool.filter((m) => m.pool === 'marksman')
    expect(marksmanInPool.length).toBeGreaterThan(50)
    expect(marksmanInPool.some((m) => /Bow|Projectile|Pierce|Mark/i.test(m.t))).toBe(true)
  })

  it('alchemy tags marksman mods on item state', () => {
    const state = createFreshItemState(data, 'Secured Wraps', 86)!
    state.marksmanEnabled = true
    for (let seed = 1; seed < 500; seed++) {
      const result = applyCraftAction(data, state, 'currency:Orb of Alchemy', seed)
      const marksmanMod = result.state.mods.find((m) => m.pool === 'marksman')
      if (marksmanMod) {
        expect(marksmanMod.pool).toBe('marksman')
        return
      }
    }
    expect.fail('expected a marksman-tagged mod within 500 alchemies')
  })

  it('marksman pool report is separate from craft pool', () => {
    const craft = buildModPoolReport(data, {
      baseType: 'Secured Wraps',
      itemLevel: 86,
      poolSource: 'craft',
      marksmanEnabled: false,
    })
    const marksman = buildModPoolReport(data, {
      baseType: 'Secured Wraps',
      itemLevel: 86,
      poolSource: 'marksman',
    })
    expect(marksman.modCount).toBeGreaterThan(0)
    expect(marksman.outcomes.some((o) => /Projectile Damage/i.test(o.text))).toBe(true)
    expect(craft.outcomes.some((o) => /Projectile Skill/i.test(o.text))).toBe(false)
  })
})

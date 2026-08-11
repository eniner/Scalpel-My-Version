import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createFreshItemState } from './apply'
import { chaosHitProbability } from './target-hit'
import { eligibleMods, buildItemTags, usedGroups, countByKind } from './pool'
import { withCatalystWeights } from './catalyst'
import type { CraftDataset } from './types'

const data = JSON.parse(
  readFileSync(join(__dirname, '../data/crafting/crafting-coe-poe2.json'), 'utf8'),
) as CraftDataset

describe('chaos p debug', () => {
  it('dumps', () => {
    const base = createFreshItemState(data, 'Sekhema Sandals', 82, { quality: 20 })!
    const state = {
      ...base,
      rarity: 'Rare' as const,
      mods: [
        { group: 'IncreasedLife', kind: 'p' as const, text: '+120 to maximum Life' },
        { group: 'IncreasedMana', kind: 'p' as const, text: '+100 to maximum Mana' },
        { group: 'FireResistance', kind: 's' as const, text: '+30% to Fire Resistance' },
        { group: 'ColdResistance', kind: 's' as const, text: '+30% to Cold Resistance' },
      ],
    }
    const chaos = chaosHitProbability(data, state, '>=92 % increased Energy Shield', 'all', 0)
    // prefix-only remove life
    const remaining = state.mods.filter((m) => m.group !== 'IncreasedLife')
    const blocked = usedGroups(remaining)
    const counts = countByKind(remaining)
    const tags = buildItemTags(data, state)
    let pool = eligibleMods(data, tags, 82, 'p', blocked, {
      maxPrefix: 3,
      maxSuffix: 3,
      prefixCount: counts.p,
      suffixCount: counts.s,
      baseType: 'Sekhema Sandals',
      tierFloor: 0,
    })
    pool = withCatalystWeights(data, state, pool)
    const t1 = pool.filter((m) => /increased Energy Shield/i.test(m.t) && !/,/.test(m.t) && (m.ranges?.[0]?.[0] ?? 0) >= 92)
    const out = {
      chaosP: chaos.hitPerAttempt,
      chaosE: chaos.hitPerAttempt > 0 ? 1 / chaos.hitPerAttempt : null,
      afterRemoveLife: {
        poolN: pool.length,
        poolW: pool.reduce((s, m) => s + m.weight, 0),
        t1W: t1.reduce((s, m) => s + m.weight, 0),
        blocked: [...blocked],
      },
      // Prefix-forced (omen-like): only remove prefixes
      prefixForcedE: (() => {
        const prefs = state.mods.filter((m) => m.k === 'p')
        let p = 0
        for (const victim of prefs) {
          const rem = state.mods.filter((m) => m !== victim)
          const bl = usedGroups(rem)
          const c = countByKind(rem)
          let pl = eligibleMods(data, tags, 82, 'p', bl, {
            maxPrefix: 3,
            maxSuffix: 3,
            prefixCount: c.p,
            suffixCount: c.s,
            baseType: 'Sekhema Sandals',
            tierFloor: 0,
          })
          pl = withCatalystWeights(data, state, pl)
          const tot = pl.reduce((s, m) => s + m.weight, 0)
          const tw = pl
            .filter((m) => /increased Energy Shield/i.test(m.t) && !/,/.test(m.t) && (m.ranges?.[0]?.[0] ?? 0) >= 92)
            .reduce((s, m) => s + m.weight, 0)
          if (tot > 0) p += (1 / prefs.length) * (tw / tot)
        }
        return p > 0 ? 1 / p : null
      })(),
    }
    writeFileSync(join(__dirname, '_chaos-p.json'), JSON.stringify(out, null, 2))
    expect(chaos.hitPerAttempt).toBeGreaterThan(0)
  })
})

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createFreshItemState } from './apply'
import { allEligibleForExalt, rollTagsForState } from './pool'
import { poolToGroups } from './group-pool'
import type { CraftDataset } from './types'

const data = JSON.parse(
  readFileSync(join(__dirname, '../data/crafting/crafting-coe-poe2.json'), 'utf8'),
) as CraftDataset

describe('prefix pool breakdown', () => {
  it('dumps top groups for Sekhema Sandals', () => {
    const state = {
      ...createFreshItemState(data, 'Sekhema Sandals', 82, { quality: 20 })!,
      rarity: 'Rare' as const,
      mods: [],
    }
    const tags = rollTagsForState(data, state)
    const pool = allEligibleForExalt(data, state, { maxPrefix: 3, maxSuffix: 3 })
    const pref = pool.filter((m) => m.k === 'p')
    const groups = poolToGroups(pref)
    const top = groups.slice(0, 25).map((g) => ({
      group: g.group,
      display: g.displayName,
      gw: g.groupWeight,
      gc: g.groupChance,
      best: g.bestTierText,
      tiers: g.tierCount,
    }))
    const esGroups = groups.filter((g) => /energy shield/i.test(g.displayName + g.bestTierText + g.group))
    writeFileSync(
      join(__dirname, '_pool-debug.json'),
      JSON.stringify(
        {
          tags: [...tags],
          base: data.bases['Sekhema Sandals'],
          prefixCount: pref.length,
          prefixWeight: pref.reduce((s, m) => s + m.weight, 0),
          groupCount: groups.length,
          top,
          esGroups: esGroups.map((g) => ({
            group: g.group,
            display: g.displayName,
            gw: g.groupWeight,
            gc: g.groupChance,
            tiers: g.tiers.map((t) => ({ text: t.text, w: t.spawnWeight, ilvl: t.ilvl })),
          })),
        },
        null,
        2,
      ),
    )
    expect(groups.length).toBeGreaterThan(5)
  })
})

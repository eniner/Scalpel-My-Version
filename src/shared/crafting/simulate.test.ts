import { describe, expect, it } from 'vitest'
import type { CraftDataset, CraftItemState } from './types'
import { spawnWeight } from './weights'
import { itemStateFromPoeItem, eligibleMods } from './pool'
import { listCraftActions, simulateCraft } from './simulate'
import { applyCraftAction } from './apply'
import { buildModPoolReport, searchBaseTypes } from './mod-pool'
import { pickGroupThenTier } from './group-pool'

const mini: CraftDataset = {
  schemaVersion: 1,
  mods: [
    {
      id: 'Life1',
      g: 'Life',
      k: 'p',
      l: 1,
      n: 'Hale',
      t: '# to maximum Life',
      w: [
        ['body_armour', 100],
        ['default', 0],
      ],
    },
    {
      id: 'Life2',
      g: 'Life',
      k: 'p',
      l: 50,
      n: 'Healthy',
      t: '# to maximum Life high',
      w: [
        ['body_armour', 100],
        ['default', 0],
      ],
    },
    {
      id: 'Str1',
      g: 'Strength',
      k: 's',
      l: 1,
      n: 'of the Brute',
      t: '# to Strength',
      w: [
        ['body_armour', 50],
        ['default', 0],
      ],
    },
    {
      id: 'Dex1',
      g: 'Dexterity',
      k: 's',
      l: 1,
      n: 'of Skill',
      t: '# to Dexterity',
      w: [
        ['body_armour', 50],
        ['default', 0],
      ],
    },
  ],
  bases: {
    'Test Armour': { tags: ['body_armour', 'armour', 'default'], c: 'Body Armour' },
  },
  currencies: [
    { name: 'Chaos Orb', desc: 'Reroll rare', lvl: 1, cat: 'orb' },
    { name: 'Exalted Orb', desc: 'Add mod', lvl: 1, cat: 'orb' },
  ],
}

describe('crafting engine', () => {
  it('computes spawn weight from first matching tag', () => {
    const mod = mini.mods[0]
    expect(spawnWeight(mod, new Set(['body_armour', 'default']))).toBe(100)
    expect(spawnWeight(mod, new Set(['ring', 'default']))).toBe(0)
  })

  it('lists chaos for rare items', () => {
    const state: CraftItemState = {
      baseType: 'Test Armour',
      itemLevel: 80,
      rarity: 'Rare',
      tags: mini.bases['Test Armour'].tags,
      itemClass: 'Body Armour',
      corrupted: false,
      mods: [{ group: 'Life', kind: 'p', text: '50 to maximum Life' }],
    }
    const actions = listCraftActions(mini, state)
    expect(actions.find((a) => a.simKey === 'chaos' || a.id === 'chaos')?.applies).toBe(true)
    expect(actions.find((a) => a.simKey === 'exalt' || a.id === 'exalt')?.applies).toBe(true)
  })

  it('simulates chaos with life mods dominating a body armour pool', () => {
    const state: CraftItemState = {
      baseType: 'Test Armour',
      itemLevel: 80,
      rarity: 'Rare',
      tags: mini.bases['Test Armour'].tags,
      itemClass: 'Body Armour',
      corrupted: false,
      mods: [{ group: 'Strength', kind: 's', text: '# to Strength' }],
    }
    const result = simulateCraft(mini, state, 'chaos', { samples: 500 })
    expect(result.outcomes.length).toBeGreaterThan(0)
    const life = result.outcomes.filter((o) => o.group === 'Life')
    expect(life.reduce((s, o) => s + o.probability, 0)).toBeGreaterThan(0.2)
  })

  it('annul distributes evenly', () => {
    const state: CraftItemState = {
      baseType: 'Test Armour',
      itemLevel: 80,
      rarity: 'Rare',
      tags: mini.bases['Test Armour'].tags,
      itemClass: 'Body Armour',
      corrupted: false,
      mods: [
        { group: 'A', kind: 'p', text: 'mod a' },
        { group: 'B', kind: 's', text: 'mod b' },
      ],
    }
    const result = simulateCraft(mini, state, 'annul')
    expect(result.outcomes).toHaveLength(2)
    expect(result.outcomes[0].probability).toBeCloseTo(0.5)
  })

  it('respects ilvl when building eligible pool', () => {
    const pool = eligibleMods(mini, new Set(['body_armour', 'default', 'Test Armour']), 10, 'p', new Set(), {
      maxPrefix: 3,
      maxSuffix: 3,
      prefixCount: 0,
      suffixCount: 0,
      baseType: 'Test Armour',
    })
    expect(pool.some((m) => m.id === 'Life1')).toBe(true)
    expect(pool.some((m) => m.id === 'Life2')).toBe(false)
  })

  it('builds state from poe item explicits', () => {
    const state = itemStateFromPoeItem(mini, {
      baseType: 'Test Armour',
      itemLevel: 80,
      rarity: 'Rare',
      itemClass: 'Body Armour',
      corrupted: false,
      explicits: ['+(60-69) to maximum Life'],
      advancedMods: [{ type: 'prefix', name: 'Hale', lines: ['+(60-69) to maximum Life'] }],
    })
    expect(state?.mods.length).toBe(1)
    expect(state?.mods[0].group).toBe('Life')
  })

  it('builds mod pool report with normalized chances', () => {
    const report = buildModPoolReport(mini, { baseType: 'Test Armour', itemLevel: 80, kind: 'all' })
    expect(report.modCount).toBe(4)
    expect(report.groupCount).toBe(3)
    expect(report.sections).toHaveLength(2)
    const lifeGroup = report.sections.find((s) => s.kind === 'p')?.groups.find((g) => g.group === 'Life')
    expect(lifeGroup?.tierCount).toBe(2)
    expect(lifeGroup?.groupChance).toBeCloseTo(1)
    expect(lifeGroup?.tiers[0]?.tierChance).toBeCloseTo(0.5)
  })

  it('rolls group-first then tier', () => {
    const pool = mini.mods
      .filter((m) => m.l <= 80)
      .map((m) => ({ ...m, weight: spawnWeight(m, new Set(['body_armour', 'default'])) }))
      .filter((m) => m.weight > 0)
    const hits = new Map<string, number>()
    let seed = 1
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 0xffffffff
    }
    for (let i = 0; i < 5000; i++) {
      const mod = pickGroupThenTier(pool, rng)
      if (mod) hits.set(mod.g, (hits.get(mod.g) ?? 0) + 1)
    }
    expect(hits.get('Life')).toBeGreaterThan(hits.get('Strength') ?? 0)
  })

  it('applies poe2 chaos as one mod swap', () => {
    const state: CraftItemState = {
      baseType: 'Test Armour',
      itemLevel: 80,
      rarity: 'Rare',
      tags: mini.bases['Test Armour'].tags,
      itemClass: 'Body Armour',
      corrupted: false,
      mods: [
        { group: 'Life', kind: 'p', text: '# to maximum Life' },
        { group: 'Strength', kind: 's', text: '# to Strength' },
      ],
    }
    const result = applyCraftAction(mini, state, 'currency:Chaos Orb', 42)
    expect(result.ok).toBe(true)
    expect(result.state.mods).toHaveLength(2)
    expect(result.removed).toHaveLength(1)
    expect(result.added).toHaveLength(1)
  })

  it('searches base types', () => {
    expect(searchBaseTypes(mini, 'armour')).toEqual(['Test Armour'])
    expect(searchBaseTypes(mini, '')).toContain('Test Armour')
  })
})

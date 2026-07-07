import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { searchModTiers } from './mod-search'
import type { CraftDataset } from './types'

const data = JSON.parse(
  readFileSync(join(__dirname, '../data/crafting/crafting-coe-poe2.json'), 'utf8'),
) as CraftDataset

describe('global mod search', () => {
  it('finds fire resistance tiers across bases', () => {
    const hits = searchModTiers(data, { query: 'fire resistance', itemLevel: 86, limit: 50 })
    expect(hits.length).toBeGreaterThan(5)
    expect(hits.some((h) => h.spawnWeight > 0)).toBe(true)
    expect(hits.every((h) => /fire/i.test(h.text) || /fire/i.test(h.group))).toBe(true)
  })

  it('finds projectile skill levels on iron ring', () => {
    const hits = searchModTiers(data, {
      query: 'projectile skills',
      itemLevel: 86,
      limit: 30,
    })
    expect(hits.some((h) => h.baseType === 'Iron Ring')).toBe(true)
  })
})

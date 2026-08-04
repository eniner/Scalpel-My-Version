import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { itemStateFromPoeItem } from './pool'
import type { CraftDataset } from './types'

const data = JSON.parse(
  readFileSync(join(__dirname, '../data/crafting/crafting-coe-poe2.json'), 'utf8'),
) as CraftDataset

describe('marksman context opts', () => {
  it('honours marksmanEnabled override from worn belt when resolving PoeItem', () => {
    const gloves = {
      baseType: 'Secured Wraps',
      itemLevel: 86,
      rarity: 'Normal',
      itemClass: 'Gloves',
      corrupted: false,
      explicits: [] as string[],
      implicits: [] as string[],
    }
    const without = itemStateFromPoeItem(data, gloves)!
    expect(without.marksmanEnabled).toBe(false)

    const withBelt = itemStateFromPoeItem(data, gloves, { marksmanEnabled: true })!
    expect(withBelt.marksmanEnabled).toBe(true)
  })
})

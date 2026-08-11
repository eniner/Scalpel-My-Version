import { describe, expect, it } from 'vitest'
import type { PriceEntry } from '@scalpelpoe/plugin-sdk'
import type { EquippedItem } from './map-equipped'
import {
  evaluateBuildGear,
  lookupUniqueDivine,
  needsTradePriceCheck,
  priceCheckSearchPayload,
  variantUniqueMods,
} from './build-value'

function item(partial: Partial<EquippedItem> & Pick<EquippedItem, 'id' | 'name' | 'rarity'>): EquippedItem {
  return {
    slotLabel: 'Item',
    sortOrder: 1,
    baseType: partial.baseType ?? partial.name,
    itemClass: '',
    iconUrl: null,
    mods: [],
    corrupted: false,
    inventoryId: null,
    ...partial,
  }
}

describe('lookupUniqueDivine', () => {
  it('reads divineValue by name', () => {
    const prices = new Map<string, PriceEntry>([
      ['mageblood', { name: 'Mageblood', category: 'unique', chaosValue: 10000, divineValue: 40 }],
    ])
    expect(lookupUniqueDivine('Mageblood', prices)).toBe(40)
  })
})

describe('variant uniques', () => {
  it('detects Rite of Passage owl spirit', () => {
    const owl = item({
      id: '1',
      name: 'Rite of Passage',
      baseType: 'Golden Charm',
      rarity: 'Unique',
      mods: [
        {
          id: 'e0',
          kind: 'explicit',
          text: 'Possessed by Spirit of the Owl for 18 seconds on use',
        },
      ],
    })
    expect(variantUniqueMods(owl)).toHaveLength(1)
    expect(needsTradePriceCheck(owl)).toBe(true)
    const payload = priceCheckSearchPayload(owl)
    expect(payload.upgradeSearch).toBe(true)
    expect(payload.statPriority?.[0]).toMatch(/Owl/i)
  })
})

describe('evaluateBuildGear', () => {
  it('sums unique prices and leaves rares unpriced until trade override', () => {
    const prices = new Map<string, PriceEntry>([
      ['mageblood', { name: 'Mageblood', category: 'unique', chaosValue: 10000, divineValue: 40 }],
      [
        'the whispering ice',
        { name: 'The Whispering Ice', category: 'unique', chaosValue: 500, divineValue: 2 },
      ],
    ])
    const summary = evaluateBuildGear(
      [
        item({ id: '1', name: 'Mageblood', rarity: 'Unique', slotLabel: 'Belt' }),
        item({ id: '2', name: 'The Whispering Ice', rarity: 'Unique', slotLabel: 'Weapon 2' }),
        item({
          id: '3',
          name: 'Corpse Bane',
          baseType: 'Dueling Wand',
          rarity: 'Rare',
          slotLabel: 'Weapon',
        }),
      ],
      prices,
    )
    expect(summary.totalDivine).toBe(42)
    expect(summary.pricedCount).toBe(2)
    expect(summary.uniqueCount).toBe(2)
    expect(summary.rareCount).toBe(1)
    expect(summary.unpricedCount).toBe(1)
    expect(summary.rows[2]?.note).toMatch(/trade/i)
  })

  it('applies trade overrides for rares and variant uniques', () => {
    const prices = new Map<string, PriceEntry>()
    const summary = evaluateBuildGear(
      [
        item({
          id: 'wand',
          name: 'Corpse Bane',
          baseType: 'Dueling Wand',
          rarity: 'Rare',
        }),
        item({
          id: 'charm',
          name: 'Rite of Passage',
          baseType: 'Golden Charm',
          rarity: 'Unique',
          mods: [
            {
              id: 'e0',
              kind: 'explicit',
              text: 'Possessed by Spirit of the Owl for 18 seconds on use',
            },
          ],
        }),
      ],
      prices,
      {
        wand: { divine: 800, note: 'trade ~800 div' },
        charm: { divine: 45, note: 'trade owl' },
      },
    )
    expect(summary.totalDivine).toBe(845)
    expect(summary.pricedCount).toBe(2)
  })
})

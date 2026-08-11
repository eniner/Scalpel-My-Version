import { describe, expect, it } from 'vitest'
import { mapEquippedGear, stripNinjaTokens } from './map-equipped'
import { equippedToTradeSearch } from './upgrade-search'

describe('stripNinjaTokens', () => {
  it('expands [key|display] and [key] tokens', () => {
    expect(stripNinjaTokens('97% increased [EnergyShield|Energy Shield]')).toBe(
      '97% increased Energy Shield',
    )
  })
})

describe('mapEquippedGear', () => {
  it('maps all mod sources including fractured/desecrated/enchant/rune', () => {
    const gear = mapEquippedGear({
      items: [
        {
          itemSlot: 3,
          itemData: {
            inventoryId: 'BodyArmour',
            name: 'Loath Keep',
            baseType: 'Vile Robe',
            rarity: 'Rare',
            frameType: 2,
            corrupted: true,
            explicitMods: ['109% increased [EnergyShield|Energy Shield]', '+61 to [Spirit|Spirit]'],
            fracturedMods: ['+41% to [Resistances|Lightning Resistance]'],
            desecratedMods: ['+96 to maximum [EnergyShield|Energy Shield]'],
            enchantMods: ['20% of Damage taken [Recoup|Recouped] as Mana'],
            runeMods: [
              '60% increased [Armour|Armour], [Evasion|Evasion] and [EnergyShield|Energy Shield]',
            ],
          },
        },
      ],
    })

    expect(gear[0].mods.map((m) => `${m.kind}:${m.text}`)).toEqual([
      'enchant:20% of Damage taken Recouped as Mana',
      'fractured:+41% to Lightning Resistance',
      'desecrated:+96 to maximum Energy Shield',
      'rune:60% increased Armour, Evasion and Energy Shield',
      'explicit:109% increased Energy Shield',
      'explicit:+61 to Spirit',
    ])
  })
})

describe('upgrade-search', () => {
  it('passes selected mod texts and kinds', () => {
    const payload = equippedToTradeSearch(
      {
        id: '1',
        slotLabel: 'Weapon',
        sortOrder: 1,
        name: 'Corpse Bane',
        baseType: 'Dueling Wand',
        itemClass: 'Wands',
        rarity: 'Rare',
        iconUrl: null,
        mods: [
          { id: 'a', text: 'Gain 26% of Damage as Extra Cold Damage', kind: 'explicit' },
          { id: 'b', text: '+5 to Level of all Cold Spell Skills', kind: 'explicit' },
          { id: 'c', text: '46% increased Cast Speed', kind: 'crafted' },
        ],
        corrupted: false,
        inventoryId: 'Weapon',
      },
      {
        selectedMods: [
          { id: 'a', text: 'Gain 26% of Damage as Extra Cold Damage', kind: 'explicit' },
          { id: 'c', text: '46% increased Cast Speed', kind: 'crafted' },
        ],
      },
    )
    expect(payload.upgradeSearch).toBe(true)
    expect(payload.statPriority).toEqual([
      'Gain 26% of Damage as Extra Cold Damage',
      '46% increased Cast Speed',
    ])
    expect(payload.statKinds).toEqual(['explicit', 'crafted'])
  })
})

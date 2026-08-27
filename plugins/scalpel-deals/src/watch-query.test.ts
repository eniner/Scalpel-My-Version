import { describe, expect, it } from 'vitest'
import { defaultWatch } from './types'
import { parsePoeItemClipboard, watchFromParsedItem, watchToSearchItem } from './watch-query'

describe('watchToSearchItem', () => {
  it('sends the printed unique name and skips upgradeSearch', () => {
    const item = watchToSearchItem(
      defaultWatch({
        matchBy: 'uniqueName',
        rarity: 'Unique',
        itemName: 'Headhunter',
        baseType: 'Heavy Belt',
        mods: [{ text: '+40 to maximum Life', weight: 1, required: false }],
      }),
    )
    expect(item.rarity).toBe('Unique')
    expect(item.name).toBe('Headhunter')
    expect(item.baseType).toBe('Heavy Belt')
    expect(item.upgradeSearch).toBe(false)
    expect(item.statPriority).toEqual(['+40 to maximum Life'])
  })

  it('unique printed name without a base is still a unique name query', () => {
    const item = watchToSearchItem(
      defaultWatch({ matchBy: 'uniqueName', rarity: 'Unique', itemName: 'Goldrim', baseType: '' }),
    )
    expect(item.name).toBe('Goldrim')
    expect(item.baseType).toBe('')
    expect(item.rarity).toBe('Unique')
    expect(item.priceMin).toBeUndefined()
  })

  it('sends min/max divine on the trade query', () => {
    const item = watchToSearchItem(
      defaultWatch({
        matchBy: 'uniqueName',
        rarity: 'Unique',
        itemName: 'Temporalis',
        minPriceDivine: 1800,
        maxPriceDivine: 1900,
      }),
    )
    expect(item.name).toBe('Temporalis')
    expect(item.priceMin).toBe(1800)
    expect(item.priceMax).toBe(1900)
  })

  it('base match still uses mods as upgradeSearch', () => {
    const item = watchToSearchItem(
      defaultWatch({
        matchBy: 'base',
        rarity: 'Rare',
        baseType: 'Ruby Ring',
        mods: [{ text: '+40 to maximum Life', weight: 1, required: true }],
      }),
    )
    expect(item.name).toBe('')
    expect(item.rarity).toBe('Rare')
    expect(item.upgradeSearch).toBe(true)
    expect(item.statPriority).toEqual(['+40 to maximum Life'])
  })
})

describe('parsePoeItemClipboard', () => {
  it('reads a unique printed name and base', () => {
    const parsed = parsePoeItemClipboard(
      [
        'Item Class: Belts',
        'Rarity: Unique',
        'Headhunter',
        'Heavy Belt',
        '--------',
        'Item Level: 83',
        '--------',
        'Has 1 Charm Slot (implicit)',
      ].join('\n'),
    )
    expect(parsed).toMatchObject({
      rarity: 'Unique',
      name: 'Headhunter',
      baseType: 'Heavy Belt',
      itemClass: 'Belts',
      identified: true,
    })
    const watch = watchFromParsedItem(parsed!)
    expect(watch.matchBy).toBe('uniqueName')
    expect(watch.itemName).toBe('Headhunter')
    expect(watch.baseType).toBe('Heavy Belt')
    expect(watch.rarity).toBe('Unique')
  })

  it('reads a rare printed name as the label, not a unique query', () => {
    const parsed = parsePoeItemClipboard(
      [
        'Item Class: Rings',
        'Rarity: Rare',
        'Storm Knuckle',
        'Ruby Ring',
        '--------',
        'Item Level: 75',
        '--------',
        '+42 to maximum Life',
      ].join('\n'),
    )
    expect(parsed).toMatchObject({ name: 'Storm Knuckle', baseType: 'Ruby Ring', rarity: 'Rare' })
    const watch = watchFromParsedItem(parsed!)
    expect(watch.matchBy).toBe('base')
    expect(watch.itemName).toBe('')
    expect(watch.name).toBe('Storm Knuckle')
    expect(watch.baseType).toBe('Ruby Ring')
  })
})

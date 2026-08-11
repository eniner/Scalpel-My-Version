import { describe, expect, it } from 'vitest'
import { lookupBundledIcon, nameVariants, resolveItemIcon } from './icons'
import { idToName } from './prices'

describe('idToName', () => {
  it('keeps mid-string small words lowercase for icon/price keys', () => {
    expect(idToName('abyss-scarab-of-edifice')).toBe('Abyss Scarab of Edifice')
    expect(idToName('bestiary-scarab-of-the-herd')).toBe('Bestiary Scarab of the Herd')
    expect(idToName('deafening-essence-of-greed')).toBe('Deafening Essence of Greed')
  })
})

describe('nameVariants', () => {
  it('softens Title-Case Of/The for iconMap lookups', () => {
    expect(nameVariants('Abyss Scarab Of Edifice')).toEqual([
      'Abyss Scarab Of Edifice',
      'Abyss Scarab of Edifice',
    ])
    expect(nameVariants('Bestiary Scarab Of The Herd')).toEqual([
      'Bestiary Scarab Of The Herd',
      'Bestiary Scarab of the Herd',
    ])
  })
})

describe('lookupBundledIcon', () => {
  it('resolves gem and scarab art from the shipped PoE1 sheet', () => {
    expect(lookupBundledIcon('Cyclone')).toMatch(/^https:\/\/web\.poecdn\.com\//)
    expect(lookupBundledIcon('Animate Guardian of Smiting')).toMatch(/^https:\/\/web\.poecdn\.com\//)
    expect(lookupBundledIcon('Animate Guardian Of Smiting')).toMatch(/^https:\/\/web\.poecdn\.com\//)
    expect(lookupBundledIcon('Abyss Scarab')).toMatch(/^https:\/\/web\.poecdn\.com\//)
  })
})

describe('resolveItemIcon', () => {
  it('falls back to the bundled sheet when host iconMap is empty', () => {
    expect(resolveItemIcon('Elemental Hit of the Spectrum')).toMatch(/^https:\/\/web\.poecdn\.com\//)
    expect(resolveItemIcon('Unknown Item XYZ')).toBeNull()
  })
})

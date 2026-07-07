import { describe, it, expect, beforeEach } from 'vitest'
import { iconFor, iconMap, setUniquesByBase } from './constants'

function reset(icons: Record<string, string>, uniques: Record<string, string[]>): void {
  for (const k of Object.keys(iconMap)) delete iconMap[k]
  Object.assign(iconMap, icons)
  setUniquesByBase(uniques)
}

describe('iconFor', () => {
  beforeEach(() => {
    reset(
      {
        // Unique with its own icon.
        "Cospri's Will": 'cospri.png',
        // Base with art (a normal item drops on it).
        'Altar Robe': 'altar-robe.png',
        'The Covenant': 'the-covenant.png',
        // Unique-only base: no base icon, but a unique on it has art.
        'Myris Uxor': 'myris-uxor.png',
        // (Assassin Garb intentionally absent from icons.)
      },
      {
        'Assassin Garb': ["Cospri's Will"],
        'Altar Robe': ['The Covenant'],
        'Covert Hood': ['Myris Uxor'],
        'Lone Outpost': [], // base with empty unique list
      },
    )
  })

  it('returns the item-name icon when present', () => {
    expect(iconFor("Cospri's Will", 'Assassin Garb')).toBe('cospri.png')
  })

  it('falls back to the baseType icon when item-name is missing', () => {
    expect(iconFor('The Covenant', 'Altar Robe')).toBe('the-covenant.png')
    // Force the base path: name with no entry, baseType set.
    expect(iconFor('Unknown Unique', 'Altar Robe')).toBe('altar-robe.png')
  })

  it('falls back to a sibling unique icon for unique-only bases', () => {
    // No icon for the base (Assassin Garb) but Cospri's Will has art.
    expect(iconFor('Assassin Garb')).toBe('cospri.png')
    // Same logic when invoked with explicit baseType.
    expect(iconFor('Some Other Unique', 'Covert Hood')).toBe('myris-uxor.png')
  })

  it('treats name as the base when baseType is omitted', () => {
    // Triggered with a base name only -- still walks the base/sibling fallback chain.
    expect(iconFor('Altar Robe')).toBe('altar-robe.png')
  })

  it('returns undefined when nothing matches', () => {
    expect(iconFor('Unknown', 'Lone Outpost')).toBeUndefined()
    expect(iconFor('Unknown', 'Not A Base')).toBeUndefined()
    expect(iconFor('Unknown')).toBeUndefined()
  })
})

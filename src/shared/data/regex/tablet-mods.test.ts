import { describe, it, expect } from 'vitest'
import { TABLET_MODS } from './tablet-mods'
import { tabletRegex } from './vendor/tablets/Tablet.Gen'

describe('TABLET_MODS', () => {
  it('loads tablet mods from the generated data', () => {
    expect(TABLET_MODS.length).toBeGreaterThan(50)
  })
  it('every mod has a unique id', () => {
    const ids = new Set(TABLET_MODS.map((m) => m.id))
    expect(ids.size).toBe(TABLET_MODS.length)
  })
  it('every mod carries at least one tag and a non-empty regex', () => {
    for (const m of TABLET_MODS) {
      expect(m.tags.length, m.text).toBeGreaterThan(0)
      expect(m.regex.length, m.text).toBeGreaterThan(0)
    }
  })
  it('preserves the generated tabletRegex order (wrapper does not reorder)', () => {
    expect(TABLET_MODS.map((m) => m.id)).toEqual(tabletRegex.map((t) => t.id))
  })
  it('exposes prefix/suffix as the affix discriminator', () => {
    expect(TABLET_MODS.every((m) => m.affix === 'PREFIX' || m.affix === 'SUFFIX')).toBe(true)
  })
})

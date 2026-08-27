import { describe, expect, it } from 'vitest'
import { BOTH_GAME_TITLES, resolveInitialGameVersion, variantFromTitleIndex } from './overlay-attach'

describe('variantFromTitleIndex', () => {
  it('maps 0/1 to PoE1/PoE2', () => {
    expect(variantFromTitleIndex(0)).toBe(1)
    expect(variantFromTitleIndex(1)).toBe(2)
    expect(variantFromTitleIndex(-1)).toBeNull()
    expect(variantFromTitleIndex(undefined)).toBeNull()
  })
})

describe('resolveInitialGameVersion', () => {
  it('uses the running game over the stored profile', () => {
    expect(resolveInitialGameVersion(1, 2)).toBe(2)
    expect(resolveInitialGameVersion(2, 1)).toBe(1)
    expect(resolveInitialGameVersion(1, null)).toBe(1)
  })
})

describe('BOTH_GAME_TITLES', () => {
  it('is PoE1 then PoE2 so titleIndex matches the native contract', () => {
    expect(BOTH_GAME_TITLES).toEqual(['Path of Exile', 'Path of Exile 2'])
  })
})

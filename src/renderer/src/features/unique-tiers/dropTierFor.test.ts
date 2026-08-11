import { describe, expect, it } from 'vitest'
import { dropTierFor } from './constants'

describe('dropTierFor', () => {
  it('uses wiki drop-weight tiers, not prices', () => {
    expect(dropTierFor('Mageblood')).toBe('T0')
    expect(dropTierFor('Headhunter')).toBe('T0')
    expect(dropTierFor('Soul Taker')).toBe('T0')
    expect(dropTierFor('Marohi Erqi')).toBe('T0')
  })

  it('returns mid/common tiers for known commons', () => {
    expect(dropTierFor('Tabula Rasa')).toBe('T3')
    expect(dropTierFor('Goldrim')).toBe('T4')
  })

  it('returns null for unknown names', () => {
    expect(dropTierFor('Definitely Not A Unique')).toBeNull()
  })
})

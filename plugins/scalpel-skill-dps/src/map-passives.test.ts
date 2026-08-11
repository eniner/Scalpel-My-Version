import { describe, expect, it } from 'vitest'
import { mapAscendancyAndKeystones, passiveIconUrl } from './map-passives'

describe('passiveIconUrl', () => {
  it('maps PoB dds paths to poe2db webp', () => {
    expect(passiveIconUrl('Art/2DArt/SkillIcons/passives/KeystoneChaosInoculation.dds')).toBe(
      'https://cdn.poe2db.tw/image/Art/2DArt/SkillIcons/passives/KeystoneChaosInoculation.webp',
    )
  })

  it('maps ninja passives/ paths onto the same CDN', () => {
    expect(passiveIconUrl('passives/totemmax.webp')).toBe(
      'https://cdn.poe2db.tw/image/Art/2DArt/SkillIcons/passives/totemmax.webp',
    )
  })
})

describe('mapAscendancyAndKeystones', () => {
  it('resolves Oracle ascendancy notables and prefers ninja keystone text', () => {
    const cards = mapAscendancyAndKeystones({
      keystones: [
        {
          name: 'Chaos Inoculation',
          icon: 'passives/keystonechaosinoculation.webp',
          stats: ['Maximum Life is 1\nImmune to [Chaos] Damage'],
        },
      ],
      passiveSelection: [34313, 5571, 52374, 56349],
    })
    const names = cards.map((c) => c.name)
    expect(names).toContain('The Lesser Harm')
    expect(names).toContain('The Unseen Path')
    expect(names).toContain('Unnamed Heartwood')
    expect(names).toContain('Chaos Inoculation')
    const ci = cards.find((c) => c.name === 'Chaos Inoculation')!
    expect(ci.kind).toBe('keystone')
    expect(ci.iconUrl).toContain('KeystoneChaosInoculation.webp')
    expect(ci.stats.some((s) => /Immune to Chaos/i.test(s))).toBe(true)
    const lesser = cards.find((c) => c.name === 'The Lesser Harm')!
    expect(lesser.kind).toBe('ascendancy')
    expect(lesser.iconUrl).toContain('OracleEnemiesActionsUnlucky.webp')
  })
})

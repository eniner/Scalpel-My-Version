import { describe, expect, it } from 'vitest'
import { formatCompact, mapCharacterModel, ninjaClassIconUrl } from './map-skill-dps'
import { parseNinjaCharacterUrl, profileUrl } from './parse-ninja-url'

describe('parseNinjaCharacterUrl', () => {
  it('parses Aenthan profile URL', () => {
    const ref = parseNinjaCharacterUrl(
      'https://poe.ninja/poe2/profile/Enin9-6394/runesofaldur/character/Aenthan',
    )
    expect(ref).toEqual({
      account: 'Enin9-6394',
      league: 'runesofaldur',
      name: 'Aenthan',
    })
  })

  it('rejects non-profile URLs', () => {
    expect(parseNinjaCharacterUrl('https://poe.ninja/poe2/economy/runesofaldur')).toBeNull()
  })

  it('round-trips profileUrl', () => {
    const ref = { account: 'Enin9-6394', league: 'runesofaldur', name: 'Aenthan' }
    expect(parseNinjaCharacterUrl(profileUrl(ref))).toEqual(ref)
  })
})

describe('formatCompact', () => {
  it('matches ninja-style averages', () => {
    expect(formatCompact(84004)).toBe('84k')
    expect(formatCompact(19654)).toBe('20k')
    expect(formatCompact(1218)).toBe('1.2k')
    expect(formatCompact(283213)).toBe('283k')
  })
})

describe('ninjaClassIconUrl', () => {
  it('matches ninja class portrait slugs', () => {
    expect(ninjaClassIconUrl('Oracle')).toBe('https://assets.poe.ninja/poe2/classes/oracle.webp')
    expect(ninjaClassIconUrl('Blood Mage')).toBe('https://assets.poe.ninja/poe2/classes/blood-mage.webp')
    expect(ninjaClassIconUrl('Spirit Walker')).toBe(
      'https://assets.poe.ninja/poe2/classes/spirit-walker.webp',
    )
  })
})

describe('mapCharacterModel', () => {
  it('maps Aenthan-like skills to ninja UI numbers', () => {
    const mapped = mapCharacterModel({
      account: 'Enin9#6394',
      name: 'Aenthan',
      league: 'Runes of Aldur',
      level: 98,
      class: 'Oracle',
      defensiveStats: { life: 1, energyShield: 10491, mana: 1122, spirit: 406 },
      skills: [
        { allGems: [{ name: 'Purity of Lightning' }], dps: [] },
        {
          allGems: [
            {
              name: 'His Foul Emergence',
              itemData: {
                icon: 'https://web.poecdn.com/gen/image/BlankGem.png',
                gemSkill: 'https://web.poecdn.com/gen/image/ScreamingDevastation.png',
              },
            },
            { name: 'Considered Casting' },
          ],
          dps: [
            {
              name: 'His Foul Emergence',
              dps: 19654,
              damage: [19654, 17, 1, 22, 1, 59, 0],
              rate: 0.12470382840753,
              rateKind: 1,
              critChance: 100,
              critMultiplier: 4.98,
              hitChance: 100,
              duration: 8.019,
              aoeRadius: 2.6,
              offensive: {
                flat: [
                  { type: 'Cold', average: 6776.16, totalMin: 0, totalMax: 0 },
                  { type: 'Chaos', average: 18472, totalMin: 2260, totalMax: 4196 },
                ],
              },
            },
          ],
        },
        {
          allGems: [
            { name: 'Spell Totem' },
            {
              name: 'Grim Pillars',
              itemData: {
                icon: 'https://web.poecdn.com/gen/image/ExpeditionGrimPillarsGem.png',
              },
            },
            { name: "Vorana's Siege" },
          ],
          dps: [
            {
              name: 'Grim Pillars',
              dps: 283213,
              damage: [84004, 0, 1, 98, 1, 0, 1],
              rate: 3.3714285714286,
              rateKind: 1,
              critChance: 100,
              critMultiplier: 4.38,
              hitChance: 100,
              duration: 10.032,
              aoeRadius: 5.2,
              offensive: {
                flat: [
                  { type: 'Lightning', average: 180, totalMin: 0, totalMax: 0 },
                  { type: 'Cold', average: 18819, totalMin: 861, totalMax: 1291 },
                  { type: 'Fire', average: 180, totalMin: 0, totalMax: 0 },
                ],
              },
            },
          ],
        },
        {
          allGems: [
            {
              name: 'Entangle',
              itemData: { icon: 'https://web.poecdn.com/gen/image/DruidEntangleSkillGem.png' },
            },
          ],
          dps: [
            {
              name: 'Entangle',
              dps: 1218,
              damage: [1218, 38, 2, 58, 2, 0, 0],
              rate: 2.7333333333333,
              critChance: 100,
              critMultiplier: 3.99,
              aoeRadius: 9.9,
              duration: 8.019,
              offensive: { flat: [{ type: 'Physical', average: 34.625, totalMin: 28, totalMax: 42 }] },
            },
          ],
        },
      ],
    })

    expect(mapped.defenses.energyShield).toBe(10491)
    expect(mapped.defenses.classIconUrl).toBe('https://assets.poe.ninja/poe2/classes/oracle.webp')
    expect(mapped.skills.map((s) => s.name)).toEqual([
      'Grim Pillars',
      'His Foul Emergence',
      'Entangle',
    ])
    expect(mapped.skills[0].iconUrl).toContain('ExpeditionGrimPillarsGem')
    // BlankGem falls back to gemSkill art
    expect(mapped.skills[1].iconUrl).toContain('ScreamingDevastation')
    expect(mapped.skills[2].iconUrl).toContain('DruidEntangleSkillGem')

    const grim = mapped.skills[0]
    expect(formatCompact(grim.averageDamage)).toBe('84k')
    expect(grim.rate).toBeCloseTo(3.37, 1)
    expect(grim.critChance).toBe(100)
    expect(Math.round(grim.critMultiplier * 100)).toBe(438)
    expect(formatCompact(grim.flat.find((f) => f.type === 'Cold')!.average)).toBe('19k')

    expect(formatCompact(mapped.skills[1].averageDamage)).toBe('20k')
    expect(formatCompact(mapped.skills[2].averageDamage)).toBe('1.2k')
  })
})

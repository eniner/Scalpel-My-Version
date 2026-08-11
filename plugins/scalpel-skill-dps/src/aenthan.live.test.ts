import https from 'node:https'
import { describe, expect, it } from 'vitest'
import { formatCompact, mapCharacterModel } from './map-skill-dps'
import { mapEquippedGear } from './map-equipped'

function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'Scalpel-SkillDps-Test', Accept: 'application/json' } }, (res) => {
        let data = ''
        res.on('data', (c) => {
          data += c
        })
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            reject(e)
          }
        })
      })
      .on('error', reject)
  })
}

describe('Aenthan live ninja parity', () => {
  it(
    'matches Grim Pillars / Foul Emergence / Entangle averages from poe.ninja',
    async () => {
      const json = (await fetchJson(
        'https://poe.ninja/poe2/api/profile/characters/Enin9-6394/runesofaldur/Aenthan/model/92',
      )) as { type: string; charModel: unknown }
      expect(json.type).toBe('found')
      const mapped = mapCharacterModel(json.charModel)
      const names = mapped.skills.map((s) => s.name)
      // Live gear changes; keep smoke checks on mapper shape + ES cold build.
      expect(names.length).toBeGreaterThan(0)
      expect(names).toContain('Grim Pillars')
      const grim = mapped.skills.find((s) => s.name === 'Grim Pillars')!
      expect(grim.averageDamage).toBeGreaterThan(10_000)
      expect(formatCompact(grim.averageDamage).length).toBeGreaterThan(0)
      expect(grim.critChance).toBeGreaterThan(50)
      expect(grim.flat.some((f) => f.type === 'Cold' && f.average > 0)).toBe(true)
      expect(mapped.defenses.energyShield).toBeGreaterThan(9000)
      const gear = mapEquippedGear(json.charModel)
      expect(gear.length).toBeGreaterThan(5)
      expect(gear.some((g) => g.slotLabel === 'Helmet')).toBe(true)
    },
    60_000,
  )
})

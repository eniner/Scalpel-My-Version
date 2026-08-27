import { describe, expect, it } from 'vitest'
import type { PriceEntry } from '@shared/types'
import { generateFilter } from './generate'
import { parseFilterFile } from './parser'
import { isScalpelGenerated, originFromFilter, SCALPEL_GENERATOR_MARK } from './scalpel-owned'

function prices(entries: Array<Partial<PriceEntry> & { name: string; chaosValue: number }>): PriceEntry[] {
  return entries.map((e) => ({
    category: e.category ?? 'currency',
    ...e,
  }))
}

describe('generateFilter', () => {
  it('writes a Scalpel-owned header the parser and origin check both accept', () => {
    const text = generateFilter({
      game: 1,
      prices: [],
      uniquesByBase: {},
      generatedAt: new Date('2026-08-13T12:00:00.000Z'),
    })
    expect(text).toContain(SCALPEL_GENERATOR_MARK)
    expect(text).toContain('#name: Scalpel')
    expect(text).toContain('# game: poe1')
    expect(isScalpelGenerated(text)).toBe(true)
    expect(originFromFilter(text, 'Scalpel.filter')).toBe('scalpel')
    const file = parseFilterFile('Scalpel.filter', text)
    expect(file.blocks.length).toBeGreaterThan(3)
  })

  it('buckets currency by divine-relative price and tags typePath/tier', () => {
    const text = generateFilter({
      game: 1,
      prices: prices([
        { name: 'Divine Orb', chaosValue: 200, divineValue: 1, category: 'currency' },
        { name: 'Chaos Orb', chaosValue: 1, divineValue: 1 / 200, category: 'currency' },
        { name: "Jeweller's Orb", chaosValue: 0.2, divineValue: 0.001, category: 'currency' },
        { name: 'Mirror of Kalandra', chaosValue: 40000, divineValue: 200, category: 'currency' },
      ]),
      uniquesByBase: {},
      generatedAt: new Date('2026-08-13T12:00:00.000Z'),
    })
    const file = parseFilterFile('Scalpel.filter', text)
    const t1 = file.blocks.find((b) => b.tierTag?.typePath === 'currency' && b.tierTag.tier === 't1')
    const t4 = file.blocks.find((b) => b.tierTag?.typePath === 'currency' && b.tierTag.tier === 't4')
    expect(t1?.visibility).toBe('Show')
    expect(t1?.conditions.find((c) => c.type === 'BaseType')?.values).toEqual(
      expect.arrayContaining(['Divine Orb', 'Mirror of Kalandra']),
    )
    expect(t1?.conditions.find((c) => c.type === 'BaseType')?.values).not.toContain('Chaos Orb')
    expect(t4?.conditions.find((c) => c.type === 'BaseType')?.values).toContain('Chaos Orb')
  })

  it('places unique bases by the most expensive unique on that base even when the cheap unique is listed first', () => {
    const text = generateFilter({
      game: 1,
      prices: prices([
        { name: 'Divine Orb', chaosValue: 200, divineValue: 1, category: 'currency' },
        { name: "Wurm's Molt", chaosValue: 1, divineValue: 0.005, category: 'unique-accessories' },
        { name: 'Headhunter', chaosValue: 4000, divineValue: 20, category: 'unique-accessories' },
      ]),
      uniquesByBase: { 'Leather Belt': ['Headhunter', "Wurm's Molt"] },
      generatedAt: new Date('2026-08-13T12:00:00.000Z'),
    })
    const file = parseFilterFile('Scalpel.filter', text)
    const t1 = file.blocks.find((b) => b.tierTag?.typePath === 'uniques' && b.tierTag.tier === 't1')
    expect(t1?.conditions.find((c) => c.type === 'BaseType')?.values).toContain('Leather Belt')
  })

  it('does not list the same unique base in two tiers', () => {
    const text = generateFilter({
      game: 1,
      prices: prices([
        { name: 'Divine Orb', chaosValue: 200, divineValue: 1, category: 'currency' },
        { name: 'Headhunter', chaosValue: 4000, divineValue: 20, category: 'unique-accessories' },
        { name: "Wurm's Molt", chaosValue: 1, divineValue: 0.005, category: 'unique-accessories' },
      ]),
      uniquesByBase: { 'Leather Belt': ['Headhunter', "Wurm's Molt"] },
      generatedAt: new Date('2026-08-13T12:00:00.000Z'),
    })
    const file = parseFilterFile('Scalpel.filter', text)
    const uniqueBlocks = file.blocks.filter((b) => b.tierTag?.typePath === 'uniques' && b.tierTag.tier !== 'other')
    const listed = uniqueBlocks.flatMap((b) =>
      b.conditions.filter((c) => c.type === 'BaseType').flatMap((c) => c.values),
    )
    expect(listed.filter((v) => v === 'Leather Belt')).toHaveLength(1)
  })

  it('uses Maps in PoE1 and Waystones in PoE2', () => {
    const poe1 = parseFilterFile(
      'a.filter',
      generateFilter({ game: 1, prices: [], uniquesByBase: {}, generatedAt: new Date() }),
    )
    const poe2 = parseFilterFile(
      'b.filter',
      generateFilter({ game: 2, prices: [], uniquesByBase: {}, generatedAt: new Date() }),
    )
    const classOf = (file: typeof poe1, tier: string): string | undefined =>
      file.blocks
        .find((b) => b.tierTag?.typePath === 'maps' && b.tierTag.tier === tier)
        ?.conditions.find((c) => c.type === 'Class')?.values[0]
    expect(classOf(poe1, 'any')).toBe('Maps')
    expect(classOf(poe2, 'any')).toBe('Waystones')
    expect(classOf(poe2, 'tablet')).toBe('Tablet')
  })

  it('hides remaining drops in maps and shows them while leveling', () => {
    const file = parseFilterFile(
      'Scalpel.filter',
      generateFilter({ game: 1, prices: [], uniquesByBase: {}, generatedAt: new Date() }),
    )
    const hide = file.blocks.find((b) => b.tierTag?.typePath === 'endgame')
    const show = file.blocks.find((b) => b.tierTag?.typePath === 'leveling')
    expect(hide?.visibility).toBe('Hide')
    expect(hide?.conditions.find((c) => c.type === 'AreaLevel')?.values).toEqual(['68'])
    expect(show?.visibility).toBe('Show')
    expect(show?.conditions).toEqual([])
    expect(file.blocks.at(-1)?.tierTag?.typePath).toBe('leveling')
  })

  it('originFromFilter keeps FilterBlade local copies distinct from Scalpel files', () => {
    expect(originFromFilter('#name: NeverSink\nShow\n', 'NeverSink-local.filter')).toBe('filterblade')
    expect(originFromFilter('#name: Mine\nShow\n', 'Mine.filter')).toBe('other')
  })
})

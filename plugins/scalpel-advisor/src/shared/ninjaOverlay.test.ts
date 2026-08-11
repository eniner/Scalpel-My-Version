import { describe, expect, it } from 'vitest'
import type { PriceEntry } from '@scalpelpoe/plugin-sdk'
import { applyNinjaToGemLeveling, applyNinjaToTransfig } from './ninjaOverlay'
import { chaosBandForName, chaosFloor } from './prices'
import type { GemLevelingData } from '../engines/gemLeveling'
import type { TransfigData } from '../engines/transfig'

describe('chaosBandForName', () => {
  it('returns min/max across duplicate gem names', () => {
    const entries: PriceEntry[] = [
      { name: 'Spark', category: 'skill-gem', chaosValue: 1 },
      { name: 'Spark', category: 'skill-gem', chaosValue: 40 },
      { name: 'Spark', category: 'skill-gem', chaosValue: 12 },
      { name: 'Other', category: 'skill-gem', chaosValue: 99 },
    ]
    expect(chaosBandForName(entries, 'Spark')).toEqual({ min: 1, max: 40 })
    expect(chaosBandForName(entries, 'Missing')).toBeNull()
  })
})

describe('applyNinjaToGemLeveling', () => {
  const base: GemLevelingData = {
    league: 'test',
    normalXp: 1,
    exceptionalXp: 1,
    xpRatio: 1,
    gcpFloors: { chaos: 3 },
    volume: {},
    gems: [
      {
        name: 'Spark',
        type: 'skill',
        color: 'b',
        buyLevel: 1,
        sellLevel: 20,
        xpMultiplier: 1,
        hasBuyCost: true,
        buyFloors: { chaos: 9 },
        buyListings: 10,
        sellLowFloors: { chaos: 20 },
        sellLowListings: 10,
        sellHighFloors: { chaos: 50 },
        sellHighListings: 10,
      },
    ],
  }

  it('overlays ninja min/max onto floors and keeps listing counts', () => {
    const entries: PriceEntry[] = [
      { name: 'Spark', category: 'skill-gem', chaosValue: 2 },
      { name: 'Spark', category: 'skill-gem', chaosValue: 80 },
      { name: "Gemcutter's Prism", category: 'currency', chaosValue: 5 },
    ]
    const next = applyNinjaToGemLeveling(base, entries)
    expect(next.gems[0].buyFloors).toEqual({ chaos: 2 })
    expect(next.gems[0].sellLowFloors).toEqual({ chaos: 2 })
    expect(next.gems[0].sellHighFloors).toEqual({ chaos: 80 })
    expect(next.gems[0].sellLowListings).toBe(10)
    expect(next.gcpFloors).toEqual({ chaos: 5 })
  })
})

describe('applyNinjaToTransfig', () => {
  const base: TransfigData = {
    exceptionalPrices: { 'Empower Support': { chaos: 10 } },
    bases: [
      {
        baseName: 'Spark',
        color: 'blue',
        baseFloors: { chaos: 1 },
        baseFloorsMax: { chaos: 4 },
        baseMaxLevel: 20,
        variants: [
          {
            gemName: 'Spark of the Nova',
            floors: { chaos: 3 },
            floorsMax: { chaos: 30 },
            maxLevel: 20,
            listings: 5,
            listingsMax: 2,
            volume24h: 10,
            volume24hMax: 4,
          },
        ],
      },
    ],
  }

  it('overlays variant and exceptional floors from ninja', () => {
    const entries: PriceEntry[] = [
      { name: 'Spark of the Nova', category: 'skill-gem', chaosValue: 7 },
      { name: 'Spark of the Nova', category: 'skill-gem', chaosValue: 70 },
      { name: 'Empower Support', category: 'skill-gem', chaosValue: 200 },
    ]
    const next = applyNinjaToTransfig(base, entries)
    expect(next.bases[0].variants[0].floors).toEqual({ chaos: 7 })
    expect(next.bases[0].variants[0].floorsMax).toEqual({ chaos: 70 })
    expect(next.bases[0].variants[0].volume24h).toBe(10)
    expect(next.exceptionalPrices['Empower Support']).toEqual({ chaos: 200 })
  })
})

describe('chaosFloor', () => {
  it('prefers live chaos then fallback', () => {
    expect(chaosFloor(4, { chaos: 1 })).toEqual({ chaos: 4 })
    expect(chaosFloor(null, { chaos: 1 })).toEqual({ chaos: 1 })
    expect(chaosFloor(0, { chaos: 1 })).toEqual({ chaos: 1 })
  })
})

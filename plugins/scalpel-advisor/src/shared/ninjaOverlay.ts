import type { PriceEntry } from '@scalpelpoe/plugin-sdk'
import type { GemLevelingData } from '../engines/gemLeveling'
import type { TransfigData } from '../engines/transfig'
import { chaosBandForName, chaosFloor, chaosForName, indexPrices } from './prices'

/**
 * Overlay poe.ninja chaos onto gem-leveling floors.
 * Weights / XP / listing counts / volume stay from the bundled ref JSON.
 * SkillGem overviews emit multiple variants per name — use min as buy/0q floor, max as 20q.
 */
export function applyNinjaToGemLeveling(data: GemLevelingData, entries: PriceEntry[]): GemLevelingData {
  const byName = indexPrices(entries)
  const gcp = chaosForName(byName, "Gemcutter's Prism")

  return {
    ...data,
    gcpFloors: chaosFloor(gcp, data.gcpFloors) ?? data.gcpFloors,
    gems: data.gems.map((gem) => {
      const band = chaosBandForName(entries, gem.name)
      if (!band) return gem
      return {
        ...gem,
        buyFloors: gem.hasBuyCost ? chaosFloor(band.min, gem.buyFloors) : gem.buyFloors,
        sellLowFloors: chaosFloor(band.min, gem.sellLowFloors),
        sellHighFloors: chaosFloor(band.max, gem.sellHighFloors),
      }
    }),
  }
}

/**
 * Overlay poe.ninja chaos onto transfig floors.
 * Variant lists / colors / volume thresholds stay from the bundled ref JSON.
 */
export function applyNinjaToTransfig(data: TransfigData, entries: PriceEntry[]): TransfigData {
  const exceptionalPrices = { ...data.exceptionalPrices }
  for (const name of Object.keys(exceptionalPrices)) {
    const band = chaosBandForName(entries, name)
    if (band) exceptionalPrices[name] = chaosFloor(band.max, exceptionalPrices[name]) ?? exceptionalPrices[name]
  }

  return {
    exceptionalPrices,
    bases: data.bases.map((base) => {
      const baseBand = chaosBandForName(entries, base.baseName)
      return {
        ...base,
        baseFloors: chaosFloor(baseBand?.min, base.baseFloors),
        baseFloorsMax: chaosFloor(baseBand?.max, base.baseFloorsMax),
        variants: base.variants.map((v) => {
          const band = chaosBandForName(entries, v.gemName)
          if (!band) return v
          return {
            ...v,
            floors: chaosFloor(band.min, v.floors),
            floorsMax: chaosFloor(band.max, v.floorsMax),
          }
        }),
      }
    }),
  }
}

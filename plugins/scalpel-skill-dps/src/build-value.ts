import type { PluginTradeSearchItem, PriceEntry } from '@scalpelpoe/plugin-sdk'
import type { EquippedItem, EquippedMod } from './map-equipped'

export type GearValueRow = {
  item: EquippedItem
  /** Estimated divine value when known. */
  divine: number | null
  /** Why it has no price / how it was priced. */
  note: string | null
}

export type BuildValueSummary = {
  rows: GearValueRow[]
  /** Sum of priced rows in divine. */
  totalDivine: number
  pricedCount: number
  uniqueCount: number
  rareCount: number
  unpricedCount: number
}

/** Look up a unique by exact name (case-insensitive) in Scalpel's ninja price table. */
export function lookupUniqueDivine(
  name: string,
  prices: Map<string, PriceEntry>,
  divinePerChaos?: number | null,
): number | null {
  const hit = prices.get(name.trim().toLowerCase())
  if (!hit) return null
  if (hit.divineValue != null && Number.isFinite(hit.divineValue) && hit.divineValue > 0) {
    return hit.divineValue
  }
  if (hit.chaosValue != null && hit.chaosValue > 0 && divinePerChaos != null && divinePerChaos > 0) {
    return hit.chaosValue / divinePerChaos
  }
  return null
}

/** Infer chaos-per-divine from any priced unique that has both values. */
export function inferDivinePerChaos(prices: Iterable<PriceEntry>): number | null {
  for (const p of prices) {
    if (p.divineValue != null && p.divineValue > 0 && p.chaosValue > 0) {
      return p.chaosValue / p.divineValue
    }
  }
  return null
}

/** Spirit / possession lines that make ninja's averaged unique price too low. */
export function variantUniqueMods(item: EquippedItem): EquippedMod[] {
  return item.mods.filter((m) => /spirit of the|possessed by/i.test(m.text))
}

/** True when live trade is needed (rares, or uniques with spirit variants). */
export function needsTradePriceCheck(item: EquippedItem): boolean {
  if (item.rarity === 'Rare' || item.rarity === 'Magic') return true
  if (item.rarity === 'Unique' && variantUniqueMods(item).length > 0) return true
  return false
}

/** Build the trade payload used for a live price check. */
export function priceCheckSearchPayload(
  item: EquippedItem,
  selectedMods?: EquippedMod[],
  similarItems = false,
): PluginTradeSearchItem {
  if (item.rarity === 'Unique') {
    const variants = variantUniqueMods(item)
    return {
      name: item.name,
      baseType: item.baseType,
      itemClass: item.itemClass,
      rarity: 'Unique',
      upgradeSearch: variants.length > 0,
      statPriority: variants.map((m) => m.text),
      statKinds: variants.map((m) => m.kind),
    }
  }

  const selected = (selectedMods ?? item.mods.filter((m) => !/^bonded:/i.test(m.text))).filter((m) =>
    m.text.trim(),
  )

  return {
    name: '',
    baseType: similarItems ? '' : item.baseType,
    itemClass: item.itemClass,
    rarity: item.rarity === 'Magic' ? 'Magic' : 'Rare',
    similarItems,
    upgradeSearch: true,
    statPriority: selected.map((m) => m.text),
    statKinds: selected.map((m) => m.kind),
  }
}

/**
 * Value equipped gear. Uniques use poe.ninja economy prices unless a trade
 * override is supplied (rares / spirit-variant uniques).
 */
export function evaluateBuildGear(
  gear: EquippedItem[],
  prices: Map<string, PriceEntry>,
  tradeOverrides?: Record<string, { divine: number | null; note: string | null }>,
): BuildValueSummary {
  const divinePerChaos = inferDivinePerChaos(prices.values())
  const rows: GearValueRow[] = []
  let totalDivine = 0
  let pricedCount = 0
  let uniqueCount = 0
  let rareCount = 0
  let unpricedCount = 0

  for (const item of gear) {
    const override = tradeOverrides?.[item.id]
    if (override) {
      if (item.rarity === 'Unique') uniqueCount += 1
      if (item.rarity === 'Rare' || item.rarity === 'Magic') rareCount += 1
      if (override.divine != null) {
        rows.push({ item, divine: override.divine, note: override.note })
        totalDivine += override.divine
        pricedCount += 1
      } else {
        rows.push({ item, divine: null, note: override.note ?? 'no trade listings' })
        unpricedCount += 1
      }
      continue
    }

    if (item.rarity === 'Unique') {
      uniqueCount += 1
      if (variantUniqueMods(item).length > 0) {
        rows.push({ item, divine: null, note: 'variant — price via trade' })
        unpricedCount += 1
        continue
      }
      const divine = lookupUniqueDivine(item.name, prices, divinePerChaos)
      if (divine != null) {
        rows.push({ item, divine, note: 'ninja' })
        totalDivine += divine
        pricedCount += 1
      } else {
        rows.push({ item, divine: null, note: 'no ninja price' })
        unpricedCount += 1
      }
      continue
    }

    if (item.rarity === 'Rare' || item.rarity === 'Magic') {
      rareCount += 1
      rows.push({ item, divine: null, note: 'rare — price via trade' })
      unpricedCount += 1
      continue
    }

    rows.push({ item, divine: null, note: 'unpriced' })
    unpricedCount += 1
  }

  return { rows, totalDivine, pricedCount, uniqueCount, rareCount, unpricedCount }
}

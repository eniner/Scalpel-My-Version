import type { StatFilter } from '../../trade'
import { matchModToStat } from '../mod-matcher'
import { GEM_LEVEL_MOD } from './explicits'

type EnchantItemInfo = {
  enchants?: string[]
  baseType?: string
}

/** Match a clipboard enchant line to a trade stat. PoE2 { Corruption Enhancement }
 *  lines land in enchants[], but many corruption rolls (e.g. "+N to Level of all
 *  Curse Skills" on The Vertex) are indexed under implicit.* in the trade API, not
 *  enchant.* -- mirror the implicit producer's explicit fallback when enchant fails. */
function matchEnchantLine(
  enchant: string,
  preferLocal: boolean,
): { statId: string; value: number | null; option?: number; aggregated?: boolean } | null {
  const direct = matchModToStat(enchant, preferLocal, 'enchant')
  if (direct) return direct

  const implicit = matchModToStat(enchant, false, 'implicit')
  if (implicit) return implicit

  const fallback = matchModToStat(enchant, false, 'explicit') ?? matchModToStat(enchant, true, 'explicit')
  if (!fallback) return null
  return { ...fallback, statId: `implicit.${fallback.statId.split('.')[1]}` }
}

function filterTypeForStatId(statId: string): StatFilter['type'] {
  return statId.startsWith('implicit.') ? 'implicit' : 'enchant'
}

// Process enchant lines (cluster jewel enchantments, weapon/armour corruption
// enchantments). `preferLocal` is set for items that carry local affixes
// (weapons/armour): their enchants -- e.g. a "Corruption Enhancement" granting
// "increased Attack Speed" -- live under the trade API's "(Local)" enchant stat,
// which matchModToStat otherwise discards in favour of a global lookalike (#399).
export function buildEnchantFilters(itemInfo: EnchantItemInfo | undefined, preferLocal = false): StatFilter[] {
  const enchantFilters: StatFilter[] = []
  if (itemInfo?.enchants) {
    for (const enchant of itemInfo.enchants) {
      const matched = matchEnchantLine(enchant, preferLocal)
      if (matched) {
        let minVal: number | null = matched.option ? null : matched.value
        let maxVal: number | null = null
        // Cluster jewel "Adds N Passive Skills": passive count drives price more
        // than any other roll, so the bracketed defaults below override the usual
        // "min = value" rule for the disjoint price tiers:
        //   Medium 4/5 -- functionally identical; a 6 is either cheap filler or
        //     a stat-stacker target, so 4-5 inclusive excludes both ends.
        //   Large 8 -- 8s and 12s are price-disjoint with no in-between, so an
        //     8-search wants max 8 (else every 12 surfaces).
        const isAddsPassives = enchant.includes('Adds') && matched.value != null
        if (isAddsPassives && itemInfo.baseType === 'Medium Cluster Jewel') {
          if (matched.value === 4 || matched.value === 5) {
            minVal = 4
            maxVal = 5
          }
        } else if (isAddsPassives && itemInfo.baseType === 'Large Cluster Jewel') {
          if (matched.value === 8) {
            minVal = null
            maxVal = 8
          }
        } else if (GEM_LEVEL_MOD.test(enchant) && matched.value != null) {
          // Gem/curse level corruption rolls are discrete brackets -- pin the exact value.
          minVal = matched.value
          maxVal = matched.value
        }
        enchantFilters.push({
          id: matched.statId,
          text: enchant,
          value: matched.value,
          min: minVal,
          max: maxVal,
          enabled: true,
          type: filterTypeForStatId(matched.statId),
          option: matched.option,
          aggregated: matched.aggregated,
        })
      }
    }
  }
  return enchantFilters
}

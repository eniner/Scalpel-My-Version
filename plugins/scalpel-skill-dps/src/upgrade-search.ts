import type { PluginTradeSearchItem } from '@scalpelpoe/plugin-sdk'
import type { EquippedItem, EquippedMod } from './map-equipped'

/**
 * Build a Scalpel trade openSearch payload for an equipped item.
 * Uniques → exact name search. Rares → only the mods you pass (checked UI).
 */
export function equippedToTradeSearch(
  item: EquippedItem,
  opts?: {
    similarItems?: boolean
    /** Mods the user checked. */
    selectedMods?: EquippedMod[]
  },
): PluginTradeSearchItem {
  const similarItems = opts?.similarItems ?? false

  if (item.rarity === 'Unique') {
    return {
      name: item.name,
      baseType: item.baseType,
      itemClass: item.itemClass,
      rarity: 'Unique',
    }
  }

  const selected = (opts?.selectedMods ?? []).filter((m) => m.text.trim())

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

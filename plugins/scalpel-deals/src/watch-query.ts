import type { SearchItem } from './host-trade'
import { defaultWatch, type Watch } from './types'

export type ParsedWatchItem = {
  name: string
  baseType: string
  itemClass: string
  rarity: Watch['rarity']
  identified: boolean
  explicits: string[]
}

export function isUniqueMatch(watch: Watch): boolean {
  return watch.matchBy === 'uniqueName' || watch.rarity === 'Unique'
}

export function watchToSearchItem(watch: Watch): SearchItem {
  const unique = isUniqueMatch(watch)
  const rarity: SearchItem['rarity'] = unique ? 'Unique' : watch.rarity === 'Any' ? 'Rare' : watch.rarity
  const printed = watch.itemName.trim()
  const baseType = watch.baseType.trim()
  const mods = watch.mods.map((m) => m.text).filter((t) => t.trim())
  return {
    name: unique ? printed : '',
    baseType,
    itemClass: watch.itemClass.trim() || undefined,
    rarity,
    statPriority: mods.length > 0 ? mods : undefined,
    similarItems: !unique && !baseType && Boolean(watch.itemClass.trim()),
    upgradeSearch: !unique && mods.length > 0,
    listedTime: watch.listedTime.trim() || undefined,
    priceMin: watch.minPriceDivine ?? undefined,
    priceMax: watch.maxPriceDivine ?? undefined,
  }
}

/** Header-only parse of a PoE Ctrl+C clipboard dump (unique/rare printed names). */
export function parsePoeItemClipboard(text: string): ParsedWatchItem | null {
  const raw = text.replace(/\r\n/g, '\n').trim()
  if (!raw) return null
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const classLine = lines.find((l) => l.startsWith('Item Class:'))
  const rarityLine = lines.find((l) => l.startsWith('Rarity:'))
  if (!classLine || !rarityLine) return null
  const itemClass = classLine.slice('Item Class:'.length).trim()
  const rarityRaw = rarityLine.slice('Rarity:'.length).trim()
  const rarity: Watch['rarity'] =
    rarityRaw === 'Unique' || rarityRaw === 'Magic' || rarityRaw === 'Rare' ? rarityRaw : 'Rare'
  const afterRarity = lines.slice(lines.indexOf(rarityLine) + 1).filter((l) => l !== '--------')
  const first = afterRarity[0] ?? ''
  const second = afterRarity[1] ?? ''
  const identified = !lines.some((l) => /^Unidentified$/i.test(l))
  const name = rarity === 'Rare' || rarity === 'Unique' ? first : first
  const baseType =
    rarity === 'Rare' || rarity === 'Unique' ? (identified && second && second !== '--------' ? second : first) : first
  const explicits: string[] = []
  for (const line of lines) {
    if (
      line.startsWith('Item Class:') ||
      line.startsWith('Rarity:') ||
      line.startsWith('Item Level:') ||
      line.startsWith('Requires ') ||
      line.startsWith('--------') ||
      line === name ||
      line === baseType ||
      /^\d+$/.test(line)
    ) {
      continue
    }
    if (/^\+?\d/.test(line) || /increased|to |more |reduced |additional /i.test(line)) {
      explicits.push(line.replace(/\s*\(implicit\)\s*$/i, ''))
    }
  }
  return { name, baseType, itemClass, rarity, identified, explicits: explicits.slice(0, 8) }
}

export function watchFromParsedItem(item: ParsedWatchItem, partial?: Partial<Watch>): Watch {
  const unique = item.rarity === 'Unique'
  const printedUnique = unique && item.identified && item.name && item.name !== item.baseType ? item.name : ''
  const label = unique ? printedUnique || item.baseType || 'Unique watch' : item.name || item.baseType || 'New watch'
  return defaultWatch({
    name: label,
    baseType: item.baseType || '',
    itemClass: item.itemClass || '',
    itemName: printedUnique,
    rarity: unique ? 'Unique' : item.rarity,
    matchBy: unique ? 'uniqueName' : 'base',
    mods: unique
      ? []
      : item.explicits.slice(0, 6).map((text) => ({ text, weight: 1, required: false })),
    ...partial,
  })
}

import type { PriceEntry } from '@shared/types'

/** Currency-style overviews expose icons via `currencyDetails`. */
const CURRENCY_ICON_TYPES = new Set(['Currency', 'Fragment'])

/**
 * Item overviews that currently return per-line `icon` from
 * `/poe1/api/economy/stash/current/item/overview`. Kept tight — BaseType is
 * huge and not useful for the Economy panel.
 */
const ITEM_ICON_TYPES = new Set([
  'UniqueWeapon',
  'UniqueArmour',
  'UniqueAccessory',
  'UniqueFlask',
  'UniqueJewel',
  'UniqueMap',
  'UniqueRelic',
  'UniqueIdol',
  'UniqueTincture',
  'SkillGem',
  'ImbuedGem',
  'ClusterJewel',
  'ForbiddenJewel',
  'Beast',
  'Map',
  'ValdoMap',
  'BlightedMap',
  'BlightRavagedMap',
  'Incubator',
  'Vial',
  'Invitation',
  'Flask',
  'ShrineBelt',
  'Wombgift',
  'IncursionTemple',
])

type FetchJson = (url: string) => Promise<unknown>

function currencyOverviewUrl(league: string, type: string): string {
  return `https://poe.ninja/poe1/api/economy/stash/current/currency/overview?league=${encodeURIComponent(league)}&type=${encodeURIComponent(type)}`
}

function itemOverviewUrl(league: string, type: string): string {
  return `https://poe.ninja/poe1/api/economy/stash/current/item/overview?league=${encodeURIComponent(league)}&type=${encodeURIComponent(type)}`
}

/** Pull name→icon from ninja stash overviews for the given dense overview types. */
export async function fetchPoe1IconMap(
  league: string,
  overviewTypes: string[],
  fetchJson: FetchJson,
): Promise<Map<string, string>> {
  const icons = new Map<string, string>()
  const types = [...new Set(overviewTypes)].filter(
    (t) => CURRENCY_ICON_TYPES.has(t) || ITEM_ICON_TYPES.has(t),
  )

  await Promise.all(
    types.map(async (type) => {
      try {
        if (CURRENCY_ICON_TYPES.has(type)) {
          const data = (await fetchJson(currencyOverviewUrl(league, type))) as {
            currencyDetails?: Array<{ name?: string; icon?: string }>
          }
          for (const d of data.currencyDetails ?? []) {
            if (d.name && d.icon) icons.set(d.name, d.icon)
          }
          return
        }
        const data = (await fetchJson(itemOverviewUrl(league, type))) as {
          lines?: Array<{ name?: string; icon?: string }>
        }
        for (const line of data.lines ?? []) {
          if (line.name && line.icon) icons.set(line.name, line.icon)
        }
      } catch (err) {
        console.error(`[FilterScalpel] PoE1 icon fetch failed for ${type}:`, err)
      }
    }),
  )

  return icons
}

/** Fill missing PriceEntry.icon from a name→icon map (does not overwrite). */
export function applyIconMapToEntries(entries: PriceEntry[], icons: Map<string, string>): void {
  if (icons.size === 0) return
  for (const entry of entries) {
    if (entry.icon) continue
    const icon = icons.get(entry.name)
    if (icon) entry.icon = icon
  }
}

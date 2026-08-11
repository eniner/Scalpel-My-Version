import type { CoeCatalog, CoeCatalogFamily, CoeCatalogGroup, CoeCatalogItem } from './catalog-types'

let cached: CoeCatalog | null = null

export async function loadCoeCatalog(): Promise<CoeCatalog> {
  if (cached) return cached
  const mod = await import('@shared/data/crafting/crafting-coe-catalog.json')
  cached = (mod.default ?? mod) as CoeCatalog
  return cached
}

export function catalogGroups(catalog: CoeCatalog): CoeCatalogGroup[] {
  return catalog.groups
}

export function catalogFamilies(catalog: CoeCatalog, groupId: string): CoeCatalogFamily[] {
  return catalog.families.filter((f) => f.groupId === groupId)
}

export function catalogItems(catalog: CoeCatalog, familyId: string): CoeCatalogItem[] {
  return catalog.items.filter((i) => i.familyId === familyId)
}

export function catalogItemByName(catalog: CoeCatalog, name: string): CoeCatalogItem | undefined {
  const lower = name.toLowerCase()
  return catalog.items.find((i) => i.name.toLowerCase() === lower)
}

export function catalogItemById(catalog: CoeCatalog, id: string): CoeCatalogItem | undefined {
  return catalog.items.find((i) => i.id === id)
}

/** Display lines for a base card (CoE-style). */
export function catalogItemCardLines(item: CoeCatalogItem, quality = 20): string[] {
  const lines: string[] = [`Quality: ${quality}%`]
  const p = item.props
  const q = 1 + quality / 100
  const scale = (v: number) => Math.round(v * q)
  if (p.armour != null) lines.push(`Armour: ${scale(Number(p.armour))}`)
  if (p.evasion != null) lines.push(`Evasion: ${scale(Number(p.evasion))}`)
  if (p.energyshield != null || p.energy_shield != null) {
    lines.push(`Energy Shield: ${scale(Number(p.energyshield ?? p.energy_shield))}`)
  }
  if (p.ward != null) lines.push(`Ward: ${scale(Number(p.ward))}`)
  if (p.block != null) lines.push(`Block: ${p.block}`)
  const lvl = item.requirements.level ?? item.dropLevel
  if (lvl != null) lines.push(`Requires Level ${lvl}`)
  for (const imp of item.implicits) lines.push(imp)
  return lines
}

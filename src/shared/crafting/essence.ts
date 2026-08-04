import type { CraftDataset, CraftEssenceEntry, CraftEssenceForcedMod } from './types'

export function findEssence(data: CraftDataset, name: string): CraftEssenceEntry | undefined {
  return data.essences?.find((e) => e.name === name)
}

export function essenceForcedMod(
  data: CraftDataset,
  essenceName: string,
  baseType: string,
): CraftEssenceForcedMod | undefined {
  return findEssence(data, essenceName)?.bases?.[baseType]
}

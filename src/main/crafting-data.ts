import type { CraftDataset } from '@shared/crafting/types'
import { getPoeVersion } from './game-state'

let cached: CraftDataset | null = null

export function getCraftDataset(): CraftDataset | null {
  if (getPoeVersion() !== 2) return null
  return cached
}

export async function loadCraftData(): Promise<void> {
  if (getPoeVersion() !== 2) {
    cached = null
    return
  }
  try {
    const coe = await import('@shared/data/crafting/crafting-coe-poe2.json')
    const raw = coe.default as unknown as CraftDataset
    cached = { ...raw, currencies: raw.currencies ?? [] }
    return
  } catch {
    // fallback to RePoE if CoE dataset not built
  }
  const mod = await import('@shared/data/crafting/crafting-poe2.json')
  const raw = mod.default as unknown as CraftDataset
  cached = { ...raw, currencies: raw.currencies ?? [] }
}

export function __setCraftDatasetForTests(data: CraftDataset | null): void {
  cached = data
}

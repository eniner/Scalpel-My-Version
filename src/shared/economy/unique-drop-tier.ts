import uniqueDropTiers from '../data/economy/unique-drop-tiers.json'

/** Wiki / Prohibited Library drop-weight tier (not economy price). */
export type UniqueDropTier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'TF'

const dropTierMap = uniqueDropTiers as Record<string, UniqueDropTier>

export const UNIQUE_DROP_TIER_ORDER: UniqueDropTier[] = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'TF']

export const UNIQUE_DROP_TIER_COLORS: Record<UniqueDropTier, string> = {
  T0: '#ffd24a',
  T1: '#e8b86d',
  T2: '#c8a96e',
  T3: '#7dd3fc',
  T4: '#94a3b8',
  T5: '#6b7280',
  TF: '#f472b6',
}

export function uniqueDropTierFor(name: string): UniqueDropTier | null {
  return dropTierMap[name] ?? null
}

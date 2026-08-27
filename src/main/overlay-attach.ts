import { GAME_TITLES, type GameVariant } from '@shared/contracts/game-variant'

export const BOTH_GAME_TITLES: [string, string] = [GAME_TITLES[1], GAME_TITLES[2]]

/** Native multi-title attach emits titleIndex 0 = PoE1, 1 = PoE2. */
export function variantFromTitleIndex(titleIndex: unknown): GameVariant | null {
  if (titleIndex === 0) return 1
  if (titleIndex === 1) return 2
  return null
}

export function resolveInitialGameVersion(stored: GameVariant, running: GameVariant | null): GameVariant {
  return running ?? stored
}

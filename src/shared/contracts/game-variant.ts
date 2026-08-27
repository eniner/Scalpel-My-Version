export type GameVariant = 1 | 2

export const GAME_TITLES: Record<GameVariant, string> = {
  1: 'Path of Exile',
  2: 'Path of Exile 2',
}

export const TITLE_TO_VARIANT: Record<string, GameVariant> = {
  'Path of Exile': 1,
  'Path of Exile 2': 2,
}

export function gameDisplayName(variant: GameVariant): string {
  return variant === 2 ? 'Path of Exile 2' : 'Path of Exile'
}

export function gameShortName(variant: GameVariant): string {
  return `PoE${variant}`
}

/** True when `name` is that game's window title, allowing trailing whitespace
 *  only. PoE1's "Path of Exile" never matches PoE2's "Path of Exile 2". */
export function windowTitleMatches(name: string, title: string): boolean {
  if (name === title) return true
  if (!name.startsWith(title)) return false
  return name.slice(title.length).trim() === ''
}

/** Which PoE a window title belongs to. Checks PoE2 first so the PoE1 title
 *  cannot steal PoE2. Returns null for Discord/browser titles that merely
 *  mention the game. */
export function matchGameWindowTitle(name: string | null | undefined): GameVariant | null {
  if (name == null) return null
  const trimmed = name.trim()
  if (!trimmed) return null
  if (windowTitleMatches(trimmed, GAME_TITLES[2])) return 2
  if (windowTitleMatches(trimmed, GAME_TITLES[1])) return 1
  return null
}

/** Foreground title wins. If Scalpel stole focus, a single visible PoE window
 *  still counts. Two PoE windows with neither focused → null (wait for focus). */
export function pickRunningGame(foregroundTitle: string | null, visibleTitles: string[]): GameVariant | null {
  const focused = matchGameWindowTitle(foregroundTitle)
  if (focused) return focused
  const found = new Set<GameVariant>()
  for (const title of visibleTitles) {
    const variant = matchGameWindowTitle(title)
    if (variant) found.add(variant)
  }
  if (found.size === 1) return [...found][0]!
  return null
}

import { describe, expect, it } from 'vitest'
import { matchGameWindowTitle, pickRunningGame, windowTitleMatches } from './game-variant'

describe('windowTitleMatches', () => {
  it('matches exact titles', () => {
    expect(windowTitleMatches('Path of Exile', 'Path of Exile')).toBe(true)
    expect(windowTitleMatches('Path of Exile 2', 'Path of Exile 2')).toBe(true)
  })

  it('allows trailing whitespace only', () => {
    expect(windowTitleMatches('Path of Exile 2  ', 'Path of Exile 2')).toBe(true)
    expect(windowTitleMatches('Path of Exile 2 - Discord', 'Path of Exile 2')).toBe(false)
  })

  it('does not let PoE1 match PoE2', () => {
    expect(windowTitleMatches('Path of Exile 2', 'Path of Exile')).toBe(false)
  })
})

describe('matchGameWindowTitle', () => {
  it('detects PoE2 before PoE1', () => {
    expect(matchGameWindowTitle('Path of Exile 2')).toBe(2)
    expect(matchGameWindowTitle('Path of Exile')).toBe(1)
  })

  it('ignores chat/browser titles', () => {
    expect(matchGameWindowTitle('#path-of-exile-2 | Sea World - Discord')).toBeNull()
    expect(matchGameWindowTitle('Path of Exile 2 trade - Google Chrome')).toBeNull()
  })

  it('trims and rejects empty', () => {
    expect(matchGameWindowTitle('  Path of Exile 2  ')).toBe(2)
    expect(matchGameWindowTitle('')).toBeNull()
    expect(matchGameWindowTitle(null)).toBeNull()
  })
})

describe('pickRunningGame', () => {
  it('prefers the focused game', () => {
    expect(pickRunningGame('Path of Exile 2', ['Path of Exile'])).toBe(2)
    expect(pickRunningGame('Path of Exile', ['Path of Exile 2'])).toBe(1)
  })

  it('falls back to the only visible PoE window when Scalpel stole focus', () => {
    expect(pickRunningGame('Scalpel', ['Path of Exile 2', 'Discord'])).toBe(2)
    expect(pickRunningGame('Scalpel', ['Path of Exile'])).toBe(1)
  })

  it('waits for focus when both games are visible', () => {
    expect(pickRunningGame('Chrome', ['Path of Exile', 'Path of Exile 2'])).toBeNull()
  })
})

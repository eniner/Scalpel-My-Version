import { describe, it, expect } from 'vitest'
import { resolveActivePalette } from './active'
import { DEFAULT_PALETTE, PRESETS } from './presets'

const NON_DEFAULT = PRESETS.filter((p) => p.id !== 'default')
const SAMPLE_A = NON_DEFAULT[0]
if (!SAMPLE_A) throw new Error('test requires >=1 non-default preset')

describe('resolveActivePalette', () => {
  it('returns the preset palette for a known id', () => {
    expect(resolveActivePalette(SAMPLE_A.id, null)).toEqual(SAMPLE_A.palette)
  })

  it('returns the custom palette when themeId is custom and one is saved', () => {
    const custom = { ...DEFAULT_PALETTE, accent: '#ff0000' }
    expect(resolveActivePalette('custom', custom)).toEqual(custom)
  })

  it('falls back to default when themeId is custom but no custom saved', () => {
    expect(resolveActivePalette('custom', null)).toEqual(DEFAULT_PALETTE)
  })

  it('falls back to default for an unknown id', () => {
    expect(resolveActivePalette('does-not-exist', null)).toEqual(DEFAULT_PALETTE)
  })
})

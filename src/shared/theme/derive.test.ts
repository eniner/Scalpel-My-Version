import { describe, it, expect } from 'vitest'
import { hexToRgba, lighten, resolveCssVars } from './derive'
import { DEFAULT_PALETTE, PRESETS } from './presets'

describe('hexToRgba', () => {
  it('parses #rrggbb and formats with spaces', () => {
    expect(hexToRgba('#171821', 0.99)).toBe('rgba(23, 24, 33, 0.99)')
    expect(hexToRgba('#50506e', 0.5)).toBe('rgba(80, 80, 110, 0.5)')
  })
})

describe('lighten', () => {
  it('multiplies channels, rounds, returns lowercase hex', () => {
    expect(lighten('#23232e', 1.26)).toBe('#2c2c3a')
  })
  it('clamps to ff', () => {
    expect(lighten('#f0f0f0', 1.26)).toBe('#ffffff')
  })
})

describe('resolveCssVars - default palette anchor', () => {
  it('encodes the intended derived values for the default palette (--border is deliberately darkened via BORDER_DARKEN=0.7, diverging from the original styles.css literal)', () => {
    expect(resolveCssVars(DEFAULT_PALETTE)).toEqual({
      '--bg': 'rgba(23, 24, 33, 0.99)',
      '--bg-solid': '#171821',
      '--bg-card': '#23232e',
      '--bg-hover': '#2c2c3a',
      '--bg-solid-translucent': 'rgba(23, 24, 33, 0.95)',
      '--bg-card-translucent': 'rgba(35, 35, 46, 0.95)',
      '--border': 'rgba(56, 56, 77, 0.5)',
      '--accent': '#c8a96e',
      '--accent-dim': 'rgba(200, 169, 110, 0.3)',
      '--accent-hover': '#e0bd7b',
      '--match': '#4caf50',
      '--match-dim': 'rgba(76, 175, 80, 0.2)',
      '--match-hover': '#55c45a',
      '--secondary-match': '#7e57c2',
      '--secondary-match-dim': 'rgba(126, 87, 194, 0.2)',
      '--text': '#e0d8cc',
      '--text-dim': '#9e9480',
      '--danger': '#ef5350',
      '--warn': '#e67e22',
      '--danger-bg': '#b71c1c',
      '--hide-color': '#ef5350',
      '--show-color': '#4caf50',
      '--minimal-color': '#7e57c2',
    })
  })
})

describe('resolveCssVars - all presets', () => {
  it('produces 23 non-empty string vars for every preset', () => {
    for (const p of PRESETS) {
      const vars = resolveCssVars(p.palette)
      expect(Object.keys(vars)).toHaveLength(23)
      for (const v of Object.values(vars)) {
        expect(typeof v).toBe('string')
        expect(v.length).toBeGreaterThan(0)
      }
    }
  })
})

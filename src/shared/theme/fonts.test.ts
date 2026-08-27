import { describe, it, expect } from 'vitest'
import { FONT_PACKAGES, FONT_PACKAGES_BY_ID, resolveFontPackage, fontPackageCssVars } from './fonts'

describe('font packages', () => {
  it('ids are unique and resolveFontPackage falls back to fontin', () => {
    const ids = FONT_PACKAGES.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(resolveFontPackage(undefined).id).toBe('fontin')
    expect(resolveFontPackage('nope').id).toBe('fontin')
    for (const p of FONT_PACKAGES) expect(FONT_PACKAGES_BY_ID[p.id]).toBe(p)
  })

  it('emits ui, display, and mono CSS vars', () => {
    const vars = fontPackageCssVars(resolveFontPackage('windows'))
    expect(vars['--font-ui']).toContain('Segoe UI')
    expect(vars['--font-poe']).toContain('Segoe UI')
    expect(vars['--font-mono']).toContain('Cascadia')
  })
})

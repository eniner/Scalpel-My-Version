import { describe, expect, it } from 'vitest'
import { parseFilterFile } from './parser'
import {
  CUSTOM_TIER_MARK,
  injectCustomTiers,
  stripCustomTiers,
  emittedTierName,
  sanitizeTierId,
} from './custom-tier-inject'

const NEVER_SINK = `#name: NeverSink
Show # $type->currency $tier->t1
	BaseType == "Mirror of Kalandra" "Divine Orb"
	SetFontSize 45

Show # $type->currency $tier->t4
	BaseType == "Chaos Orb" "Jeweller's Orb"
	SetFontSize 28

Hide # $type->endgame $tier->hide
	AreaLevel >= 68
`

describe('custom tier inject', () => {
  it('sanitizes ids and prefixes the emitted $tier', () => {
    expect(sanitizeTierId('Keep List!')).toBe('keep-list')
    expect(emittedTierName('keep')).toBe('scalpel-keep')
  })

  it('inserts custom blocks before the first Show without editing NeverSink lists or Currency tags', () => {
    const next = injectCustomTiers(NEVER_SINK, [
      { id: 'keep', typePath: 'currency', visibility: 'Show', baseTypes: ['Chaos Orb'] },
    ])
    const file = parseFilterFile('NeverSink-local.filter', next)
    const custom = file.blocks.find((b) => b.inlineComment?.includes(CUSTOM_TIER_MARK))
    expect(custom?.tierTag).toEqual({ typePath: 'scalpel-custom', tier: 'scalpel-keep' })
    expect(custom?.conditions.find((c) => c.type === 'BaseType')?.values).toEqual(['Chaos Orb'])
    expect(file.blocks[0]).toBe(custom)

    const t4 = file.blocks.find((b) => b.tierTag?.typePath === 'currency' && b.tierTag.tier === 't4')
    expect(t4?.conditions.find((c) => c.type === 'BaseType')?.values).toEqual(['Chaos Orb', "Jeweller's Orb"])
    expect(next).not.toMatch(/\$type->currency \$tier->scalpel-/)
  })

  it('strip restores the upstream file and is idempotent with re-inject', () => {
    const injected = injectCustomTiers(NEVER_SINK, [
      { id: 'keep', typePath: 'currency', visibility: 'Show', baseTypes: ['Chaos Orb'] },
    ])
    const stripped = stripCustomTiers(injected)
    const orig = parseFilterFile('a.filter', NEVER_SINK)
    const back = parseFilterFile('b.filter', stripped)
    expect(back.blocks.map((b) => b.tierTag)).toEqual(orig.blocks.map((b) => b.tierTag))
    expect(
      injectCustomTiers(injected, [{ id: 'keep', typePath: 'currency', visibility: 'Show', baseTypes: ['Chaos Orb'] }]),
    ).toBe(
      injectCustomTiers(NEVER_SINK, [
        { id: 'keep', typePath: 'currency', visibility: 'Show', baseTypes: ['Chaos Orb'] },
      ]),
    )
  })

  it('empty sidecar strips leftover custom blocks and does not emit a catch-all', () => {
    const injected = injectCustomTiers(NEVER_SINK, [
      { id: 'keep', typePath: 'currency', visibility: 'Show', baseTypes: ['Chaos Orb'] },
    ])
    const cleared = injectCustomTiers(injected, [
      { id: 'keep', typePath: 'currency', visibility: 'Show', baseTypes: [] },
    ])
    expect(cleared).not.toContain(CUSTOM_TIER_MARK)
    expect(
      parseFilterFile('c.filter', cleared).blocks.every(
        (b) => b.conditions.length > 0 || b.tierTag?.typePath === 'endgame',
      ),
    ).toBe(true)
  })
})

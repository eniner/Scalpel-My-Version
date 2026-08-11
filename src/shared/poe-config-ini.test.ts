import { describe, expect, it } from 'vitest'
import { getApplyItemFilterToRitual, setApplyItemFilterToRitual } from './poe-config-ini'

describe('getApplyItemFilterToRitual', () => {
  it('reads true/false', () => {
    expect(getApplyItemFilterToRitual('apply_item_filter_to_ritual=true\n')).toBe(true)
    expect(getApplyItemFilterToRitual('apply_item_filter_to_ritual=false\r\n')).toBe(false)
  })

  it('defaults to false when missing', () => {
    expect(getApplyItemFilterToRitual('item_filter=foo\n')).toBe(false)
  })
})

describe('setApplyItemFilterToRitual', () => {
  it('updates an existing key and preserves CRLF', () => {
    const ini = ['[UI]', 'apply_item_filter_to_ritual=false', 'item_filter=x', ''].join('\r\n')
    expect(setApplyItemFilterToRitual(ini, true)).toBe(
      ['[UI]', 'apply_item_filter_to_ritual=true', 'item_filter=x', ''].join('\r\n'),
    )
  })

  it('appends when missing', () => {
    const ini = 'item_filter=x\n'
    expect(setApplyItemFilterToRitual(ini, true)).toBe('item_filter=x\napply_item_filter_to_ritual=true\n')
  })
})

import { expect, test } from 'vitest'
import { decodeRowText, pickBestRowDecode } from './decode-row'

test('decodeRowText maps noisy OCR to catalog names', () => {
  const d = decodeRowText('1x Greater Rebirth Rune')
  expect(d?.name).toBe('Greater Rebirth Rune')
  expect(d?.qty).toBe(1)
})

test('decodeRowText maps truncated jeweller orb OCR', () => {
  expect(decodeRowText('1x Greater Orb')?.name).toBe("Greater Jeweller's Orb")
  expect(decodeRowText('3x prism')?.name).toBe("Gemcutter's Prism")
  expect(decodeRowText('3x Prism 158')?.name).toBe("Gemcutter's Prism")
})

test('pickBestRowDecode prefers catalog hit over garbage', () => {
  const d = pickBestRowDecode([
    '2x hg rors i : ie ti. FEL',
    "3x Glassblower's Bauble",
    '3x Bauble',
  ])
  expect(d?.name).toBe("Glassblower's Bauble")
})

test('pickBestRowDecode prefers warding over noise prefix', () => {
  const d = pickBestRowDecode(['NG 1x Warding Rune of Protection', 'Warding Rune'])
  expect(d?.name).toBe('Warding Rune of Protection')
})

test('decodeRowText parses Skill entries', () => {
  expect(decodeRowText('Skill: refutation')?.name).toBe('Skill: Refutation')
  expect(decodeRowText('Skill: Runic Reprieve')?.name).toBe('Skill: Runic Reprieve')
  expect(decodeRowText('Support: Healing Runes')?.name).toBe('Support: Healing Runes')
})

test('pickBestRowDecode prefers skill column over rune icon garbage', () => {
  const d = pickBestRowDecode([
    'CEC CVS ay JE',
    '15 i SHRILL ARyldil',
    'Skill: Skyfall',
    'Skill: Triskelion Cascade',
  ])
  expect(d?.name).toMatch(/^Skill: /)
})

test('parseRunicEntry rejects bare Skill prefix', () => {
  expect(decodeRowText('Skill:') ?? null).toBeNull()
  expect(decodeRowText('Skill:  ') ?? null).toBeNull()
})

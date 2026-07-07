import { expect, test } from 'vitest'
import { decodeRowText, pickBestRowDecode } from './decode-row'

test('decodeRowText maps truncated jeweller orb OCR', () => {
  expect(decodeRowText('1x Greater Orb')?.name).toBe("Greater Jeweller's Orb")
  expect(decodeRowText('3x Prism 158')?.name).toBe("Gemcutter's Prism")
})

test('decodeRowText parses Skill entries', () => {
  expect(decodeRowText('Skill: refutation')?.name).toBe('Skill: Refutation')
  expect(decodeRowText('Support: Healing Runes')?.name).toBe('Support: Healing Runes')
})

test('pickBestRowDecode prefers skill over rune icon garbage', () => {
  const d = pickBestRowDecode(['CEC CVS ay JE', 'Skill: Leylines'])
  expect(d?.name).toBe('Skill: Leylines')
})

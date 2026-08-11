import { expect, test } from 'vitest'
import { categoriesWithData, economyCategoriesFor } from './economy-categories'
import { entryMatchesQuery, groupEntriesByCategory, normSearch, priceBadge } from './economy-prices'

test('priceBadge prefers divine for high values', () => {
  expect(priceBadge({ chaosValue: 40, divineValue: 2.5 }, 2)).toBe('2.5 div')
  expect(priceBadge({ chaosValue: 3.2, divineValue: 0.4 }, 2)).toBe('3.2 ex')
  expect(priceBadge({ chaosValue: 3.2, divineValue: 0.4 }, 1)).toBe('3.2 c')
})

test('normSearch strips punctuation', () => {
  expect(normSearch('Divine Orb')).toBe('divine orb')
})

test('entryMatchesQuery is case-insensitive substring', () => {
  expect(entryMatchesQuery({ name: 'Chaos Orb', category: 'currency', chaosValue: 1 }, 'chaos')).toBe(true)
  expect(entryMatchesQuery({ name: 'Chaos Orb', category: 'currency', chaosValue: 1 }, 'divine')).toBe(false)
})

test('groupEntriesByCategory sorts by value', () => {
  const map = groupEntriesByCategory([
    { name: 'Low', category: 'runes', chaosValue: 1, divineValue: 0.1 },
    { name: 'High', category: 'runes', chaosValue: 50, divineValue: 5 },
  ])
  expect(map.get('runes')?.[0]?.name).toBe('High')
})

test('PoE1 categories include scarabs and div cards', () => {
  const slugs = economyCategoriesFor(1).map((c) => c.slug)
  expect(slugs).toContain('scarabs')
  expect(slugs).toContain('divination-cards')
  expect(slugs).not.toContain('abyssal-bones')
})

test('categoriesWithData appends unknown live slugs', () => {
  const cats = categoriesWithData(1, ['currency', 'weird-new-type'])
  expect(cats.some((c) => c.slug === 'weird-new-type')).toBe(true)
  expect(cats[0]?.slug).toBe('currency')
})

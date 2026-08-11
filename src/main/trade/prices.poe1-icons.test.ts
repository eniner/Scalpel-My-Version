import { expect, test } from 'vitest'
import { applyIconMapToEntries, fetchPoe1IconMap } from './prices.poe1-icons'
import type { PriceEntry } from '@shared/types'

test('applyIconMapToEntries fills missing icons only', () => {
  const entries: PriceEntry[] = [
    { name: 'A', category: 'currency', chaosValue: 1, icon: 'keep-me' },
    { name: 'B', category: 'currency', chaosValue: 2 },
  ]
  applyIconMapToEntries(entries, new Map([['A', 'new-a'], ['B', 'new-b']]))
  expect(entries[0]?.icon).toBe('keep-me')
  expect(entries[1]?.icon).toBe('new-b')
})

test('fetchPoe1IconMap reads currencyDetails and item lines', async () => {
  const fetchJson = async (url: string) => {
    if (url.includes('/currency/overview') && url.includes('type=Currency')) {
      return { currencyDetails: [{ name: 'Chaos Orb', icon: 'https://cdn/chaos.png' }] }
    }
    if (url.includes('/item/overview') && url.includes('type=UniqueWeapon')) {
      return { lines: [{ name: 'Headhunter', icon: 'https://cdn/hh.png' }] }
    }
    throw new Error(`unexpected url ${url}`)
  }
  const map = await fetchPoe1IconMap('Standard', ['Currency', 'UniqueWeapon', 'Oil'], fetchJson)
  expect(map.get('Chaos Orb')).toBe('https://cdn/chaos.png')
  expect(map.get('Headhunter')).toBe('https://cdn/hh.png')
  expect(map.size).toBe(2)
})

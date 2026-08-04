import { describe, it, expect } from 'vitest'
import { filterOwnListings } from './exclude-own-listings'

describe('filterOwnListings', () => {
  const listings = [
    { id: '1', account: 'SellerA' },
    { id: '2', account: 'MyAccount' },
    { id: '3', account: 'myaccount' },
  ]

  it('returns all listings when exclude is off', () => {
    expect(filterOwnListings(listings, 'MyAccount', false)).toEqual(listings)
  })

  it('returns all listings when account name is missing', () => {
    expect(filterOwnListings(listings, undefined, true)).toEqual(listings)
  })

  it('drops the logged-in account case-insensitively', () => {
    expect(filterOwnListings(listings, 'MyAccount', true)).toEqual([{ id: '1', account: 'SellerA' }])
  })
})

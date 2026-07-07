/** CoE Greater/Perfect orb tier floors (min ilvl for tiers in pool). */
export function tierFloorForCurrency(name: string): number {
  const n = name.toLowerCase()
  if (n.includes('perfect')) {
    if (n.includes('transmutation') || n.includes('augmentation')) return 70
    return 50
  }
  if (n.includes('greater')) {
    if (n.includes('transmutation') || n.includes('augmentation')) return 44
    return 35
  }
  return 0
}

export function simKeyForCurrencyName(name: string, cat?: string): string | null {
  const n = name.toLowerCase()
  if (n === 'chaos orb' || n.startsWith('greater chaos') || n.startsWith('perfect chaos')) return 'chaos'
  if (n === 'exalted orb' || n.startsWith('greater exalted') || n.startsWith('perfect exalted')) return 'exalt'
  if (n === 'orb of annulment') return 'annul'
  if (n === 'orb of alteration') return 'alteration'
  if (n === 'orb of transmutation' || n.startsWith('greater orb of transmutation') || n.startsWith('perfect orb of transmutation')) {
    return 'transmutation'
  }
  if (n === 'orb of augmentation' || n.startsWith('greater orb of augmentation') || n.startsWith('perfect orb of augmentation')) {
    return 'augmentation'
  }
  if (n === 'regal orb' || n.startsWith('greater regal') || n.startsWith('perfect regal')) return 'regal'
  if (n === 'orb of alchemy') return 'alchemy'
  if (n === 'orb of scouring') return 'scouring'
  if (n === 'divine orb') return 'divine'
  if (n === 'fracturing orb') return 'fracture'
  if (n === 'vaal orb') return 'vaal'
  if (n.includes('essence') || cat === 'essence') return `essence:${name}`
  return null
}

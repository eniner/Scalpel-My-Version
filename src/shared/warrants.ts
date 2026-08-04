/** Mercenary Warrant trade scanner — live listings + skill-link fingerprints. */

export type WarrantSupport = {
  hash: number
  name: string
  tier?: number
}

export type WarrantSkill = {
  hash: number
  name: string
  icon?: string
  supports: WarrantSupport[]
}

export type WarrantListing = {
  id: string
  queryId: string
  mercenaryName: string
  build: string
  level: number | null
  skills: WarrantSkill[]
  /** Exact skill+support link order fingerprint (order preserved). */
  fingerprint: string
  /** Skill names only, sorted — for coarse filtering. */
  skillKey: string
  priceAmount: number | null
  priceCurrency: string | null
  chaosValue: number | null
  account: string | null
  online: boolean
  indexed: string | null
  icon: string | null
}

export type WarrantSkillGroup = {
  fingerprint: string
  skillKey: string
  build: string
  count: number
  medianChaos: number | null
  minChaos: number | null
  maxChaos: number | null
  sample: WarrantListing
  listings: WarrantListing[]
}

export type WarrantScanResult = {
  total: number
  fetched: number
  queryId: string
  league: string
  scannedAt: number
  groups: WarrantSkillGroup[]
  listings: WarrantListing[]
  webSearchUrl: string
}

/** Preserve skill order and support link order — that is the marketable package. */
export function fingerprintSkills(skills: WarrantSkill[]): string {
  return skills
    .map((s) => {
      const links = s.supports.map((sup) => (sup.tier != null ? `${sup.name}:t${sup.tier}` : sup.name)).join('+')
      return links ? `${s.name}[${links}]` : s.name
    })
    .join(' | ')
}

export function skillKey(skills: WarrantSkill[]): string {
  return [...skills.map((s) => s.name)].sort((a, b) => a.localeCompare(b)).join(', ')
}

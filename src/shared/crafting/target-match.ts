/** Expand user search terms to mod text / CoE group names. */
const TARGET_ALIASES: Array<{ terms: string[]; needles: string[] }> = [
  {
    terms: ['projectile level', 'projectile levels', 'project levels', 'proj level', 'proj levels'],
    needles: ['level of all projectile', 'increasesocketedgemlevel', 'projectile skill'],
  },
  {
    terms: ['melee level', 'melee levels'],
    needles: ['level of all melee', 'increasesocketedgemlevel'],
  },
  {
    terms: ['mark skill', 'mark skills'],
    needles: ['mark skill', 'effect of your mark'],
  },
]

export function normalizeTargetQuery(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function modMatchesTargetQuery(
  mod: { text: string; group: string; name?: string; kind: 'p' | 's' },
  query: string,
  kind: 'all' | 'p' | 's',
): boolean {
  if (kind !== 'all' && mod.kind !== kind) return false
  const q = normalizeTargetQuery(query)
  if (!q) return false
  const hay = normalizeTargetQuery([mod.text, mod.group, mod.name ?? '', humanGroup(mod.group)].join(' '))
  if (hay.includes(q)) return true
  for (const { terms, needles } of TARGET_ALIASES) {
    if (!terms.some((t) => q.includes(t))) continue
    if (needles.some((n) => hay.includes(n))) return true
  }
  return false
}

function humanGroup(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase()
}

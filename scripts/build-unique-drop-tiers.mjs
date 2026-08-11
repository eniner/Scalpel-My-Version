/**
 * Build name → drop-weight tier map from the PoE wiki unique-tier guide.
 * Prefer the dust-derived column (e.g. `0d`); fall back to last numeric cell.
 * Fill gaps via dust-value formula when the match is unambiguous.
 *
 * Usage:
 *   node scripts/build-unique-drop-tiers.mjs [path-to-wiki-export.txt]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import dust from '../src/shared/data/economy/dust-values.json' with { type: 'json' }

const wikiPath =
  process.argv[2] ||
  join(
    process.env.USERPROFILE || '',
    '.cursor/projects/c-Users-E9ine-Downloads-scalpel-main-scalpel-main/agent-tools/a85865be-c062-4849-a346-4b7f75fa6d04.txt',
  )

const text = readFileSync(wikiPath, 'utf8')
const names = Object.keys(dust).sort((a, b) => b.length - a.length)

/** @type {Record<string, string>} */
const tiers = {}

function parseTierLabel(raw) {
  if (!raw || raw === '—' || raw === '-') return null
  // Fishing TF marker: 0-Fd / Fd
  if (/^0?-?Fd$/i.test(raw) || /^Fd$/i.test(raw)) return 'TF'
  const dust = raw.match(/^(\d+)d$/i)
  if (dust) return `T${dust[1]}`
  const range = raw.match(/^(\d+)-\d+$/)
  if (range) return `T${range[1]}`
  if (/^\d+$/.test(raw)) return `T${raw}`
  return null
}

for (const line of text.split(/\r?\n/)) {
  if (!line.startsWith('| ')) continue
  if (/Unique\s*\|/.test(line) || line.startsWith('| ---') || line.startsWith('| Unique')) continue
  const body = line.slice(2)
  let name = null
  for (const n of names) {
    if (body.startsWith(n + ' ' + n) || body.startsWith(n + n)) {
      name = n
      break
    }
  }
  if (!name) continue

  const cells = line
    .split('|')
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(1)

  let dustTier = null
  let lastNumeric = null
  for (const c of cells) {
    const label = parseTierLabel(c)
    if (!label) continue
    if (/^\d+d$/i.test(c) || /^0?-?Fd$/i.test(c)) dustTier = label
    else lastNumeric = label
  }
  const label = dustTier ?? lastNumeric
  if (!label) continue
  // Dust column wins when present
  if (!tiers[name] || dustTier) tiers[name] = label
}

const coeffs = [
  ['TF', 200],
  ['T0', 100],
  ['T1', 25],
  ['T2', 6],
  ['T3', 2],
  ['T4', 1.25],
  ['T5', 1],
]

function inferFromDust(dv) {
  /** @type {Array<{ tier: string; err: number }>} */
  const hits = []
  for (const [tier, c] of coeffs) {
    for (const mult of [1, 2]) {
      const coef = c * mult
      const ratio = dv / coef
      if (ratio <= 0) continue
      const dl = 1 + Math.log(ratio) / Math.log(1.03)
      const nearest = Math.round(dl)
      const err = Math.abs(dl - nearest)
      if (nearest >= 20 && nearest <= 100 && err < 0.02) hits.push({ tier, err })
    }
  }
  hits.sort((a, b) => a.err - b.err)
  if (hits.length === 0) return null
  // Reject if another tier is nearly as good
  const rivals = hits.filter((h) => h.tier !== hits[0].tier && h.err < 0.02)
  if (rivals.length) return null
  return hits[0].tier
}

let filled = 0
for (const [name, dv] of Object.entries(dust)) {
  if (tiers[name]) continue
  const inferred = inferFromDust(dv)
  if (inferred) {
    tiers[name] = inferred
    filled++
  }
}

const outPath = join('src/shared/data/economy/unique-drop-tiers.json')
const sorted = Object.fromEntries(Object.entries(tiers).sort(([a], [b]) => a.localeCompare(b)))
writeFileSync(outPath, JSON.stringify(sorted, null, 2) + '\n')

const counts = {}
for (const t of Object.values(sorted)) counts[t] = (counts[t] ?? 0) + 1
console.log({
  wikiNames: Object.keys(tiers).length - filled,
  inferredFill: filled,
  total: Object.keys(sorted).length,
  counts,
  outPath,
})
console.log('T0:', Object.entries(sorted).filter(([, v]) => v === 'T0').map(([k]) => k).join(', '))

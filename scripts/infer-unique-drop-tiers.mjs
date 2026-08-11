import dust from '../src/shared/data/economy/dust-values.json' with { type: 'json' }

const coeffs = { TF: 200, T0: 100, T1: 25, T2: 6, T3: 2, T4: 1.25, T5: 1 }
const samples = [
  'Mageblood',
  'Headhunter',
  'Soul Taker',
  'Marohi Erqi',
  'Original Sin',
  "Wurm's Molt",
  'Goldrim',
  'Tabula Rasa',
  'The Golden Charlatan',
  'Omeyocan',
  'Replica Forbidden Shako',
  'Demigod\'s Beacon',
]

function infer(name) {
  const dv = dust[name]
  if (dv == null) return { name, err: 'no dust' }
  const hits = []
  for (const [tier, c] of Object.entries(coeffs)) {
    for (const mult of [1, 2]) {
      const coef = c * mult
      const ratio = dv / coef
      if (ratio <= 0) continue
      const dl = 1 + Math.log(ratio) / Math.log(1.03)
      const nearest = Math.round(dl)
      const err = Math.abs(dl - nearest)
      if (nearest >= 1 && nearest <= 100 && err < 0.08) hits.push({ tier, mult, dl: nearest, err, coef })
    }
  }
  hits.sort((a, b) => a.err - b.err || b.coef - a.coef)
  return { name, dv, best: hits[0], alt: hits.slice(1, 3) }
}

for (const s of samples) console.log(JSON.stringify(infer(s)))

// Ambiguity stats across all dust entries
let ok = 0
let ambig = 0
let none = 0
const byTier = {}
for (const name of Object.keys(dust)) {
  const r = infer(name)
  if (!r.best) {
    none++
    continue
  }
  const close = (r.alt ?? []).filter((h) => h.err < 0.08 && h.tier !== r.best.tier)
  if (close.length) ambig++
  else ok++
  byTier[r.best.tier] = (byTier[r.best.tier] ?? 0) + 1
}
console.log({ ok, ambig, none, byTier, total: Object.keys(dust).length })

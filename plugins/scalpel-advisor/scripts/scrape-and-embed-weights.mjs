/**
 * Scrape drop-weight tables from Perandus Ledger CDN and embed into *-ref.json.
 *
 * Source: https://xddbsns.com/data/{league}/…
 * League defaults to root /data/config.json (currently Keepers).
 *
 * Usage: node scripts/scrape-and-embed-weights.mjs [league]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', 'src', 'data')
const liveDir = path.join(dataDir, 'live')

const LEDGER_ORIGIN = 'https://xddbsns.com'
const HEADERS = {
  'User-Agent': 'ScalpelAdvisorWeightScrape/0.1 (+local embed; not redistributed as CDN proxy)',
  Accept: 'application/json',
  Referer: `${LEDGER_ORIGIN}/`,
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.json()
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
}

function embedScarabs(raw) {
  return {
    source: 'perandus-ledger',
    league: raw.meta?.league ?? undefined,
    scrapedAt: new Date().toISOString(),
    meta: {
      totalScarabs: raw.meta?.totalScarabs,
      totalWeight: raw.meta?.totalWeight,
      unknownScarabs: raw.meta?.unknownScarabs ?? [],
    },
    categories: (raw.categories ?? []).map((cat) => ({
      id: cat.id,
      name: cat.name,
      atlasModifier: cat.atlasModifier,
      investmentBoost: Boolean(cat.investmentBoost),
      scarabs: (cat.scarabs ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        weight: Number(s.weight) || 0,
        signature: s.signature ?? s.name,
        untradeable: Boolean(s.untradeable),
      })),
    })),
  }
}

function embedBeasts(raw) {
  const beasts = (raw.beasts ?? []).map((b) => ({
    name: b.name,
    classification: b.classification,
    count: Number(b.count) || 0,
    priceId: b.priceId ?? null,
  }))
  const weights =
    raw.weights && typeof raw.weights === 'object'
      ? Object.fromEntries(Object.entries(raw.weights).map(([k, v]) => [k, Number(v) || 0]))
      : Object.fromEntries(beasts.map((b) => [b.name, b.count]))

  return {
    source: 'perandus-ledger',
    scrapedAt: new Date().toISOString(),
    classifications: raw.classifications ?? ['The Deep', 'The Wilds', 'The Caverns', 'The Sands'],
    beasts,
    weights,
  }
}

function embedEssences(raw) {
  return {
    source: 'perandus-ledger',
    scrapedAt: new Date().toISOString(),
    // Prices come from poe.ninja at runtime — keep empty placeholders for type shape.
    prices: {},
    weights: Object.fromEntries(
      Object.entries(raw.weights ?? {}).map(([k, v]) => [k, Number(v) || 0]),
    ),
    totalWeight: Number(raw.totalWeight) || 0,
    groups: (raw.groups ?? []).map((g) => ({
      id: g.id,
      essences: g.essences,
      maxTier: Number(g.maxTier ?? g.maxTier ?? 0),
      corrupt: Boolean(g.corrupt),
    })),
    tiers: raw.tiers ?? [],
    scarabPrices: {},
  }
}

async function resolveLeague(cliLeague) {
  if (cliLeague) return cliLeague.toLowerCase().replace(/\s+/g, '-')
  const root = await fetchJson(`${LEDGER_ORIGIN}/data/config.json`)
  const league = String(root.league || 'keepers')
  return league.toLowerCase().replace(/\s+/g, '-')
}

async function main() {
  const league = await resolveLeague(process.argv[2])
  fs.mkdirSync(liveDir, { recursive: true })

  const files = {
    scarab: 'scarab-calculator.json',
    beast: 'beast-calculator-prices.json',
    essence: 'essence-calculator-prices.json',
  }

  const report = { league, fetched: {}, embedded: {}, warnings: [] }

  for (const [key, name] of Object.entries(files)) {
    const url = `${LEDGER_ORIGIN}/data/${league}/${name}`
    const raw = await fetchJson(url)
    writeJson(path.join(liveDir, name), raw)
    report.fetched[key] = { url, bytes: JSON.stringify(raw).length }
  }

  const scarabRaw = JSON.parse(fs.readFileSync(path.join(liveDir, files.scarab), 'utf8'))
  const beastRaw = JSON.parse(fs.readFileSync(path.join(liveDir, files.beast), 'utf8'))
  const essenceRaw = JSON.parse(fs.readFileSync(path.join(liveDir, files.essence), 'utf8'))

  const scarabsRef = embedScarabs(scarabRaw)
  const beastsRef = embedBeasts(beastRaw)
  const essencesRef = embedEssences(essenceRaw)

  writeJson(path.join(dataDir, 'scarabs-ref.json'), {
    categories: scarabsRef.categories,
  })
  writeJson(path.join(dataDir, 'beasts-ref.json'), {
    classifications: beastsRef.classifications,
    beasts: beastsRef.beasts,
    weights: beastsRef.weights,
  })
  writeJson(path.join(dataDir, 'essences-ref.json'), {
    prices: essencesRef.prices,
    weights: essencesRef.weights,
    totalWeight: essencesRef.totalWeight,
    groups: essencesRef.groups,
    tiers: essencesRef.tiers,
    scarabPrices: essencesRef.scarabPrices,
  })

  // Sidecar provenance (not imported by the plugin bundle).
  writeJson(path.join(liveDir, 'weights-provenance.json'), {
    league,
    scrapedAt: new Date().toISOString(),
    source: LEDGER_ORIGIN,
    files,
    scarabMeta: scarabsRef.meta,
    beastCount: beastsRef.beasts.length,
    essenceWeightKeys: Object.keys(essencesRef.weights).length,
  })

  report.embedded = {
    scarabs: {
      categories: scarabsRef.categories.length,
      scarabs: scarabsRef.categories.reduce((n, c) => n + c.scarabs.length, 0),
      totalWeight: scarabsRef.meta.totalWeight,
    },
    beasts: { count: beastsRef.beasts.length },
    essences: {
      weightKeys: Object.keys(essencesRef.weights).length,
      totalWeight: essencesRef.totalWeight,
      groups: essencesRef.groups.length,
    },
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

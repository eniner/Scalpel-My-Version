#!/usr/bin/env node
/**
 * Build src/shared/data/crafting/crafting-poe2.json from RePoE-fork PoE2 export.
 * Build-time only; bundled into the app for offline crafting simulation.
 *
 * Usage: node scripts/build-crafting-data.js
 */
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const https = require('node:https')

const OUT_DIR = path.join(__dirname, '..', 'src', 'shared', 'data', 'crafting')
const SCHEMA_VERSION = 1
const SOURCE = 'https://repoe-fork.github.io/poe2/'

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'Scalpel-CraftingData' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return httpGet(res.headers.location).then(resolve, reject)
        }
        if (res.statusCode !== 200) {
          res.resume()
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        }
        let data = ''
        res.on('data', (c) => {
          data += c
        })
        res.on('end', () => resolve(JSON.parse(data)))
        res.on('error', reject)
      })
      .on('error', reject)
  })
}

function stripTokens(text) {
  if (!text) return ''
  return text
    .replace(/\[([^|\]]+)\|([^\]]+)\]/g, '$2')
    .replace(/\[([^\]]+)\]/g, '$1')
}

function compactMod(modId, m) {
  if (m.domain !== 'item') return null
  if (m.generation_type !== 'prefix' && m.generation_type !== 'suffix') return null
  const group = m.groups?.[0]
  if (!group) return null
  const spawn = (m.spawn_weights || [])
    .filter((w) => w.weight > 0)
    .map((w) => [w.tag, w.weight])
  if (spawn.length === 0) return null
  const gen = (m.generation_weights || [])
    .filter((w) => w.weight > 0)
    .map((w) => [w.tag, w.weight])
  const adds = (m.adds_tags || []).filter(Boolean)
  return {
    id: modId,
    g: group,
    k: m.generation_type === 'prefix' ? 'p' : 's',
    l: m.required_level || 1,
    n: m.name || '',
    t: stripTokens(m.text || ''),
    w: spawn,
    ...(gen.length ? { gw: gen } : {}),
    ...(adds.length ? { a: adds } : {}),
  }
}

function buildCurrencyCatalog(baseItems) {
  const skip = /\b(map|scarab|fragment|seal|invitation|contract|waystone|dedication|tribute|baptism|rite|tome|tablet|vault key|pinnacle|logbook|\[dnt\]|shard)\b/i
  function cat(name, tags) {
    if (tags.includes('essence')) return 'essence'
    if (name.includes('Fossil')) return 'fossil'
    if (name.includes('Catalyst')) return 'catalyst'
    if (name.includes('Omen')) return 'omen'
    if (name.endsWith(' Orb') || name.startsWith('Orb of ')) return 'orb'
    return 'other'
  }
  const out = []
  for (const bi of Object.values(baseItems)) {
    if (!bi.name || !bi.tags?.includes('currency')) continue
    if (skip.test(bi.name)) continue
    const desc = [bi.properties?.description, bi.properties?.directions].filter(Boolean).join(' ')
    if (!desc.trim()) continue
    out.push({
      name: bi.name,
      desc: stripTokens(desc),
      lvl: bi.drop_level || 1,
      cat: cat(bi.name, bi.tags),
    })
  }
  out.sort((a, b) => a.cat.localeCompare(b.cat) || a.lvl - b.lvl || a.name.localeCompare(b.name))
  return out
}

function buildDataset(mods, baseItems) {
  const outMods = []
  for (const [modId, m] of Object.entries(mods)) {
    const c = compactMod(modId, m)
    if (c) outMods.push(c)
  }
  outMods.sort((a, b) => a.id.localeCompare(b.id))

  const bases = {}
  for (const bi of Object.values(baseItems)) {
    if (!bi.name || !bi.tags?.length) continue
    bases[bi.name] = {
      tags: bi.tags,
      c: bi.item_class || '',
    }
  }

  const currencies = buildCurrencyCatalog(baseItems)

  return {
    schemaVersion: SCHEMA_VERSION,
    mods: outMods,
    bases,
    currencies,
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  console.log('fetching RePoE PoE2 crafting sources…')
  const [mods, baseItems] = await Promise.all([
    httpGet(`${SOURCE}mods.json`),
    httpGet(`${SOURCE}base_items.json`),
  ])
  const dataset = buildDataset(mods, baseItems)
  const json = `${JSON.stringify(dataset)}\n`
  const outPath = path.join(OUT_DIR, 'crafting-poe2.json')
  fs.writeFileSync(outPath, json, 'utf8')
  const hash = crypto.createHash('sha256').update(json).digest('hex')
  fs.writeFileSync(
    path.join(OUT_DIR, 'crafting-manifest.json'),
    `${JSON.stringify({ schemaVersion: SCHEMA_VERSION, hash, generatedAt: new Date().toISOString(), modCount: dataset.mods.length, baseCount: Object.keys(dataset.bases).length }, null, 2)}\n`,
    'utf8',
  )
  console.log(
    `wrote ${(json.length / 1048576).toFixed(2)}MB, ${dataset.mods.length} mods, ${Object.keys(dataset.bases).length} bases, ${dataset.currencies.length} currencies`,
  )
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}

module.exports = { buildDataset, stripTokens, SCHEMA_VERSION, OUT_DIR }

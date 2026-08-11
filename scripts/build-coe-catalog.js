#!/usr/bin/env node
/**
 * Build CoE browse catalog (bgroups → families → bitems) for Scalpel Lab setup wizard.
 * Same source as crafting-coe-poe2.json — Desktop Craftofecile mirror or COE_DATA_DIR.
 */
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, 'src', 'shared', 'data', 'crafting', 'crafting-coe-catalog.json')
const BUNDLED = path.join(ROOT, 'src', 'shared', 'data', 'crafting', 'coe-source')
const DEFAULT_MIRROR = path.join(
  process.env.USERPROFILE || '',
  'Desktop',
  'profusion site',
  'Craftofecile',
  'www.craftofexile.com',
  'json',
  'poe2',
)

function parseCoEFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const i = raw.indexOf('{')
  return JSON.parse(i >= 0 ? raw.slice(i) : raw)
}

function resolveSourceDir() {
  if (process.env.COE_DATA_DIR && fs.existsSync(process.env.COE_DATA_DIR)) return process.env.COE_DATA_DIR
  if (fs.existsSync(path.join(BUNDLED, 'main'))) return BUNDLED
  if (fs.existsSync(path.join(DEFAULT_MIRROR, 'main'))) return DEFAULT_MIRROR
  throw new Error('CoE data not found for catalog build.')
}

function findFile(dir, sub, prefix) {
  const folder = path.join(dir, sub)
  const hit = fs.readdirSync(folder).find((f) => f.startsWith(prefix))
  if (!hit) throw new Error(`Missing ${prefix}* in ${folder}`)
  return path.join(folder, hit)
}

function parseProps(raw) {
  if (!raw) return {}
  try {
    const o = typeof raw === 'string' ? JSON.parse(raw) : raw
    const out = {}
    for (const [k, v] of Object.entries(o || {})) {
      const n = Number(v)
      out[k] = Number.isFinite(n) ? n : v
    }
    return out
  } catch {
    return {}
  }
}

function parseImplicits(raw) {
  if (!raw) return []
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!Array.isArray(arr)) return []
    return arr.map((x) => String(x).replace(/\s+/g, ' ').trim()).filter(Boolean)
  } catch {
    return []
  }
}

function main() {
  const src = resolveSourceDir()
  const coe = parseCoEFile(findFile(src, 'main', 'poec_data'))
  let lang = {}
  try {
    lang = parseCoEFile(findFile(src, 'lang', 'poec_lang'))
  } catch {
    lang = {}
  }

  const groups = (coe.bgroups?.seq || [])
    .map((g) => ({
      id: String(g.id_bgroup),
      name: lang.bgroup?.[g.id_bgroup] || g.name_bgroup || `Group ${g.id_bgroup}`,
      craftable: String(g.is_craftable) === '1',
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const families = (coe.bases?.seq || [])
    .filter((b) => b.base_type === 'master' || !b.master_base)
    .map((b) => ({
      id: String(b.id_base),
      groupId: String(b.id_bgroup),
      name: lang.base?.[b.id_base] || b.name_base || `Base ${b.id_base}`,
      jewellery: String(b.is_jewellery) === '1',
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const items = (coe.bitems?.seq || [])
    .filter((bi) => String(bi.is_legacy) !== '1')
    .map((bi) => {
      const name = bi.name_bitem || lang.bitem?.[bi.id_bitem] || `Item ${bi.id_bitem}`
      const props = parseProps(bi.properties)
      const req = parseProps(bi.requirements)
      return {
        id: String(bi.id_bitem),
        familyId: String(bi.id_base),
        name,
        dropLevel: Number(bi.drop_level) || 1,
        props,
        requirements: req,
        implicits: parseImplicits(bi.implicits),
        img: bi.imgurl || undefined,
      }
    })
    .sort((a, b) => a.dropLevel - b.dropLevel || a.name.localeCompare(b.name))

  // Only keep craftable groups for Lab primary flow (still include jewels for browse)
  const craftGroupIds = new Set(groups.filter((g) => g.craftable).map((g) => g.id))
  const familyIds = new Set(families.filter((f) => craftGroupIds.has(f.groupId)).map((f) => f.id))
  const catalog = {
    schemaVersion: 1,
    source: 'coe',
    generatedAt: new Date().toISOString(),
    groups: groups.filter((g) => g.craftable || ['9', '13', '12', '11'].includes(g.id)),
    families: families.filter((f) => craftGroupIds.has(f.groupId) || familyIds.has(f.id)),
    items: items.filter((i) => families.some((f) => f.id === i.familyId)),
  }

  // Re-filter items to families we kept
  const keepFamilies = new Set(catalog.families.map((f) => f.id))
  catalog.items = catalog.items.filter((i) => keepFamilies.has(i.familyId))

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(catalog))
  const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(2)
  console.log(
    `wrote ${mb}MB catalog: ${catalog.groups.length} groups, ${catalog.families.length} families, ${catalog.items.length} items → ${OUT}`,
  )
}

main()

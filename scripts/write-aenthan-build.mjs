/**
 * Build a GGG PoE2 BuildPlanner `.build` for Aenthan with the recommended tree refit.
 * Starts from the live ninja/PoB allocation, refunds wasted crit-chance notables,
 * paths to Pure Energy / Insightfulness / Snowpiercer / Cold Nature.
 */
import fs from 'node:fs'
import https from 'node:https'
import zlib from 'node:zlib'
import { homedir } from 'node:os'
import { join } from 'node:path'

const TREE = JSON.parse(fs.readFileSync('poe2-tree-data.json', 'utf8'))
const nodesBySkill = new Map()
const nodesById = new Map()
const nodesByName = new Map() // name -> array of skill numbers (notables/keystones preferred)

for (const [skillStr, n] of Object.entries(TREE.nodes)) {
  const skill = Number(skillStr)
  nodesBySkill.set(skill, n)
  nodesById.set(n.id, n)
  if (n.name) {
    const arr = nodesByName.get(n.name) || []
    arr.push(skill)
    nodesByName.set(n.name, arr)
  }
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'Scalpel-BuildWriter', Accept: 'application/json' } }, (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
          } catch (e) {
            reject(e)
          }
        })
      })
      .on('error', reject)
  })
}

function decodePob(code) {
  const padded = String(code).replace(/-/g, '+').replace(/_/g, '/')
  const buf = Buffer.from(padded, 'base64')
  try {
    return zlib.inflateSync(buf).toString('utf8')
  } catch {
    return zlib.gunzipSync(buf).toString('utf8')
  }
}

function neighbors(skill) {
  const n = nodesBySkill.get(skill)
  if (!n) return []
  const out = []
  for (const id of n.out || []) out.push(Number(id))
  for (const id of n.in || []) out.push(Number(id))
  return out
}

/** Shortest path of node skills from any allocated node to target (exclusive of start). */
function pathTo(allocated, target) {
  if (allocated.has(target)) return []
  const q = []
  const prev = new Map()
  for (const s of allocated) {
    q.push(s)
    prev.set(s, null)
  }
  let found = false
  while (q.length) {
    const cur = q.shift()
    for (const nxt of neighbors(cur)) {
      if (prev.has(nxt)) continue
      if (!nodesBySkill.has(nxt)) continue
      prev.set(nxt, cur)
      if (nxt === target) {
        found = true
        q.length = 0
        break
      }
      q.push(nxt)
    }
  }
  if (!found) return null
  const path = []
  let c = target
  while (c != null && !allocated.has(c)) {
    path.push(c)
    c = prev.get(c)
  }
  path.reverse()
  return path
}

function findNotable(name) {
  const skills = nodesByName.get(name) || []
  for (const s of skills) {
    const n = nodesBySkill.get(s)
    if (n?.isNotable || n?.isKeystone) return s
  }
  // fallback: any node with that name
  return skills[0] ?? null
}

function stripMarkup(s) {
  return String(s || '')
    .replace(/\[[^\]]*\|/g, '')
    .replace(/\]/g, '')
}

function itemToAdditionalText(item) {
  const d = item.itemData || {}
  const lines = []
  const rarity =
    d.frameTypeId === 'Unique' ? 'UNIQUE' : d.frameTypeId === 'Rare' ? 'RARE' : d.frameTypeId === 'Magic' ? 'MAGIC' : 'NORMAL'
  lines.push(`Rarity: ${rarity}`)
  if (d.name) lines.push(d.name)
  lines.push(d.typeLine || d.baseType || 'Unknown')
  if (d.id) lines.push(`Unique ID: ${d.id}`)
  if (d.ilvl) lines.push(`Item Level: ${d.ilvl}`)
  const sockets = (d.sockets || []).map(() => 'S').join(' ')
  if (sockets) lines.push(`Sockets: ${sockets}`)
  for (const s of d.socketedItems || []) {
    if (s.typeLine || s.name) lines.push(`Rune: ${s.typeLine || s.name}`)
  }
  const implicits = [...(d.implicitMods || []), ...(d.runeMods || [])]
  lines.push(`Implicits: ${implicits.length}`)
  for (const m of implicits) lines.push(stripMarkup(m))
  for (const m of d.explicitMods || []) lines.push(stripMarkup(m))
  for (const m of d.desecratedMods || []) lines.push(`{desecrated}${stripMarkup(m)}`)
  if (d.corrupted) lines.push('Corrupted')
  return lines.join('\n')
}

const SLOT_MAP = {
  1: 'Helm1',
  2: 'Gloves1',
  3: 'BodyArmour1',
  4: 'Amulet1',
  5: 'Boots1',
  6: 'Offhand1',
  7: 'Weapon1',
  8: 'Ring1',
  9: 'Ring2',
  11: 'Belt1',
  15: 'Weapon2', // staff / swap often
}

console.log('Fetching Aenthan…')
const raw = await fetchJson(
  'https://poe.ninja/poe2/api/profile/characters/Enin9-6394/runesofaldur/Aenthan/model/92',
)
const cm = raw.charModel
const xml = decodePob(cm.pathOfBuildingExport)

const allMatch = xml.match(/nodes="([^"]+)"/)
const allNodes = allMatch[1].split(',').map(Number)
const ws1 = new Set((xml.match(/<WeaponSet1 nodes="([^"]+)"/) || [])[1]?.split(',').map(Number) || [])
const ws2 = new Set((xml.match(/<WeaponSet2 nodes="([^"]+)"/) || [])[1]?.split(',').map(Number) || [])

const allocated = new Set(allNodes)

const REFUND_NAMES = [
  'Calculated Hunter',
  'Vulgar Methods',
  'Controlling Magic',
  'Sigil of Lightning',
  'Relentless Vindicator',
]

const TAKE_NAMES = ['Snowpiercer', 'Pure Energy', 'Insightfulness', 'Cold Nature']

const refundSkills = REFUND_NAMES.map(findNotable).filter(Boolean)
const takeSkills = TAKE_NAMES.map((n) => {
  const s = findNotable(n)
  if (!s) console.warn('missing notable', n)
  return s
}).filter(Boolean)

console.log(
  'refund',
  REFUND_NAMES.map((n) => `${n}=${findNotable(n)}`).join(', '),
)
console.log(
  'take',
  TAKE_NAMES.map((n) => `${n}=${findNotable(n)}`).join(', '),
)

// Remove refunded notables (keep travel for now; prune orphans later lightly)
for (const s of refundSkills) allocated.delete(s)

// Also remove small nodes that ONLY connect to refunded notables within a tiny radius —
// keep it simple: just remove the notables; orphan travel is OK for planner visibility.

for (const target of takeSkills) {
  const path = pathTo(allocated, target)
  if (!path) {
    console.warn('could not path to', target, nodesBySkill.get(target)?.name)
    continue
  }
  for (const s of path) allocated.add(s)
  console.log(
    'pathed',
    nodesBySkill.get(target)?.name,
    'via',
    path.length,
    'nodes',
  )
}

// Build passives list with weapon_set where original had it; new nodes inherit nearest set or none
function weaponSetFor(skill) {
  if (ws1.has(skill)) return 1
  if (ws2.has(skill)) return 2
  return undefined
}

const passives = []
for (const skill of allocated) {
  const n = nodesBySkill.get(skill)
  if (!n?.id) {
    console.warn('no ggg id for skill', skill)
    continue
  }
  const entry = { id: n.id }
  const ws = weaponSetFor(skill)
  // Prefer totem-ish new nodes on set 1, cast/int on set 2 when unlabeled
  if (ws) entry.weapon_set = ws
  else {
    const name = (n.name || '').toLowerCase()
    const stats = (n.stats || []).join(' ').toLowerCase()
    if (/totem|ancestral/.test(name + stats)) entry.weapon_set = 1
    else if (/cast speed|intelligence|cold|spell/.test(name + stats) && !n.isKeystone) {
      // leave unscoped for shared, or set 2 for cast clusters
    }
  }
  passives.push(entry)
}

passives.sort((a, b) => a.id.localeCompare(b.id))

// Inventory from live gear
const inventory_slots = []
for (const it of cm.items || []) {
  const inv = SLOT_MAP[it.itemSlot]
  if (!inv) continue
  // Prefer unique_name when unique
  const d = it.itemData || {}
  if (d.frameTypeId === 'Unique' && d.name) {
    inventory_slots.push({ inventory_id: inv, unique_name: d.name })
  } else {
    inventory_slots.push({ inventory_id: inv, additional_text: itemToAdditionalText(it) })
  }
}

// Skills: reuse socket groups from existing guide build if present, else minimal from ninja
let skills = []
const guidePath = join(homedir(), 'Downloads', 'Grim Pillars Oracle Lv100.build')
if (fs.existsSync(guidePath)) {
  const guide = JSON.parse(fs.readFileSync(guidePath, 'utf8'))
  skills = guide.skills || []
}

const build = {
  name: 'Aenthan CI Totem Tree Refit (Forced Outcome)',
  ascendancy: 'Druid1',
  passives,
  inventory_slots,
  skills,
  // Non-standard note field — GGG may ignore; handy for Scalpel paste
  _scalpel_notes:
    'Refunded Calculated Hunter, Vulgar Methods, Controlling Magic, Sigil of Lightning, Relentless Vindicator. Added Snowpiercer, Pure Energy, Insightfulness, Cold Nature. Gear from live Aenthan ninja export.',
}

const outName = 'Aenthan CI Totem Tree Refit.build'
const outPaths = [
  join(homedir(), 'Downloads', outName),
  join(homedir(), 'Documents', 'My Games', 'Path of Exile 2', 'BuildPlanner', outName),
  join(process.cwd(), outName),
]

const json = JSON.stringify(build, null, 2)
for (const p of outPaths) {
  try {
    fs.mkdirSync(join(p, '..'), { recursive: true })
    fs.writeFileSync(p, json)
    console.log('wrote', p, 'passives', passives.length, 'items', inventory_slots.length)
  } catch (e) {
    console.warn('skip', p, e.message)
  }
}

console.log(
  'taken present',
  takeSkills.map((s) => nodesBySkill.get(s)?.id),
)
console.log(
  'refunded absent',
  refundSkills.map((s) => ({ id: nodesBySkill.get(s)?.id, still: allocated.has(s) })),
)

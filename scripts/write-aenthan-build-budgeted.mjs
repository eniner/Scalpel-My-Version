/**
 * Point-budgeted tree refit for Aenthan.
 * Rule: final allocated node count must not exceed the live tree's count.
 * Only refund wasted crit-chance notables (+ their now-useless travel),
 * then spend leftover points on the cheapest reachable upgrades.
 */
import fs from 'node:fs'
import https from 'node:https'
import zlib from 'node:zlib'
import { homedir } from 'node:os'
import { join } from 'node:path'

const TREE = JSON.parse(fs.readFileSync('poe2-tree-data.json', 'utf8'))
const bySkill = new Map()
const byName = new Map()
for (const [k, n] of Object.entries(TREE.nodes)) {
  const skill = Number(k)
  bySkill.set(skill, n)
  if (!n.name) continue
  const arr = byName.get(n.name) || []
  arr.push(skill)
  byName.set(n.name, arr)
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'Scalpel-BuildWriter', Accept: 'application/json' } }, (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))))
      })
      .on('error', reject)
  })
}

function decodePob(code) {
  const buf = Buffer.from(String(code).replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  try {
    return zlib.inflateSync(buf).toString('utf8')
  } catch {
    return zlib.gunzipSync(buf).toString('utf8')
  }
}

function notableSkill(name) {
  const skills = byName.get(name) || []
  for (const s of skills) {
    const n = bySkill.get(s)
    if (n?.isNotable || n?.isKeystone) return s
  }
  return skills[0] ?? null
}

function neighbors(skill) {
  const n = bySkill.get(skill)
  if (!n) return []
  return [...(n.out || []), ...(n.in || [])].map(Number).filter((id) => bySkill.has(id))
}

/** Nodes that must stay: class start, ascendancy, keystones, jewel sockets. */
function isAnchor(skill) {
  const n = bySkill.get(skill)
  if (!n) return true
  if (n.isKeystone) return true
  if (n.isJewelSocket || String(n.id || '').startsWith('jewel_slot')) return true
  if (n.ascendancyName || n.ascendancyId || String(n.id || '').startsWith('Ascendancy')) return true
  if (String(n.id || '') === 'placeholder2') return true
  return false
}

/**
 * After removing `removed`, drop travel nodes that are no longer on ANY path
 * between remaining anchors. Conservative BFS from each remaining node that
 * is notable/keystone/ascendancy/jewel — keep the union of nodes needed to
 * connect the remaining graph from Druid start-ish anchors.
 *
 * Simpler approach used here:
 * - Start from all remaining allocated nodes that are anchors OR notables.
 * - Flood through currently-allocated edges only.
 * - Anything allocated but unreachable from that seed set is pruned.
 */
function pruneOrphans(allocated) {
  const seeds = [...allocated].filter((s) => {
    const n = bySkill.get(s)
    return isAnchor(s) || n?.isNotable
  })
  const keep = new Set()
  const q = [...seeds]
  for (const s of q) keep.add(s)
  while (q.length) {
    const cur = q.shift()
    for (const nxt of neighbors(cur)) {
      if (!allocated.has(nxt) || keep.has(nxt)) continue
      keep.add(nxt)
      q.push(nxt)
    }
  }
  return keep
}

/** Cheapest path cost from allocated set to target (number of NEW nodes). */
function pathCost(allocated, target) {
  if (allocated.has(target)) return { cost: 0, path: [] }
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
  return { cost: path.length, path }
}

function stripMarkup(s) {
  return String(s || '')
    .replace(/\[[^\]]*\|/g, '')
    .replace(/\]/g, '')
}

function itemText(item) {
  const d = item.itemData || {}
  const rarity =
    d.frameTypeId === 'Unique' ? 'UNIQUE' : d.frameTypeId === 'Rare' ? 'RARE' : 'NORMAL'
  const lines = [`Rarity: ${rarity}`]
  if (d.name) lines.push(d.name)
  lines.push(d.typeLine || d.baseType || 'Unknown')
  if (d.id) lines.push(`Unique ID: ${d.id}`)
  if (d.ilvl) lines.push(`Item Level: ${d.ilvl}`)
  const socks = (d.sockets || []).map(() => 'S').join(' ')
  if (socks) lines.push(`Sockets: ${socks}`)
  for (const s of d.socketedItems || []) lines.push(`Rune: ${s.typeLine || s.name}`)
  const imps = [...(d.implicitMods || []), ...(d.runeMods || [])]
  lines.push(`Implicits: ${imps.length}`)
  for (const m of imps) lines.push(stripMarkup(m))
  for (const m of d.explicitMods || []) lines.push(stripMarkup(m))
  for (const m of d.desecratedMods || []) lines.push(`{desecrated}${stripMarkup(m)}`)
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
  15: 'Weapon2',
}

const raw = await fetchJson(
  'https://poe.ninja/poe2/api/profile/characters/Enin9-6394/runesofaldur/Aenthan/model/92',
)
const cm = raw.charModel
const budget = cm.passiveCounts?.passives ?? 123
const xml = decodePob(cm.pathOfBuildingExport)
const original = xml.match(/nodes="([^"]+)"/)[1].split(',').map(Number)
const ws1 = new Set((xml.match(/<WeaponSet1 nodes="([^"]+)"/) || [])[1]?.split(',').map(Number) || [])
const ws2 = new Set((xml.match(/<WeaponSet2 nodes="([^"]+)"/) || [])[1]?.split(',').map(Number) || [])

// PoE2 weapon-set nodes share the same passive point pool as shared nodes.
// ninja "passives: 123" is the skill-point budget; allocated node count in PoB
// can be higher because weapon-set pairs are listed separately in the XML.
// Cap spending by: start from original set, never exceed original.size.
const BUDGET_NODES = original.length

console.log('ninja passive budget', budget)
console.log('live allocated nodes (PoB)', BUDGET_NODES)

const REFUND = [
  'Calculated Hunter',
  'Vulgar Methods',
  'Controlling Magic',
  'Sigil of Lightning',
  'Relentless Vindicator',
]
// Prefer cheap nearby upgrades only — ranked by value, taken only if cost fits.
const WISHLIST = [
  'Snowpiercer', // cold pen + int — high value if cheap
  'Cold Nature',
  'Pure Energy',
  'Insightfulness',
  'Mental Alacrity',
  'Essence Infusion',
  'Erraticism',
]

let allocated = new Set(original)
const refunded = []
for (const name of REFUND) {
  const s = notableSkill(name)
  if (s && allocated.has(s)) {
    allocated.delete(s)
    refunded.push({ name, skill: s, id: bySkill.get(s)?.id })
  }
}
allocated = pruneOrphans(allocated)
const afterRefund = allocated.size
const bank = BUDGET_NODES - afterRefund
console.log('after refund+prune', afterRefund, 'bank', bank, 'refunded', refunded.map((r) => r.name))

const taken = []
const candidates = WISHLIST.map((name) => {
  const skill = notableSkill(name)
  if (!skill) return null
  const pc = pathCost(allocated, skill)
  if (!pc) return null
  return { name, skill, ...pc }
})
  .filter(Boolean)
  .sort((a, b) => a.cost - b.cost)

let remaining = bank
for (const c of candidates) {
  // Recompute cost against current allocated (paths may shrink as we add)
  const pc = pathCost(allocated, c.skill)
  if (!pc) continue
  if (pc.cost > remaining) {
    console.log('skip', c.name, 'cost', pc.cost, 'remaining', remaining)
    continue
  }
  for (const s of pc.path) allocated.add(s)
  remaining = BUDGET_NODES - allocated.size
  taken.push({ name: c.name, cost: pc.cost, id: bySkill.get(c.skill)?.id })
  console.log('take', c.name, 'cost', pc.cost, 'remaining', remaining)
}

if (allocated.size > BUDGET_NODES) {
  throw new Error(`BUG: over budget ${allocated.size} > ${BUDGET_NODES}`)
}

// If we still have leftover bank, do nothing — leave unspent rather than stretch.

const passives = [...allocated]
  .map((skill) => {
    const n = bySkill.get(skill)
    if (!n?.id) return null
    const entry = { id: n.id }
    if (ws1.has(skill)) entry.weapon_set = 1
    else if (ws2.has(skill)) entry.weapon_set = 2
    return entry
  })
  .filter(Boolean)
  .sort((a, b) => a.id.localeCompare(b.id))

const inventory_slots = []
for (const it of cm.items || []) {
  const inv = SLOT_MAP[it.itemSlot]
  if (!inv) continue
  const d = it.itemData || {}
  if (d.frameTypeId === 'Unique' && d.name) {
    inventory_slots.push({ inventory_id: inv, unique_name: d.name })
  } else {
    inventory_slots.push({ inventory_id: inv, additional_text: itemText(it) })
  }
}

let skills = []
const guide = join(homedir(), 'Downloads', 'Grim Pillars Oracle Lv100.build')
if (fs.existsSync(guide)) skills = JSON.parse(fs.readFileSync(guide, 'utf8')).skills || []

const build = {
  name: 'Aenthan Tree Refit (123pt budget)',
  ascendancy: 'Druid1',
  passives,
  inventory_slots,
  skills,
}

const json = JSON.stringify(build, null, 2)
const name = 'Aenthan Tree Refit (123pt budget).build'
const outs = [
  join(process.cwd(), name),
  join(homedir(), 'Downloads', name),
  join(homedir(), 'Documents', 'My Games', 'Path of Exile 2', 'BuildPlanner', name),
]
for (const p of outs) {
  try {
    fs.mkdirSync(join(p, '..'), { recursive: true })
    fs.writeFileSync(p, json)
    console.log('wrote', p)
  } catch (e) {
    console.warn('skip', p, e.message)
  }
}

// Remove the impossible earlier file so it doesn't sit in the planner list.
for (const bad of [
  'Aenthan CI Totem Tree Refit.build',
  join(homedir(), 'Downloads', 'Aenthan CI Totem Tree Refit.build'),
  join(homedir(), 'Documents', 'My Games', 'Path of Exile 2', 'BuildPlanner', 'Aenthan CI Totem Tree Refit.build'),
]) {
  try {
    if (fs.existsSync(bad)) fs.unlinkSync(bad)
  } catch {
    /* ignore */
  }
}

console.log(
  JSON.stringify(
    {
      originalNodes: BUDGET_NODES,
      finalNodes: allocated.size,
      ninjaPassivePoints: budget,
      bankUsed: BUDGET_NODES - afterRefund - remaining,
      bankLeft: remaining,
      refunded: refunded.map((r) => r.name),
      taken,
    },
    null,
    2,
  ),
)

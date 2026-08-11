#!/usr/bin/env node
/**
 * Build src/shared/data/crafting/crafting-coe-poe2.json from Craft of Exile PoE2 export.
 * Uses per-base tier weightings (CoE / Prohibited Library methodology).
 *
 * Set COE_DATA_DIR to override source folder. Default: bundled coe-source/ or Desktop mirror.
 */
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const ROOT = path.join(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'src', 'shared', 'data', 'crafting')
const BUNDLED_SOURCE = path.join(OUT_DIR, 'coe-source')
const DEFAULT_MIRROR = path.join(
  process.env.USERPROFILE || '',
  'Desktop',
  'profusion site',
  'Craftofecile',
  'www.craftofexile.com',
  'json',
  'poe2',
)
const SCHEMA_VERSION = 2

function parseCoEFile(filePath, prefix) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const json = raw.startsWith(prefix) ? raw.slice(prefix.length) : raw
  return JSON.parse(json)
}

function resolveSourceDir() {
  if (process.env.COE_DATA_DIR && fs.existsSync(process.env.COE_DATA_DIR)) {
    return process.env.COE_DATA_DIR
  }
  if (fs.existsSync(path.join(BUNDLED_SOURCE, 'main', 'poec_data.json')) ||
      fs.existsSync(path.join(BUNDLED_SOURCE, 'main', 'poec_databfc2.json'))) {
    return BUNDLED_SOURCE
  }
  if (fs.existsSync(path.join(DEFAULT_MIRROR, 'main', 'poec_databfc2.json'))) {
    return DEFAULT_MIRROR
  }
  throw new Error(
    `CoE data not found. Copy json/poe2 from Craft of Exile mirror to ${BUNDLED_SOURCE} or set COE_DATA_DIR.`,
  )
}

function findDataFile(dir, subdir, pattern) {
  const folder = path.join(dir, subdir)
  if (!fs.existsSync(folder)) return null
  const hit = fs.readdirSync(folder).find((f) => f.startsWith(pattern))
  return hit ? path.join(folder, hit) : null
}

function isNum(x) {
  return typeof x === 'number' || (typeof x === 'string' && x !== '' && Number.isFinite(Number(x)))
}

/** Extract [min,max] pairs from CoE nvalues for Divine re-rolls. */
function parseRanges(nvalues) {
  try {
    const vals = JSON.parse(nvalues)
    const flat = []
    function walk(v) {
      if (Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1])) {
        flat.push([Number(v[0]), Number(v[1])])
        return
      }
      if (Array.isArray(v)) {
        v.forEach(walk)
        return
      }
    }
    walk(vals)
    return flat
  } catch {
    return []
  }
}

function formatModText(name, nvalues) {
  let text = name || ''
  try {
    const vals = JSON.parse(nvalues)
    const flat = []
    function walk(v) {
      // CoE stores each # placeholder as [min, max] (sometimes nested one level).
      if (Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1])) {
        flat.push([Number(v[0]), Number(v[1])])
        return
      }
      if (Array.isArray(v)) {
        v.forEach(walk)
        return
      }
      flat.push(v)
    }
    walk(vals)
    let i = 0
    text = text.replace(/#/g, () => {
      const v = flat[i++]
      if (v == null) return '#'
      if (Array.isArray(v)) {
        const [a, b] = v
        if (a === b) return String(a)
        return `(${a}-${b})`
      }
      return String(v)
    })
  } catch {
    // keep placeholders
  }
  return text.replace(/\s+/g, ' ').trim()
}

function parseModGroups(raw) {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter(Boolean) : []
  } catch {
    return []
  }
}

function mtypeTags(mtypes, mtypeById) {
  if (!mtypes) return []
  const ids = mtypes.split('|').filter(Boolean)
  const out = []
  for (const id of ids) {
    const mt = mtypeById[id]
    if (mt?.poedb_id) out.push(mt.poedb_id)
  }
  return out
}

const ARMOUR_MASTER_IDS = new Set([
  '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50',
  '52', '53', '54', '55', '56', '57', '229', '246',
])

/** modbases lists per-bitem ids; armour-class mods also list id_base master keys (33–57). */
function modbasesUsesArmorMasters(coe, modId) {
  const mb = coe.modbases?.[modId]
  if (!mb?.length) return false
  return mb.some((id) => ARMOUR_MASTER_IDS.has(id))
}

function modAppliesViaModbases(coe, modId, bitem) {
  const mb = coe.modbases?.[modId]
  if (!mb?.length) return true
  if (mb.includes(bitem.id_bitem)) return true
  if (modbasesUsesArmorMasters(coe, modId) && mb.includes(bitem.id_base)) return true
  return false
}

/** CoE tiers are keyed by id_bitem for some bases and id_base (master type) for others. */
function tierListFor(coe, modId, bitem) {
  if (!modAppliesViaModbases(coe, modId, bitem)) return null
  const byMod = coe.tiers[modId]
  if (!byMod) return null
  return byMod[bitem.id_bitem] || byMod[bitem.id_base] || null
}

function modIdsForBitem(coe, bitem) {
  const modIds = new Set(coe.basemods[bitem.id_bitem] || [])
  if (coe.basemods[bitem.id_base]) {
    for (const id of coe.basemods[bitem.id_base]) modIds.add(id)
  }
  for (const [modId, byBase] of Object.entries(coe.tiers)) {
    if (byBase[bitem.id_bitem] || byBase[bitem.id_base]) modIds.add(modId)
  }
  for (const [modId, bases] of Object.entries(coe.modbases || {})) {
    if (bases.includes(bitem.id_bitem)) modIds.add(modId)
    if (modbasesUsesArmorMasters(coe, modId) && bases.includes(bitem.id_base)) modIds.add(modId)
  }
  return [...modIds].filter((id) => tierListFor(coe, id, bitem))
}

/** CoE marksman rune pool uses pseudo base ids 27 + 200 (not real item bases). */
const MARKSMAN_POOL_IDS = ['27', '200']

function tierListForPoolId(coe, modId, poolId) {
  return coe.tiers[modId]?.[poolId] || null
}

function buildMarksmanPool(coe, lang, computeMgroups) {
  const modById = Object.fromEntries(coe.modifiers.seq.map((m) => [m.id_modifier, m]))
  const mtypeById = Object.fromEntries(coe.mtypes.seq.map((t) => [t.id_mtype, t]))
  const modIds = new Set()
  for (const poolId of MARKSMAN_POOL_IDS) {
    for (const modId of coe.basemods[poolId] || []) modIds.add(modId)
    for (const [modId, byBase] of Object.entries(coe.tiers)) {
      if (byBase[poolId]) modIds.add(modId)
    }
  }

  const mods = []
  const modKeySet = new Set()
  for (const modId of modIds) {
    const mod = modById[modId]
    if (!mod) continue
    if (mod.affix !== 'prefix' && mod.affix !== 'suffix') continue
    if (!computeMgroups.has(mod.id_mgroup)) continue

    let tierList = null
    let poolId = null
    for (const pid of MARKSMAN_POOL_IDS) {
      const list = tierListForPoolId(coe, modId, pid)
      if (list?.length) {
        tierList = list
        poolId = pid
        break
      }
    }
    if (!tierList?.length) continue

    const groups = parseModGroups(mod.modgroups)
    const primaryGroup = groups[0] || mod.name_modifier || modId
    const kind = mod.affix === 'prefix' ? 'p' : 's'
    const adds = mtypeTags(mod.mtypes, mtypeById)

    tierList.forEach((tier, tierIdx) => {
      const weight = Number(tier.weighting) || 0
      if (weight <= 0) return
      const ilvl = Number(tier.ilvl) || 1
      const id = `coe:m:${modId}:${poolId}:t${tierIdx}`
      if (modKeySet.has(id)) return
      modKeySet.add(id)

      const displayName = tier.alias || lang?.mod?.[modId] || mod.name_modifier || primaryGroup
      const text = formatModText(mod.name_modifier, tier.nvalues)

      mods.push({
        id,
        g: primaryGroup,
        ...(groups.length > 1 ? { bg: groups } : {}),
        k: kind,
        l: ilvl,
        n: displayName,
        t: text,
        w: [['__marksman__', weight]],
        ...(adds.length ? { a: adds } : {}),
        pool: 'marksman',
      })
    })
  }

  mods.sort((a, b) => a.id.localeCompare(b.id))
  return mods
}

/** CoE sometimes ships bitems whose id_base master was removed — infer slot from art path. */
const ORPHAN_CLASS_FROM_IMG = [
  [/BodyArmours/i, { c: 'Body Armours', bgroup: '2' }],
  [/Boots/i, { c: 'Boots', bgroup: '3' }],
  [/Gloves/i, { c: 'Gloves', bgroup: '5' }],
  [/Helmets/i, { c: 'Helmets', bgroup: '4' }],
  [/Belts|Amulets|Rings/i, { c: 'Jewellery', bgroup: '1' }],
]

function resolveBaseClass(bitem, master, bgroupById) {
  const bgroup = master ? bgroupById[master.id_bgroup] : null
  if (bgroup?.name_bgroup) {
    return { className: bgroup.name_bgroup, bgroupId: master.id_bgroup }
  }
  if (master?.name_base) {
    return { className: master.name_base, bgroupId: master.id_bgroup }
  }
  const img = bitem.imgurl || ''
  for (const [re, info] of ORPHAN_CLASS_FROM_IMG) {
    if (re.test(img)) return { className: info.c, bgroupId: info.bgroup }
  }
  return { className: 'Item', bgroupId: undefined }
}

function buildCatalysts(coe) {
  return (coe.catalysts?.seq || []).map((c) => ({
    id: String(c.id_catalyst),
    name: c.name_catalyst,
    tags: String(c.tags || '')
      .split('|')
      .map((t) => t.trim())
      .filter(Boolean),
  }))
}

function buildSocketables(coe, lang) {
  const modById = Object.fromEntries((coe.modifiers?.seq || []).map((m) => [m.id_modifier, m]))
  return (coe.socketables?.seq || []).map((s) => {
    let mods = {}
    try {
      mods = JSON.parse(s.mods || '{}')
    } catch {
      mods = {}
    }
    const texts = {}
    for (const [slot, modId] of Object.entries(mods)) {
      if (modId == null || modId === '' || Array.isArray(modId)) continue
      const mod = modById[String(modId)]
      if (!mod) continue
      const name = lang?.mod?.[String(modId)] || mod.name_modifier
      if (name) texts[slot] = name
    }
    return {
      id: String(s.id_socketable),
      stype: s.stype || 'rune',
      name: s.name_socketable,
      mods,
      ...(Object.keys(texts).length ? { texts } : {}),
      img: s.imgurl || undefined,
    }
  })
}

function resolvePricesDir(srcDir) {
  const candidates = [path.join(srcDir, 'prices'), path.join(DEFAULT_MIRROR, 'prices')]
  for (const dir of candidates) {
    if (!fs.existsSync(dir)) continue
    const hit = fs.readdirSync(dir).find((f) => f.startsWith('poec_prices') && f.endsWith('.json'))
    if (hit) return dir
  }
  return null
}

function buildChaosPrices(srcDir) {
  const pricesDir = resolvePricesDir(srcDir)
  if (!pricesDir) return {}
  const file = fs.readdirSync(pricesDir).find((f) => f.startsWith('poec_prices') && f.endsWith('.json'))
  if (!file) return {}
  try {
    const raw = fs.readFileSync(path.join(pricesDir, file), 'utf8')
    const json = JSON.parse(raw.replace(/^poecp=/, '').replace(/;\s*$/, ''))
    const leagues = Object.keys(json.data || {})
    // Prefer Softcore-ish league; skip HC unless that's all we have.
    const league =
      leagues.find((n) => /runes of|standard|soft/i.test(n) && !/^hc\b/i.test(n)) ||
      leagues.find((n) => !/^hc\b/i.test(n)) ||
      leagues[0]
    if (!league) return {}
    const block = json.data[league] || {}
    const out = {}
    for (const cat of ['currency', 'essences', 'omens', 'runes', 'talismans', 'catalysts', 'abyss']) {
      const map = block[cat]
      if (!map || typeof map !== 'object' || Array.isArray(map)) continue
      for (const [name, val] of Object.entries(map)) {
        const n = Number(val)
        if (Number.isFinite(n) && n > 0) out[name] = n
      }
    }
    // soulcores sometimes array — skip
    out.__league = league
    return out
  } catch (e) {
    console.warn('chaos prices bake failed:', e.message || e)
    return {}
  }
}

function buildMaxSocketsByClass(coe) {
  const out = {}
  for (const g of coe.bgroups?.seq || []) {
    const n = Number(g.max_sockets)
    if (g.name_bgroup && Number.isFinite(n) && n > 0) out[g.name_bgroup] = n
  }
  return out
}

function buildDataset(coe, lang, srcDir = resolveSourceDir()) {
  const modifiers = coe.modifiers.seq
  const modById = Object.fromEntries(modifiers.map((m) => [m.id_modifier, m]))
  const mgroupById = Object.fromEntries(coe.mgroups.seq.map((g) => [g.id_mgroup, g]))
  const mtypeById = Object.fromEntries(coe.mtypes.seq.map((t) => [t.id_mtype, t]))
  const bgroupById = Object.fromEntries(coe.bgroups.seq.map((b) => [b.id_bgroup, b]))
  const baseMasterById = Object.fromEntries(coe.bases.seq.map((b) => [b.id_base, b]))

  const computeMgroups = new Set(
    coe.mgroups.seq.filter((g) => g.is_compute === '1' || g.is_compute === 1).map((g) => g.id_mgroup),
  )

  const mods = []
  const modKeySet = new Set()
  const bases = {}

  for (const bitem of coe.bitems.seq) {
    const baseName = bitem.name_bitem
    if (!baseName) continue

    const master = baseMasterById[bitem.id_base]
    const { className, bgroupId } = resolveBaseClass(bitem, master, bgroupById)
    const tags = new Set([baseName, 'default'])
    if (master?.is_jewellery === '1') tags.add('jewellery')
    if (master?.is_martial === '1') tags.add('martial')
    if (master?.name_base) tags.add(master.name_base.toLowerCase().replace(/\s+/g, '_'))
    bases[baseName] = {
      tags: [...tags],
      c: className,
      coeId: bitem.id_bitem,
      bgroup: bgroupId,
    }

    const modIds = modIdsForBitem(coe, bitem)

    for (const modId of modIds) {
      const mod = modById[modId]
      if (!mod) continue
      if (mod.affix !== 'prefix' && mod.affix !== 'suffix') continue
      if (!computeMgroups.has(mod.id_mgroup)) continue

      const tierList = tierListFor(coe, modId, bitem)
      if (!tierList?.length) continue

      const groups = parseModGroups(mod.modgroups)
      const primaryGroup = groups[0] || mod.name_modifier || modId
      const kind = mod.affix === 'prefix' ? 'p' : 's'
      const adds = mtypeTags(mod.mtypes, mtypeById)

      tierList.forEach((tier, tierIdx) => {
        const weight = Number(tier.weighting) || 0
        if (weight <= 0) return
        const ilvl = Number(tier.ilvl) || 1
        const id = `coe:${modId}:${bitem.id_bitem}:t${tierIdx}`
        if (modKeySet.has(id)) return
        modKeySet.add(id)

        const displayName = tier.alias || lang?.mod?.[modId] || mod.name_modifier || primaryGroup
        const text = formatModText(mod.name_modifier, tier.nvalues)
        const ranges = parseRanges(tier.nvalues)

        mods.push({
          id,
          g: primaryGroup,
          ...(groups.length > 1 ? { bg: groups } : {}),
          k: kind,
          l: ilvl,
          n: displayName,
          t: text,
          w: [[baseName, weight]],
          ...(adds.length ? { a: adds } : {}),
          ...(ranges.length ? { ranges } : {}),
        })
      })
    }

    // Desecrated mods (CoE mgroup 10) — separate pool for bone crafting
    for (const modId of modIds) {
      const mod = modById[modId]
      if (!mod) continue
      if (mod.id_mgroup !== '10' && mod.id_mgroup !== 10) continue
      if (mod.affix !== 'prefix' && mod.affix !== 'suffix') continue

      const tierList = tierListFor(coe, modId, bitem)
      if (!tierList?.length) continue

      const groups = parseModGroups(mod.modgroups)
      const primaryGroup = groups[0] || mod.name_modifier || modId
      const kind = mod.affix === 'prefix' ? 'p' : 's'
      const adds = mtypeTags(mod.mtypes, mtypeById)

      tierList.forEach((tier, tierIdx) => {
        const weight = Number(tier.weighting) || 0
        if (weight <= 0) return
        const ilvl = Number(tier.ilvl) || 1
        const id = `coe:d:${modId}:${bitem.id_bitem}:t${tierIdx}`
        if (modKeySet.has(id)) return
        modKeySet.add(id)

        const displayName = tier.alias || lang?.mod?.[modId] || mod.name_modifier || primaryGroup
        const text = formatModText(mod.name_modifier, tier.nvalues)
        const ranges = parseRanges(tier.nvalues)

        mods.push({
          id,
          g: primaryGroup,
          ...(groups.length > 1 ? { bg: groups } : {}),
          k: kind,
          l: ilvl,
          n: displayName,
          t: text,
          w: [[baseName, weight]],
          ...(adds.length ? { a: adds } : {}),
          ...(ranges.length ? { ranges } : {}),
          desecrated: true,
        })
      })
    }
  }

  mods.sort((a, b) => a.id.localeCompare(b.id))
  const marksmanMods = buildMarksmanPool(coe, lang, computeMgroups)

  const currencies = buildCurrencies(coe)
  const essences = buildEssences(coe, lang)
  const catalysts = buildCatalysts(coe)
  const socketables = buildSocketables(coe, lang)
  const chaosPricesRaw = buildChaosPrices(srcDir)
  const { __league, ...chaosPrices } = chaosPricesRaw
  const maxSocketsByClass = buildMaxSocketsByClass(coe)

  return {
    schemaVersion: SCHEMA_VERSION,
    source: 'coe',
    coePatch: '0.5.0',
    mods,
    marksmanMods,
    bases,
    currencies,
    essences,
    catalysts,
    socketables,
    maxSocketsByClass,
    chaosPrices,
  }
}

function tierFloorForName(name) {
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

function buildCurrencies(coe) {
  const ORBS = [
    ['Chaos Orb', 'Reforges a Rare item with new random modifiers', 1],
    ['Greater Chaos Orb', 'Reforges a Rare item with new random modifiers (higher tier floor)', 35],
    ['Perfect Chaos Orb', 'Reforges a Rare item with new random modifiers (highest tier floor)', 50],
    ['Exalted Orb', 'Adds a random modifier to a Rare item', 1],
    ['Greater Exalted Orb', 'Adds a random modifier to a Rare item (higher tier floor)', 35],
    ['Perfect Exalted Orb', 'Adds a random modifier to a Rare item (highest tier floor)', 50],
    ['Orb of Alchemy', 'Upgrades a Normal item to Rare with 4 modifiers', 1],
    ['Orb of Transmutation', 'Upgrades a Normal item to Magic with 1 modifier', 1],
    ['Greater Orb of Transmutation', 'Upgrades a Normal item to Magic (higher tier floor)', 44],
    ['Perfect Orb of Transmutation', 'Upgrades a Normal item to Magic (highest tier floor)', 70],
    ['Orb of Augmentation', 'Adds a random modifier to a Magic item', 1],
    ['Greater Orb of Augmentation', 'Adds a random modifier to a Magic item (higher tier floor)', 44],
    ['Perfect Orb of Augmentation', 'Adds a random modifier to a Magic item (highest tier floor)', 70],
    ['Regal Orb', 'Upgrades a Magic item to Rare, adding a random modifier', 1],
    ['Greater Regal Orb', 'Upgrades a Magic item to Rare, adding a modifier (higher tier floor)', 35],
    ['Perfect Regal Orb', 'Upgrades a Magic item to Rare, adding a modifier (highest tier floor)', 50],
    ['Orb of Annulment', 'Removes a random modifier from an item', 1],
    ['Orb of Alteration', 'Rerolls modifiers on a Magic item', 1],
    ['Orb of Scouring', 'Removes all modifiers and rarity from an item', 1],
    ['Divine Orb', 'Randomises the numeric values of modifiers', 1],
    ['Fracturing Orb', 'Fractures a random modifier on a Rare item', 1],
    ['Vaal Orb', 'Corrupts an item unpredictably', 1],
    ['Artificer\'s Orb', 'Adds or rerolls sockets on an item', 1],
  ]

  const out = ORBS.map(([name, desc, lvl]) => ({
    name,
    desc,
    lvl,
    cat: name.includes('Essence') ? 'essence' : name.includes('Omen') ? 'omen' : 'orb',
    tierFloor: tierFloorForName(name),
  }))

  for (const ess of coe.essences?.seq || []) {
    out.push({
      name: ess.name_essence,
      desc: parseEssenceTooltip(ess.tooltip) || 'Essence crafting (forces a specific modifier).',
      lvl: 1,
      cat: 'essence',
      essenceId: ess.id_essence,
    })
  }

  for (const cat of coe.catalysts?.seq || []) {
    out.push({
      name: cat.name_catalyst || `Catalyst ${cat.id_catalyst}`,
      desc: 'Quality catalyst.',
      lvl: 1,
      cat: 'catalyst',
    })
  }

  out.sort((a, b) => a.cat.localeCompare(b.cat) || a.lvl - b.lvl || a.name.localeCompare(b.name))
  return out
}

function parseEssenceTooltip(raw) {
  if (!raw) return ''
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr) || !arr.length) return ''
    return arr[0].replace(/\s+/g, ' ').trim()
  } catch {
    return ''
  }
}

function pickTierFromList(tierList, targetIlvl) {
  if (!tierList?.length) return null
  return (
    tierList.find((t) => Number(t.ilvl) === targetIlvl) ||
    [...tierList].filter((t) => Number(t.ilvl) <= targetIlvl).sort((a, b) => Number(b.ilvl) - Number(a.ilvl))[0]
  )
}

function resolveEssenceTier(coe, modId, bi, targetIlvl) {
  let tier = pickTierFromList(coe.tiers[modId]?.[bi.id_bitem], targetIlvl)
  if (tier) return tier
  tier = pickTierFromList(coe.tiers[modId]?.[bi.id_base], targetIlvl)
  if (tier) return tier

  for (const sib of coe.bitems.seq) {
    if (sib.id_base !== bi.id_base) continue
    tier = pickTierFromList(coe.tiers[modId]?.[sib.id_bitem], targetIlvl)
    if (tier) return tier
  }

  const byMod = coe.tiers[modId]
  if (byMod) {
    for (const list of Object.values(byMod)) {
      const exact = list.find((t) => Number(t.ilvl) === targetIlvl)
      if (exact) return exact
    }
    for (const list of Object.values(byMod)) {
      tier = pickTierFromList(list, targetIlvl)
      if (tier) return tier
    }
  }
  return null
}

function buildEssences(coe, lang) {
  const modById = Object.fromEntries(coe.modifiers.seq.map((m) => [m.id_modifier, m]))
  const bitemsByBaseId = {}
  for (const bi of coe.bitems.seq) {
    if (!bitemsByBaseId[bi.id_base]) bitemsByBaseId[bi.id_base] = []
    bitemsByBaseId[bi.id_base].push(bi)
  }

  return (coe.essences?.seq || []).map((e) => {
    let tiersRaw = {}
    try {
      tiersRaw = JSON.parse(e.tiers || '{}')
    } catch {
      tiersRaw = {}
    }
    const bases = {}
    for (const [baseId, tierArr] of Object.entries(tiersRaw)) {
      const entry = tierArr?.[0]?.[0]
      if (!entry) continue
      const bis = bitemsByBaseId[baseId] || []
      for (const bi of bis) {
        const mod = modById[entry.mod]
        if (!mod) continue
        const targetIlvl = Number(entry.ilvl) || 1
        const tier = resolveEssenceTier(coe, entry.mod, bi, targetIlvl)
        if (!tier) continue
        const groups = parseModGroups(mod.modgroups)
        const primaryGroup = groups[0] || mod.name_modifier || entry.mod
        const kind = mod.affix === 'prefix' ? 'p' : 's'
        const text = formatModText(mod.name_modifier, tier.nvalues)
        const displayName = tier.alias || lang?.mod?.[entry.mod] || mod.name_modifier || primaryGroup
        bases[bi.name_bitem] = {
          modId: entry.mod,
          ilvl: Number(tier.ilvl) || targetIlvl,
          group: primaryGroup,
          kind,
          text,
          name: displayName,
          minIlvl: targetIlvl,
        }
      }
    }
    const tooltip = parseEssenceTooltip(e.tooltip)
    return {
      id: e.id_essence,
      name: e.name_essence,
      lvl: 1,
      desc: tooltip || 'Essence crafting (forces a specific modifier on a Magic item).',
      bases,
    }
  })
}

function copySourceToBundled(srcDir) {
  fs.mkdirSync(BUNDLED_SOURCE, { recursive: true })
  for (const sub of ['main', 'lang', 'prices']) {
    let from = path.join(srcDir, sub)
    if (!fs.existsSync(from) && sub === 'prices') from = path.join(DEFAULT_MIRROR, 'prices')
    if (!fs.existsSync(from)) continue
    const to = path.join(BUNDLED_SOURCE, sub)
    fs.mkdirSync(to, { recursive: true })
    for (const f of fs.readdirSync(from)) {
      if (!f.endsWith('.json')) continue
      const srcPath = path.join(from, f)
      const destName = f.startsWith('poec_data') ? 'poec_data.json' : f
      fs.copyFileSync(srcPath, path.join(to, destName))
    }
  }
}

function main() {
  const srcDir = resolveSourceDir()
  const dataFile = findDataFile(srcDir, 'main', 'poec_data') || findDataFile(srcDir, 'main', 'poec_databfc2')
  const langFile = findDataFile(srcDir, 'lang', 'poec_lang')
  if (!dataFile) throw new Error('poec_data*.json not found in CoE source')

  if (srcDir !== BUNDLED_SOURCE) {
    console.log(`copying CoE source from ${srcDir} → coe-source/`)
    copySourceToBundled(srcDir)
  } else {
    // Bundled main/lang may predate prices — sync from Desktop mirror when present.
    copySourceToBundled(srcDir)
  }

  const coe = parseCoEFile(dataFile, 'poecd=')
  const lang = langFile ? parseCoEFile(langFile, 'poecl=') : {}
  const dataset = buildDataset(coe, lang, srcDir)

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const json = `${JSON.stringify(dataset)}\n`
  const outPath = path.join(OUT_DIR, 'crafting-coe-poe2.json')
  fs.writeFileSync(outPath, json, 'utf8')
  const hash = crypto.createHash('sha256').update(json).digest('hex')
  fs.writeFileSync(
    path.join(OUT_DIR, 'crafting-coe-manifest.json'),
    `${JSON.stringify(
      {
        schemaVersion: SCHEMA_VERSION,
        source: 'coe',
        hash,
        generatedAt: new Date().toISOString(),
        modCount: dataset.mods.length,
        marksmanModCount: dataset.marksmanMods?.length ?? 0,
        baseCount: Object.keys(dataset.bases).length,
        currencyCount: dataset.currencies.length,
        essenceCount: dataset.essences?.length ?? 0,
        catalystCount: dataset.catalysts?.length ?? 0,
        socketableCount: dataset.socketables?.length ?? 0,
        priceCount: Object.keys(dataset.chaosPrices || {}).length,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
  console.log(
    `wrote ${(json.length / 1048576).toFixed(2)}MB CoE dataset: ${dataset.mods.length} tier-mods, ${dataset.marksmanMods?.length ?? 0} marksman, ${Object.keys(dataset.bases).length} bases, ${dataset.currencies.length} currencies, ${dataset.essences?.length ?? 0} essences, ${dataset.catalysts?.length ?? 0} catalysts, ${dataset.socketables?.length ?? 0} socketables, ${Object.keys(dataset.chaosPrices || {}).length} prices`,
  )
}

if (require.main === module) {
  try {
    main()
  } catch (e) {
    console.error(e.message || e)
    process.exit(1)
  }
}

module.exports = { buildDataset, formatModText, SCHEMA_VERSION, tierListFor, modIdsForBitem }

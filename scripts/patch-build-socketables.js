const fs = require('node:fs')
const path = require('node:path')
const p = path.join(__dirname, 'build-coe-crafting-data.js')
let s = fs.readFileSync(p, 'utf8')

if (!s.includes('function buildSocketables')) {
  s = s.replace(
    `function buildCatalysts(coe) {
  return (coe.catalysts?.seq || []).map((c) => ({
    id: String(c.id_catalyst),
    name: c.name_catalyst,
    tags: String(c.tags || '')
      .split('|')
      .map((t) => t.trim())
      .filter(Boolean),
  }))
}`,
    `function buildCatalysts(coe) {
  return (coe.catalysts?.seq || []).map((c) => ({
    id: String(c.id_catalyst),
    name: c.name_catalyst,
    tags: String(c.tags || '')
      .split('|')
      .map((t) => t.trim())
      .filter(Boolean),
  }))
}

function buildSocketables(coe) {
  return (coe.socketables?.seq || []).map((s) => {
    let mods = {}
    try {
      mods = JSON.parse(s.mods || '{}')
    } catch {
      mods = {}
    }
    return {
      id: String(s.id_socketable),
      stype: s.stype || 'rune',
      name: s.name_socketable,
      mods,
      img: s.imgurl || undefined,
    }
  })
}

function buildMaxSocketsByClass(coe) {
  const out = {}
  for (const g of coe.bgroups?.seq || []) {
    const n = Number(g.max_sockets)
    if (g.name_bgroup && Number.isFinite(n) && n > 0) out[g.name_bgroup] = n
  }
  return out
}`,
  )
}

// desecrated tiers: add ranges
s = s.replace(
  `        const displayName = tier.alias || lang?.mod?.[modId] || mod.name_modifier || primaryGroup
        const text = formatModText(mod.name_modifier, tier.nvalues)

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
          desecrated: true,
        })`,
  `        const displayName = tier.alias || lang?.mod?.[modId] || mod.name_modifier || primaryGroup
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
        })`,
)

s = s.replace(
  `  const currencies = buildCurrencies(coe)
  const essences = buildEssences(coe, lang)
  const catalysts = buildCatalysts(coe)

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
  }
}`,
  `  const currencies = buildCurrencies(coe)
  const essences = buildEssences(coe, lang)
  const catalysts = buildCatalysts(coe)
  const socketables = buildSocketables(coe)
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
  }
}`,
)

fs.writeFileSync(p, s)
console.log('build script patched')

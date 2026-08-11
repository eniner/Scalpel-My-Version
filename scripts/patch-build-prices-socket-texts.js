const fs = require('node:fs')
const path = require('node:path')
const p = path.join(__dirname, 'build-coe-crafting-data.js')
let s = fs.readFileSync(p, 'utf8')

const socketableFn = `function buildSocketables(coe) {
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
}`

const socketableFnNew = `function buildSocketables(coe, lang) {
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

function buildChaosPrices(srcDir) {
  const pricesDir = path.join(srcDir, 'prices')
  if (!fs.existsSync(pricesDir)) return {}
  const file = fs.readdirSync(pricesDir).find((f) => f.startsWith('poec_prices') && f.endsWith('.json'))
  if (!file) return {}
  try {
    const raw = fs.readFileSync(path.join(pricesDir, file), 'utf8')
    const json = JSON.parse(raw.replace(/^poecp=/, '').replace(/;\\s*$/, ''))
    const leagues = Object.keys(json.data || {})
    // Prefer a Softcore-ish league; else first.
    const league =
      leagues.find((n) => /runes of|standard|soft/i.test(n)) ||
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
}`

if (!s.includes('function buildChaosPrices')) {
  s = s.replace(socketableFn, socketableFnNew)
}

s = s.replace(
  'const socketables = buildSocketables(coe)',
  'const socketables = buildSocketables(coe, lang)\n  const chaosPricesRaw = buildChaosPrices(resolveSourceDir())\n  const { __league, ...chaosPrices } = chaosPricesRaw',
)

if (!s.includes('chaosPrices,')) {
  s = s.replace(
    `    socketables,
    maxSocketsByClass,
  }
}`,
    `    socketables,
    maxSocketsByClass,
    chaosPrices,
  }
}`,
  )
}

// manifest / log
s = s.replace(
  /catalystCount: dataset\.catalysts\?\.length \?\? 0,/,
  `catalystCount: dataset.catalysts?.length ?? 0,
        socketableCount: dataset.socketables?.length ?? 0,
        priceCount: Object.keys(dataset.chaosPrices || {}).length,`,
)

s = s.replace(
  /\$\{dataset\.catalysts\?\.length \?\? 0\} catalysts`/,
  `\${dataset.catalysts?.length ?? 0} catalysts, \${dataset.socketables?.length ?? 0} socketables, \${Object.keys(dataset.chaosPrices || {}).length} prices\``,
)

fs.writeFileSync(p, s)
console.log('build script prices/socket texts patched')

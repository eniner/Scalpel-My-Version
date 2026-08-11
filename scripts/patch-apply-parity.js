const fs = require('node:fs')
const path = require('node:path')
const p = path.join(__dirname, '..', 'src', 'shared', 'crafting', 'apply.ts')
let s = fs.readFileSync(p, 'utf8')

s = s.replace(
  /opts\?: \{ marksmanEnabled\?: boolean \},\r?\n\): CraftItemState \| null \{\r?\n  const tags = getBaseTags\(data, baseType\)\r?\n  if \(!tags\) return null\r?\n  const base = data\.bases\[baseType\]\r?\n  return \{\r?\n    baseType,\r?\n    itemLevel: Math\.max\(1, itemLevel\),\r?\n    rarity: 'Normal',\r?\n    tags,\r?\n    itemClass: base\.c,\r?\n    corrupted: false,\r?\n    mods: \[\],\r?\n    activeOmens: \[\],\r?\n    \.\.\.\(opts\?\.marksmanEnabled \? \{ marksmanEnabled: true \} : \{\}\),\r?\n  \}\r?\n\}/,
  `opts?: { marksmanEnabled?: boolean; quality?: number; catalyst?: string },
): CraftItemState | null {
  const tags = getBaseTags(data, baseType)
  if (!tags) return null
  const base = data.bases[baseType]
  return {
    baseType,
    itemLevel: Math.max(1, itemLevel),
    rarity: 'Normal',
    tags,
    itemClass: base.c,
    corrupted: false,
    mods: [],
    activeOmens: [],
    quality: opts?.quality ?? 20,
    sockets: 0,
    socketed: [],
    ...(opts?.catalyst ? { catalyst: opts.catalyst } : {}),
    ...(opts?.marksmanEnabled ? { marksmanEnabled: true } : {}),
  }
}`,
)

s = s.replace(/rolled\.map\(craftModToItemMod\)/g, 'rolled.map((m) => craftModToItemMod(m, rng))')
s = s.replace(/const added = craftModToItemMod\(mod\)/g, 'const added = craftModToItemMod(mod, rng)')
s = s.replace(/const itemMod = craftModToItemMod\(mod\)/g, 'const itemMod = craftModToItemMod(mod, rng)')

const oldDivine = `  if (sim === 'divine') {
    if (next.mods.length === 0) return fail(state, actionId, label, 'Item has no modifiers.')
    return ok(next, actionId, label, 'Divine rerolled numeric values (lines unchanged in emulator).')
  }`

const newDivine = `  if (sim === 'divine') {
    if (next.mods.length === 0) return fail(state, actionId, label, 'Item has no modifiers.')
    next.mods = next.mods.map((m) => (m.fractured || m.veiled ? m : divineRerollMod(m, rng)))
    return ok(next, actionId, label, \`Divine rerolled numeric values on \${next.mods.length} modifier(s).\`)
  }

  if (sim === 'catalyst') {
    const name = actionId.startsWith('currency:') ? actionId.slice('currency:'.length) : label
    const cat = resolveCatalyst(data, name)
    if (!cat) return fail(state, actionId, label, \`Unknown catalyst "\${name}".\`)
    next.catalyst = cat.name
    if (next.quality == null) next.quality = 20
    return ok(
      next,
      actionId,
      label,
      \`Applied \${cat.name} catalyst (quality \${next.quality}%). Matching tags: \${cat.tags.join(', ') || 'none'}.\`,
    )
  }

  if (sim === 'artificer') {
    if (next.corrupted) return fail(state, actionId, label, 'Cannot socket a corrupted item.')
    const max = data.maxSocketsByClass?.[next.itemClass] ?? 0
    if (max <= 0) return fail(state, actionId, label, 'This base cannot have sockets.')
    const prev = next.sockets ?? 0
    if (prev >= max) {
      next.socketed = []
      return ok(next, actionId, label, \`Rerolled sockets (\${max}/\${max}).\`)
    }
    next.sockets = prev + 1
    return ok(next, actionId, label, \`Added a socket (\${next.sockets}/\${max}).\`)
  }`

if (!s.includes(oldDivine)) {
  console.error('divine block not found')
  process.exit(1)
}
s = s.replace(oldDivine, newDivine)

const oldVaal = `  if (sim === 'vaal') {
    next.corrupted = true
    return ok(next, actionId, label, 'Item corrupted (full Vaal outcomes not modeled).')
  }`

const newVaal = `  if (sim === 'vaal') {
    if (next.corrupted) return fail(state, actionId, label, 'Item is already corrupted.')
    next.corrupted = true
    const roll = rng()
    // Simplified PoE2-style outcomes for planning (not full Vaal tables).
    if (roll < 0.25 && next.mods.length > 0) {
      const idx = Math.floor(rng() * next.mods.length)
      const [removed] = next.mods.splice(idx, 1)
      return ok(next, actionId, label, \`Corrupted — removed \${removed.text}.\`, { removed: [removed] })
    }
    if (roll < 0.45) {
      const mod = rollOneExaltMod(data, next, rng, 0)
      if (mod) {
        const added = craftModToItemMod(mod, rng)
        next.mods.push(added)
        return ok(next, actionId, label, \`Corrupted — added \${added.text}.\`, { added: [added] })
      }
    }
    if (roll < 0.55 && next.rarity === 'Normal') {
      next.rarity = 'Rare'
      const rolled = rollMods(data, next, 4, 3, 3, new Set(), rollTagsForState(next), rng, 0)
      next.mods = rolled.map((m) => craftModToItemMod(m, rng))
      return ok(next, actionId, label, 'Corrupted — became Rare with new modifiers.', { added: next.mods })
    }
    return ok(next, actionId, label, 'Corrupted — no other change.')
  }`

if (!s.includes(oldVaal)) {
  console.error('vaal block not found')
  process.exit(1)
}
s = s.replace(oldVaal, newVaal)

fs.writeFileSync(p, s)
console.log('patched', p)

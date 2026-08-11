import fs from 'node:fs'
import https from 'node:https'
import { homedir } from 'node:os'
import { join } from 'node:path'

function get(url) {
  return new Promise((res, rej) => {
    https
      .get(url, { headers: { 'User-Agent': 'Scalpel', Accept: 'application/json' } }, (r) => {
        const c = []
        r.on('data', (d) => c.push(d))
        r.on('end', () => res(JSON.parse(Buffer.concat(c).toString('utf8'))))
      })
      .on('error', rej)
  })
}

function strip(s) {
  return String(s || '')
    .replace(/\[[^\]]*\|/g, '')
    .replace(/\]/g, '')
}

function itemText(item) {
  const d = item.itemData || {}
  const rarity = d.frameTypeId === 'Unique' ? 'UNIQUE' : d.frameTypeId === 'Rare' ? 'RARE' : 'NORMAL'
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
  for (const m of imps) lines.push(strip(m))
  for (const m of d.explicitMods || []) lines.push(strip(m))
  for (const m of d.desecratedMods || []) lines.push(`{desecrated}${strip(m)}`)
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

// IDs copied from a known-good in-game BuildPlanner export (Grim Pillars Oracle Lv100.build)
const skills = [
  {
    id: 'Metadata/Items/Gems/SkillGemSpellTotem',
    support_skills: [
      { id: 'Metadata/Items/Gems/SkillGemGrimPillars' },
      { id: 'Metadata/Items/Gem/SupportGemAncestralUrgencyThree' },
      { id: 'Metadata/Items/Gems/SupportGemColdMastery' },
      { id: 'Metadata/Items/Gem/SupportGemVoranasSiege' },
      { id: 'Metadata/Items/Gem/SupportGemRakiatasFlow' },
    ],
  },
  {
    id: 'Metadata/Items/Gem/SkillGemEntangle',
    support_skills: [
      { id: 'Metadata/Items/Gem/SupportGemMorrigansInsight' },
      { id: 'Metadata/Items/Gem/SupportGemBranchingFissuresTwo' },
      { id: 'Metadata/Items/Gems/SupportGemMagnifiedEffectTwo' },
      { id: 'Metadata/Items/Gems/SupportGemArcaneTempoTwo' },
      { id: 'Metadata/Items/Gems/SupportGemInspirationTwo' }, // Efficiency II analogue in GGG export naming
    ],
  },
  {
    id: 'Metadata/Items/Gems/SkillGemManaTempest',
    support_skills: [
      { id: 'Metadata/Items/Gem/SupportGemAdvancingStorm' },
      { id: 'Metadata/Items/Gems/SupportGemIngenuityTwo' },
      { id: 'Metadata/Items/Gems/SupportGemInspirationTwo' },
      { id: 'Metadata/Items/Gems/SupportGemLightningMastery' },
    ],
  },
  {
    id: 'Metadata/Items/Gems/SkillGemPurityOfLightning',
    support_skills: [
      { id: 'Metadata/Items/Gems/SupportGemClarityTwo' },
      { id: 'Metadata/Items/Gem/SupportGemMysticismTwo' },
      { id: 'Metadata/Items/Gems/SupportGemLightningMastery' },
      { id: 'Metadata/Items/Gem/SupportGemHerDeclaration' },
      { id: 'Metadata/Items/Gem/SupportGemSeraphsHeart' },
    ],
  },
  {
    id: 'Metadata/Items/Gem/SkillGemElementalConflux',
    support_skills: [
      { id: 'Metadata/Items/Gems/SupportGemColdMastery' },
      { id: 'Metadata/Items/Gems/SupportGemFastForwardTwo' },
    ],
  },
]

const raw = await get(
  'https://poe.ninja/poe2/api/profile/characters/Enin9-6394/runesofaldur/Aenthan/model/92',
)
const cm = raw.charModel

const budgetLocal = 'Aenthan Tree Refit (123pt budget).build'
const budgetDocs = join(
  homedir(),
  'Documents',
  'My Games',
  'Path of Exile 2',
  'BuildPlanner',
  'Aenthan Tree Refit (123pt budget).build',
)
const passives = JSON.parse(fs.readFileSync(fs.existsSync(budgetLocal) ? budgetLocal : budgetDocs, 'utf8')).passives

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

const build = {
  name: 'Aenthan Best-with-Gear (skills+tree)',
  ascendancy: 'Druid1',
  passives,
  inventory_slots,
  skills,
}

const json = JSON.stringify(build, null, 2)
const name = 'Aenthan Best-with-Gear (skills+tree).build'
for (const p of [
  join(process.cwd(), name),
  join(homedir(), 'Downloads', name),
  join(homedir(), 'Documents', 'My Games', 'Path of Exile 2', 'BuildPlanner', name),
]) {
  fs.mkdirSync(join(p, '..'), { recursive: true })
  fs.writeFileSync(p, json)
  console.log('wrote', p)
}

const md = `# Aenthan — Best with YOUR gear (skills + tree)

Oracle 98 · CI · Ancestral Bond · ~11k ES · Mageblood · Whispering Ice · Victory Call  
Passive budget: **123 points** (legal planner file included)

Planner: \`Aenthan Best-with-Gear (skills+tree).build\`  
→ \`Documents\\\\My Games\\\\Path of Exile 2\\\\BuildPlanner\\\\\`

---

## Your identity (already correct)

You are already on the **Grim Pillars Spell Totem Oracle** archetype. Do not reroll class or keystones.

| Keep | Why |
|------|-----|
| Ancestral Bond + Unnamed Heartwood | Totem count / totems linger after death |
| Forced Outcome | Guaranteed crits — stop buying crit *chance* on tree |
| Chaos Inoculation | Your ES stack |
| Mageblood · Whispering Ice · high-spirit sceptre | Aspirational pieces already owned |
| Spell Totem → Grim Pillars + Urgent III + Vorana's + Rakiata's + Cold Mastery | This IS the endgame 6-link |

---

## Skills — what to socket

### Main clear/boss (KEEP as-is)
**Spell Totem** (level **14** for cost/limit breakpoint)  
→ **Grim Pillars** (max level) · **Urgent Totems III** · **Vorana's Siege** · **Rakiata's Flow** · **Cold Mastery**

Totems create pillars/ice crystals. Bond doubles limit; Heartwood keeps dead totems up ~6s.

### Detonator (small change)
**Entangle at level 1** (damage does not matter)

| Support | Why |
|---------|-----|
| **Mórrigan's Insight** (or Biting Frost) | Consumes freeze → **shatters ice crystals** (your real AoE) |
| Branching Fissures II | Coverage |
| Magnified Area II | Coverage |
| Rapid Casting II | Faster pops |
| **Efficiency II** | Prefer over Living Lightning if mana hurts; LL is only walking QoL |

### Mana Tempest (KEEP)
Advancing Storm · CD Recovery / Ingenuity · Efficiency · Lightning Mastery  
Cast when up — linger buffs totem hits + shock.

### Sceptre aura (KEEP)
**Purity of Lightning** + Her Declaration · Seraph's Heart · Mysticism II · Clarity II · Lightning Mastery  
Purity sceptres run these spirit supports **free**.

### Heart of Ice (KEEP)
Exposure package for rares/bosses.

### Whispering Ice staff (KEEP)
**Icestorm** + Cold Attunement · Freeze · Cold Mastery · Mag Area · Rapid Casting  
Weapon-set nuke while staff is out.

### Elemental Conflux
Compressed Duration + prefer **Fire Mastery** (levels Conflux) over Cold Mastery on this link.

### Strong optional (if sockets/spirit)
**Convalescence** (Second Wind · Prolonged Duration · CD Recovery) — your recharge recovery is ~0; this is the CI panic button.

---

## Tree — only legal swaps

Refund wasted **crit chance** under Forced Outcome:
- Calculated Hunter, Vulgar Methods, Controlling Magic, Sigil of Lightning, Relentless Vindicator

Spend the ~5 freed nodes on:
- **Erraticism** (~1)
- **Cold Nature** (~3)

**Do not** path to Snowpiercer / Pure Energy from here without a real respec — those are 7–19 nodes away.

Keep: totem clusters, Glaciation, Endless Blizzard, ES notables (Enhanced Barrier / Ancient Aegis / Illuminated Crown), Barbaric Strength (crit **multi**).

Weapon set 1 = sceptre/totems · Weapon set 2 = Whispering Ice / cast-speed cold.

---

## Atlas

poe.ninja does **not** export your atlas tree, so this is target priority only:

1. Map sustain / waystone economy  
2. Pack size + quantity (totems love dense screens for crystal detonations)  
3. Rarity (you already have high item rarity + Mageblood)  
4. CI: chaos map mods are easy; respect **ele damage / ES recovery / no regen** mods more  

Paste an atlas planner later for exact notables.

---

## Rotation

1. Auras/Conflux up  
2. Mana Tempest on CD  
3. Drop totems (4–6)  
4. Entangle to shatter crystals  
5. Heart of Ice on tanky targets  
6. Icestorm on Whispering Ice swap for burst  

---

Gear stays yours. Next *optional* chase only: Runeseeker's Call wand — not required for this plan.
`

fs.writeFileSync('Aenthan-Best-With-Gear.md', md)
console.log('guide ok', { passives: passives.length, skills: skills.length, items: inventory_slots.length })

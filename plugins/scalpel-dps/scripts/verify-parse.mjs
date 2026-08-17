/**
 * Quick parse/math sanity checks (plain JS, no build).
 * Run: node scripts/verify-parse.mjs
 */

function cleanModLine(line) {
  return line
    .replace(/\u00a0/g, ' ')
    .replace(/％/g, '%')
    .replace(/(-?\d+(?:\.\d+)?)\([-+]?\d+(?:\.\d+)?(?:-[-+]?\d+(?:\.\d+)?)?\)/g, '$1')
    .replace(/\s*[—–-]+\s*Unscalable Value$/i, '')
    .trim()
}

function sumMatches(lines, re) {
  let total = 0
  for (const line of lines) {
    const m = cleanModLine(line).match(re)
    if (m?.[1]) total += Number(m[1])
  }
  return total
}

function parseSpell(lines) {
  return {
    incSpellDamage: sumMatches(lines, /(\d+(?:\.\d+)?)%\s+increased\s+Spell\s+Damage(?!\s+per)/i),
    incCastSpeed: sumMatches(lines, /(\d+(?:\.\d+)?)%\s+increased\s+Cast\s+Speed/i),
    incAttackSpeed: sumMatches(lines, /(\d+(?:\.\d+)?)%\s+increased\s+Attack\s+Speed(?!\s+per)/i),
    incSpellCrit:
      sumMatches(lines, /(\d+(?:\.\d+)?)%\s+increased\s+Critical\s+Hit\s+Chance\s+for\s+Spells/i) +
      sumMatches(
        lines,
        /(\d+(?:\.\d+)?)%\s+increased\s+Critical\s+Strike\s+Chance\s+for\s+Spells/i,
      ),
    gainDamageAsExtra: sumMatches(
      lines,
      /Gain\s+(\d+(?:\.\d+)?)%\s+of\s+(?!Elemental\s)(?:Physical\s+)?Damage\s+as\s+Extra/i,
    ),
    gainEleAsExtra: sumMatches(
      lines,
      /Gain\s+(\d+(?:\.\d+)?)%\s+of\s+Elemental\s+Damage\s+as\s+Extra/i,
    ),
    spellSkillLevels:
      sumMatches(lines, /\+(\d+)\s+to\s+Level\s+of\s+all\s+Spell\s+Skills/i) +
      sumMatches(lines, /\+(\d+)\s+to\s+Level\s+of\s+Socketed\s+Spell\s+Gems/i) +
      sumMatches(lines, /\+(\d+)\s+to\s+Level\s+of\s+Socketed\s+Gems/i),
    coldSpellLevels:
      sumMatches(
        lines,
        /\+(\d+)\s+to\s+Level\s+of\s+all\s+(?:Cold|Fire|Lightning|Chaos)\s+Spell\s+Skills/i,
      ) +
      sumMatches(
        lines,
        /\+(\d+)\s+to\s+Level\s+of\s+Socketed\s+(?:Cold|Fire|Lightning|Chaos)\s+Gems/i,
      ),
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(cleanModLine('117(100-120)% increased Spell Damage') === '117% increased Spell Damage', 'clean')

const corpse = parseSpell([
  '+3 to Level of all Spell Skills',
  '117(110-120)% increased Spell Damage',
  'Gain 26(24-28)% of Damage as Extra Cold Damage',
  '+5 to Level of all Cold Spell Skills',
  '50(45-55)% increased Critical Hit Chance for Spells',
  '+1 to Level of all Spell Skills',
  '46(40-50)% increased Cast Speed',
  'Gain 11(8-12)% of Elemental Damage as Extra Cold Damage',
])
assert(corpse.incSpellDamage === 117, `spell ${corpse.incSpellDamage}`)
assert(corpse.incCastSpeed === 46, `cast ${corpse.incCastSpeed}`)
assert(corpse.incSpellCrit === 50, `crit ${corpse.incSpellCrit}`)
assert(corpse.gainDamageAsExtra === 26, `gain ${corpse.gainDamageAsExtra}`)
assert(corpse.gainEleAsExtra === 11, `ele ${corpse.gainEleAsExtra}`)
assert(corpse.spellSkillLevels === 4, `lv ${corpse.spellSkillLevels}`)
assert(corpse.coldSpellLevels === 5, `cold ${corpse.coldSpellLevels}`)

const tempest = parseSpell([
  'Gain 12% of Damage as Extra Cold Damage',
  '+1 to Level of all Spell Skills',
  'Gain 35(30-40)% of Damage as Extra Lightning Damage',
  '67(60-70)% increased Spell Damage',
  '+5 to Level of all Cold Spell Skills',
  'Gain 22(18-25)% of Damage as Extra Cold Damage',
  '54(50-60)% increased Critical Hit Chance for Spells',
  '35(30-40)% increased Cast Speed',
  'Gain 9(5-10)% of Elemental Damage as Extra Cold Damage',
])
assert(tempest.incSpellDamage === 67, `t spell`)
assert(tempest.incCastSpeed === 35, `t cast`)
assert(tempest.gainDamageAsExtra === 69, `t gain ${tempest.gainDamageAsExtra}`)
assert(tempest.gainEleAsExtra === 9, `t ele`)

// Math: Corpse Bane @ skill 1000, 1 cps, 10% crit, 150 multi
const base = 1000
const scaled = base * (1 + 117 / 100) // 2170
const hit = scaled * (1 + (26 + 11) / 100) // 2972.9
const aps = 1 * (1 + 46 / 100) // 1.46
const critChance = 10 * (1 + 50 / 100) // 15
const critFactor = 1 + (critChance / 100) * (150 / 100 - 1) // 1.075
const dps = hit * aps * critFactor
assert(dps > 4500 && dps < 4800, `dps ${dps}`)

console.log('verify-parse: ok')
console.log(`  Corpse Bane @ skill 1000 / 1 cps ≈ ${dps.toFixed(0)} DPS (was ~1050 with broken parse)`)
console.log(`  Tempest Call gains sum to ${tempest.gainDamageAsExtra}% + ${tempest.gainEleAsExtra}% ele`)

const poe1 = parseSpell([
  '+1 to Level of Socketed Gems',
  '+2 to Level of Socketed Spell Gems',
  '80% increased Spell Damage',
  '18% increased Cast Speed',
  '24% increased Critical Strike Chance for Spells',
  'Gain 14% of Physical Damage as Extra Fire Damage',
  '+1 to Level of Socketed Fire Gems',
])
assert(poe1.incSpellDamage === 80, `p1 spell ${poe1.incSpellDamage}`)
assert(poe1.incCastSpeed === 18, `p1 cast`)
assert(poe1.incSpellCrit === 24, `p1 crit ${poe1.incSpellCrit}`)
assert(poe1.gainDamageAsExtra === 14, `p1 gain ${poe1.gainDamageAsExtra}`)
assert(poe1.spellSkillLevels === 3, `p1 lv ${poe1.spellSkillLevels}`)
assert(poe1.coldSpellLevels === 1, `p1 fire gems ${poe1.coldSpellLevels}`)
console.log('  PoE1 socketed-gem / strike-chance parse ok')

const perInt = parseSpell([
  '109% increased Spell Damage',
  '1% increased Spell Damage per 16 Intelligence',
  '+38% to Global Critical Strike Multiplier',
  '1% increased Attack Speed per 8% Quality (enchant)',
])
assert(perInt.incSpellDamage === 109, `perInt spell ${perInt.incSpellDamage}`)

function enchantAS(line, quality) {
  const m = cleanModLine(line).match(
    /(\d+(?:\.\d+)?)%\s+increased\s+Attack\s+Speed\s+per\s+(\d+(?:\.\d+)?)%\s+Quality/i,
  )
  if (!m) return 0
  return Number(m[1]) * Math.floor(quality / Number(m[2]))
}
assert(enchantAS('1% increased Attack Speed per 8% Quality (enchant)', 20) === 2, 'enchant 20q')
assert(enchantAS('1% increased Attack Speed per 8% Quality (enchant)', 16) === 2, 'enchant 16q')
assert(enchantAS('1% increased Attack Speed per 8% Quality (enchant)', 8) === 1, 'enchant 8q')
assert(perInt.incAttackSpeed === 0, 'quality AS line not counted as flat AS')
const asWand = parseSpell(['8% increased Attack Speed', '19% increased Attack Speed'])
assert(asWand.incAttackSpeed === 27, `as ${asWand.incAttackSpeed}`)
console.log('  per-int spell dmg not double-counted; quality enchant evaluates')


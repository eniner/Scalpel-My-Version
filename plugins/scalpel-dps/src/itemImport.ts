import type { PoeItem } from '@scalpelpoe/plugin-sdk'
import { EMPTY_WEAPON, type WeaponStats } from './types'

const WEAPON_HINT =
  /sword|axe|mace|bow|crossbow|wand|staff|warstaff|sceptre|dagger|claw|spear|flail|quarterstaff|talon|club|hammer|rapier|foil|blade|polearm|gun|cannon|fishing/i

const CASTER_HINT = /wand|staff|warstaff|sceptre|focus|phylactery/i

const PROPERTY_PREFIXES = [
  'Item Class:',
  'Rarity:',
  'Quality:',
  'Sockets:',
  'Requires',
  'Item Level:',
  'Physical Damage:',
  'Elemental Damage:',
  'Fire Damage:',
  'Cold Damage:',
  'Lightning Damage:',
  'Chaos Damage:',
  'Attacks per Second:',
  'Critical Strike Chance:',
  'Critical Hit Chance:',
  'Weapon Range:',
  'Armour:',
  'Evasion Rating:',
  'Energy Shield:',
]

type SpellMods = Pick<
  WeaponStats,
  | 'incSpellDamage'
  | 'incCastSpeed'
  | 'incAttackSpeed'
  | 'incSpellCrit'
  | 'gainDamageAsExtra'
  | 'gainEleAsExtra'
  | 'spellSkillLevels'
  | 'coldSpellLevels'
  | 'extraCritMulti'
  | 'spellPerInt'
>

export function parseSpellModsFromLines(lines: string[]): SpellMods {
  let spellPerInt = 0
  for (const line of lines) {
    const m = cleanModLine(line).match(
      /(\d+(?:\.\d+)?)%\s+increased\s+Spell\s+Damage\s+per\s+(\d+)\s+Intelligence/i,
    )
    if (m && Number(m[2]) > 0) spellPerInt += Number(m[1]) / Number(m[2])
  }

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
    extraCritMulti:
      sumMatches(lines, /\+(\d+(?:\.\d+)?)%\s+to\s+(?:Global\s+)?Critical\s+Strike\s+Multiplier/i) +
      sumMatches(lines, /\+(\d+(?:\.\d+)?)%\s+to\s+(?:Global\s+)?Critical\s+Hit\s+Multiplier/i),
    spellPerInt,
  }
}

export function parseQuality(lines: string[]): number {
  return extractFloat(lines, 'Quality:') ?? 0
}

export function collectEnchants(lines: string[]): string[] {
  return lines
    .filter((l) => /\(enchant\)/i.test(l))
    .map((l) => cleanModLine(l).replace(/\s*\(enchant\)/i, ''))
}

export function enchantAttackSpeedFrom(enchants: string[], quality: number): number {
  let total = 0
  for (const line of enchants) {
    const m = cleanModLine(line).match(
      /(\d+(?:\.\d+)?)%\s+increased\s+Attack\s+Speed\s+per\s+(\d+(?:\.\d+)?)%\s+Quality/i,
    )
    if (m && Number(m[2]) > 0) total += Number(m[1]) * Math.floor(quality / Number(m[2]))
  }
  return total
}

/** Collapse PoE advanced rolls: "117(100-120)% …" → "117% …" */
export function cleanModLine(line: string): string {
  return line
    .replace(/\u00a0/g, ' ')
    .replace(/％/g, '%')
    .replace(/(-?\d+(?:\.\d+)?)\([-+]?\d+(?:\.\d+)?(?:-[-+]?\d+(?:\.\d+)?)?\)/g, '$1')
    .replace(/\s*[—–-]+\s*Unscalable Value$/i, '')
    .trim()
}

function flattenModLines(lines: string[]): string[] {
  const out: string[] = []
  for (const raw of lines) {
    for (const part of String(raw).split(/\r?\n/)) {
      const l = cleanModLine(part)
        .replace(/\s*\((?:implicit|enchant|crafted|fractured|desecrated|augmented)\)\s*$/i, '')
        .trim()
      if (!l || l.startsWith('{')) continue
      out.push(l)
    }
  }
  return out
}

function sumMatches(lines: string[], re: RegExp): number {
  let total = 0
  for (const line of flattenModLines(lines)) {
    const m = line.match(re)
    if (m?.[1]) total += Number(m[1])
  }
  return total
}

function extractFloat(lines: string[], prefix: string): number | undefined {
  const line = lines.find((l) => l.startsWith(prefix))
  if (!line) return undefined
  const m = cleanModLine(line).replace(/,/g, '').match(/(\d+(?:\.\d+)?)/)
  return m ? Number(m[1]) : undefined
}

function linesOf(item: PoeItem): string[] {
  return [
    ...(item.implicits ?? []),
    ...(item.explicits ?? []),
    ...(item.enchants ?? []),
    ...(item.runes ?? []),
    ...(item.imbues ?? []),
  ]
}

export function parseSpellMods(item: PoeItem): SpellMods {
  return parseSpellModsFromLines(linesOf(item))
}

function parseAttackFromLines(lines: string[]) {
  let physMin = 0
  let physMax = 0
  const physLine = lines.find((l) => l.startsWith('Physical Damage:'))
  if (physLine) {
    const m = cleanModLine(physLine).replace(/,/g, '').match(/(\d+)-(\d+)/)
    if (m) {
      physMin = parseInt(m[1], 10)
      physMax = parseInt(m[2], 10)
    }
  }

  let eleAvg = 0
  for (const line of lines) {
    if (
      line.startsWith('Elemental Damage:') ||
      line.startsWith('Fire Damage:') ||
      line.startsWith('Cold Damage:') ||
      line.startsWith('Lightning Damage:')
    ) {
      for (const m of cleanModLine(line).replace(/,/g, '').matchAll(/(\d+)-(\d+)/g)) {
        eleAvg += (parseInt(m[1], 10) + parseInt(m[2], 10)) / 2
      }
    }
  }

  let chaosAvg = 0
  const chaosLine = lines.find((l) => l.startsWith('Chaos Damage:'))
  if (chaosLine) {
    const m = cleanModLine(chaosLine).replace(/,/g, '').match(/(\d+)-(\d+)/)
    if (m) chaosAvg = (parseInt(m[1], 10) + parseInt(m[2], 10)) / 2
  }

  return {
    physMin,
    physMax,
    eleAvg,
    chaosAvg,
    aps: extractFloat(lines, 'Attacks per Second:') ?? 1,
    critChance:
      extractFloat(lines, 'Critical Hit Chance:') ??
      extractFloat(lines, 'Critical Strike Chance:') ??
      5,
  }
}

function headerMeta(lines: string[]) {
  const itemClassLine = lines.find((l) => l.startsWith('Item Class:'))
  const rarityLine = lines.find((l) => l.startsWith('Rarity:'))
  if (!itemClassLine || !rarityLine) return null

  const itemClass = itemClassLine.replace('Item Class:', '').trim()
  const rarity = rarityLine.replace('Rarity:', '').trim()
  const rarityIdx = lines.indexOf(rarityLine)
  const after = lines.slice(rarityIdx + 1).filter((l) => !l.startsWith('You cannot use this item'))
  const name = after[0] ?? ''
  const baseType = rarity === 'Rare' || rarity === 'Unique' ? (after[1] ?? name) : name
  return { itemClass, rarity, name, baseType }
}

/** Split clipboard dump into implicit / explicit-ish display lines. */
function splitClipboardMods(text: string): {
  implicits: string[]
  explicits: string[]
  enchants: string[]
} {
  const sections = text.split('--------').map((s) => s.trim()).filter(Boolean)
  if (sections.length < 2) return { implicits: [], explicits: [], enchants: [] }

  const isModLine = (l: string) =>
    /[+-]?\d/.test(l) &&
    !PROPERTY_PREFIXES.some((p) => l.startsWith(p)) &&
    !l.startsWith('--------')

  const enchants = collectEnchants(
    text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean),
  )

  const modSections = sections
    .slice(1)
    .map((s) =>
      s
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && isModLine(l) && !/\(enchant\)/i.test(l))
        .map(cleanModLine),
    )
    .filter((arr) => arr.length > 0)

  if (modSections.length === 0) return { implicits: [], explicits: [], enchants }
  if (modSections.length === 1) return { implicits: [], explicits: modSections[0], enchants }
  return {
    implicits: modSections[0],
    explicits: modSections.slice(1).flat(),
    enchants,
  }
}

function buildWeapon(opts: {
  label: string
  rarity: string
  baseType: string
  itemClass: string
  implicits: string[]
  explicits: string[]
  enchants: string[]
  quality: number
  attack: ReturnType<typeof parseAttackFromLines>
  spell: SpellMods
}): WeaponStats {
  const blob = `${opts.itemClass} ${opts.baseType} ${opts.label}`
  const hasAttack =
    opts.attack.physMin > 0 ||
    opts.attack.physMax > 0 ||
    opts.attack.eleAvg > 0 ||
    opts.attack.chaosAvg > 0
  const preferSpell =
    !hasAttack &&
    (CASTER_HINT.test(blob) ||
      opts.spell.incSpellDamage > 0 ||
      opts.spell.incCastSpeed > 0 ||
      opts.spell.gainDamageAsExtra > 0 ||
      opts.spell.spellSkillLevels > 0)

  return {
    ...EMPTY_WEAPON,
    label: opts.label,
    rarity: opts.rarity || 'Normal',
    baseType: opts.baseType,
    itemClass: opts.itemClass,
    implicits: opts.implicits.map(cleanModLine),
    explicits: opts.explicits.map(cleanModLine),
    enchants: opts.enchants.map(cleanModLine),
    quality: opts.quality,
    enchantAttackSpeed: enchantAttackSpeedFrom(opts.enchants, opts.quality),
    mode: preferSpell ? 'spell' : 'attack',
    ...opts.attack,
    ...opts.spell,
  }
}

export function weaponFromClipboardText(text: string): WeaponStats | null {
  if (!text?.includes('--------') || !text.includes('Item Class:')) return null
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const header = headerMeta(lines)
  if (!header) return null

  const { implicits, explicits, enchants } = splitClipboardMods(text)
  const allMods = [...enchants, ...implicits, ...explicits]
  const quality = parseQuality(lines)
  const weapon = buildWeapon({
    label: (header.name || header.baseType || header.itemClass).trim(),
    rarity: header.rarity,
    baseType: header.baseType,
    itemClass: header.itemClass,
    implicits,
    explicits,
    enchants,
    quality,
    attack: parseAttackFromLines(lines),
    spell: parseSpellModsFromLines(allMods.length ? allMods : lines),
  })

  const blob = `${header.itemClass} ${header.baseType} ${header.name}`
  if (!isLikelyWeaponStats(weapon, blob)) return null
  return weapon
}

export async function readClipboardText(): Promise<string> {
  try {
    const t = await navigator.clipboard.readText()
    if (t.trim()) return t
  } catch {
    /* overlay often blocks the Clipboard API — try paste fallback */
  }
  return new Promise((resolve) => {
    const ta = document.createElement('textarea')
    ta.setAttribute('readonly', 'false')
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    let text = ''
    try {
      document.execCommand('paste')
      text = ta.value
    } catch {
      text = ''
    }
    ta.remove()
    resolve(text)
  })
}

export async function readWeaponFromOsClipboard(): Promise<
  { ok: true; weapon: WeaponStats; text: string } | { ok: false; reason: string }
> {
  const text = await readClipboardText()
  if (!text.trim()) {
    return {
      ok: false,
      reason: 'Clipboard empty — hover the item in PoE (game focused) and Ctrl+C.',
    }
  }
  const weapon = weaponFromClipboardText(text)
  if (!weapon) {
    return { ok: false, reason: 'Clipboard is not a PoE weapon (Ctrl+C the hovered item in-game).' }
  }
  return { ok: true, weapon, text }
}

export function weaponKey(w: WeaponStats): string {
  return [
    w.label,
    w.baseType,
    w.rarity,
    w.physMin,
    w.physMax,
    w.eleAvg,
    w.chaosAvg,
    w.aps,
    w.incSpellDamage,
    w.incCastSpeed,
    w.incSpellCrit,
    w.gainDamageAsExtra,
    w.gainEleAsExtra,
    w.spellSkillLevels,
    w.coldSpellLevels,
    ...w.implicits,
    ...w.explicits,
  ].join('\n')
}

export function isBlankSlot(w: WeaponStats): boolean {
  return !w.label || w.label.startsWith('Weapon ')
}

function isLikelyWeaponStats(weapon: WeaponStats, blob: string): boolean {
  if (weapon.physMin > 0 || weapon.physMax > 0 || weapon.eleAvg > 0 || weapon.chaosAvg > 0) {
    return true
  }
  if (WEAPON_HINT.test(blob) || CASTER_HINT.test(blob)) return true
  return (
    weapon.incSpellDamage > 0 ||
    weapon.incCastSpeed > 0 ||
    weapon.spellSkillLevels > 0 ||
    weapon.gainDamageAsExtra > 0
  )
}

export function isLikelyWeapon(item: PoeItem): boolean {
  if ((item.physDamageMin ?? 0) > 0 || (item.physDamageMax ?? 0) > 0) return true
  if ((item.eleDamageAvg ?? 0) > 0 || (item.chaosDamageAvg ?? 0) > 0) return true
  if ((item.attacksPerSecond ?? 0) > 0) return true
  const blob = `${item.itemClass} ${item.baseType} ${item.name}`
  if (WEAPON_HINT.test(blob)) return true
  const spell = parseSpellMods(item)
  return (
    spell.incSpellDamage > 0 ||
    spell.incCastSpeed > 0 ||
    spell.spellSkillLevels > 0 ||
    spell.gainDamageAsExtra > 0
  )
}

export function weaponFromItem(item: PoeItem): WeaponStats {
  const enchants = (item.enchants ?? []).map((l) => cleanModLine(l).replace(/\s*\(enchant\)/i, ''))
  const implicits = (item.implicits ?? []).map(cleanModLine)
  const explicits = [...(item.runes ?? []), ...(item.explicits ?? [])].map(cleanModLine)
  const quality = item.quality ?? 0

  return buildWeapon({
    label: (item.name || item.baseType || item.itemClass || 'Weapon').trim(),
    rarity: String(item.rarity || 'Normal'),
    baseType: item.baseType || '',
    itemClass: item.itemClass || '',
    implicits,
    explicits,
    enchants,
    quality,
    attack: {
      physMin: item.physDamageMin ?? 0,
      physMax: item.physDamageMax ?? 0,
      eleAvg: item.eleDamageAvg ?? 0,
      chaosAvg: item.chaosDamageAvg ?? 0,
      aps: item.attacksPerSecond && item.attacksPerSecond > 0 ? item.attacksPerSecond : 1,
      critChance: item.critChance && item.critChance > 0 ? item.critChance : 5,
    },
    spell: parseSpellMods(item),
  })
}

export function importSummary(weapon: WeaponStats): string {
  if (weapon.mode === 'spell') {
    const bits = [
      weapon.incSpellDamage ? `+${weapon.incSpellDamage}% spell` : null,
      weapon.incCastSpeed ? `+${weapon.incCastSpeed}% cast` : null,
      weapon.incAttackSpeed ? `+${weapon.incAttackSpeed}% AS` : null,
      weapon.incSpellCrit ? `+${weapon.incSpellCrit}% spell crit` : null,
      weapon.gainDamageAsExtra ? `+${weapon.gainDamageAsExtra}% as extra` : null,
      weapon.gainEleAsExtra ? `+${weapon.gainEleAsExtra}% ele as extra` : null,
      weapon.spellSkillLevels ? `+${weapon.spellSkillLevels} spell lv` : null,
      weapon.extraCritMulti ? `+${weapon.extraCritMulti}% crit multi` : null,
      weapon.spellPerInt ? `spell/int` : null,
      weapon.enchantAttackSpeed ? `enchant +${weapon.enchantAttackSpeed}% AS` : null,
    ].filter(Boolean)
    return bits.length ? bits.join(', ') : 'spell weapon'
  }
  return `${formatAvg(weapon)} avg @ ${weapon.aps} APS`
}

function formatAvg(w: WeaponStats): string {
  const phys = (w.physMin + w.physMax) / 2
  return String(phys || w.eleAvg || 0)
}

export function refreshParsedStats(weapon: WeaponStats): WeaponStats {
  const lines = [
    ...(weapon.enchants ?? []),
    ...(weapon.implicits ?? []),
    ...(weapon.explicits ?? []),
  ]
  const spell = parseSpellModsFromLines(lines)
  const hasQualityEnchant = flattenModLines(lines).some((l) =>
    /Attack\s+Speed\s+per\s+\d+(?:\.\d+)?%\s+Quality/i.test(l),
  )
  const quality = weapon.quality > 0 ? weapon.quality : hasQualityEnchant ? 20 : 0
  const enchants =
    (weapon.enchants ?? []).length > 0
      ? weapon.enchants
      : flattenModLines(lines).filter((l) => /per\s+\d+(?:\.\d+)?%\s+Quality/i.test(l))
  return {
    ...weapon,
    ...spell,
    quality,
    enchants,
    enchantAttackSpeed: enchantAttackSpeedFrom(enchants, quality),
  }
}

export function blankWeapon(slot: 'A' | 'B'): WeaponStats {
  return { ...EMPTY_WEAPON, label: `Weapon ${slot}`, implicits: [], explicits: [], enchants: [] }
}

export function rarityClass(rarity: string): string {
  const r = rarity.toLowerCase()
  if (r === 'unique') return 'unique'
  if (r === 'rare') return 'rare'
  if (r === 'magic') return 'magic'
  return 'normal'
}

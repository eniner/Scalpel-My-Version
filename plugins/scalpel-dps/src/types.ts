/** Weapon + character inputs for the DPS engine. */

export type CalcMode = 'attack' | 'spell'

export type WeaponStats = {
  label: string
  mode: CalcMode
  rarity: string
  baseType: string
  itemClass: string
  /** Raw mod lines for PoB-style tooltip display. */
  implicits: string[]
  explicits: string[]
  enchants: string[]
  quality: number
  physMin: number
  physMax: number
  eleAvg: number
  chaosAvg: number
  aps: number
  critChance: number
  incSpellDamage: number
  incCastSpeed: number
  incAttackSpeed: number
  incSpellCrit: number
  gainDamageAsExtra: number
  gainEleAsExtra: number
  spellSkillLevels: number
  coldSpellLevels: number
  /** Sum of +% Global Critical Strike/Hit Multiplier on the item. */
  extraCritMulti: number
  /** % increased Spell Damage per 1 Intelligence (e.g. 1% per 16 Int → 1/16). */
  spellPerInt: number
  /** Attack speed % from quality-scaling enchants (evaluated). */
  enchantAttackSpeed: number
}

export type GlobalMods = {
  flatPhys: number
  flatEle: number
  flatChaos: number
  increasedPhys: number
  increasedEle: number
  increasedChaos: number
  increasedAttackSpeed: number
  increasedCritChance: number
  critMulti: number
  moreDamage: number
  moreAttackSpeed: number
  enemyResist: number
  skillHitAvg: number
  skillCastsPerSec: number
  skillCritChance: number
  increasedSpell: number
  increasedCastSpeed: number
  moreSpell: number
  moreCastSpeed: number
  approxMorePerSpellLevel: number
  /** Used for "X% increased Spell Damage per Y Intelligence". */
  characterInt: number
}

export type HitBreakdown = {
  mode: CalcMode
  physHit: number
  eleHit: number
  chaosHit: number
  avgHit: number
  aps: number
  critChance: number
  critFactor: number
  pdps: number
  edps: number
  cdps: number
  totalDps: number
  extraHit: number
}

export const EMPTY_WEAPON: WeaponStats = {
  label: '',
  mode: 'attack',
  rarity: 'Normal',
  baseType: '',
  itemClass: '',
  implicits: [],
  explicits: [],
  enchants: [],
  quality: 0,
  physMin: 0,
  physMax: 0,
  eleAvg: 0,
  chaosAvg: 0,
  aps: 1.0,
  critChance: 5,
  incSpellDamage: 0,
  incCastSpeed: 0,
  incAttackSpeed: 0,
  incSpellCrit: 0,
  gainDamageAsExtra: 0,
  gainEleAsExtra: 0,
  spellSkillLevels: 0,
  coldSpellLevels: 0,
  extraCritMulti: 0,
  spellPerInt: 0,
  enchantAttackSpeed: 0,
}

export const DEFAULT_GLOBALS: GlobalMods = {
  flatPhys: 0,
  flatEle: 0,
  flatChaos: 0,
  increasedPhys: 0,
  increasedEle: 0,
  increasedChaos: 0,
  increasedAttackSpeed: 0,
  increasedCritChance: 0,
  critMulti: 150,
  moreDamage: 0,
  moreAttackSpeed: 0,
  enemyResist: 0,
  skillHitAvg: 1000,
  skillCastsPerSec: 1.0,
  skillCritChance: 10,
  increasedSpell: 0,
  increasedCastSpeed: 0,
  moreSpell: 0,
  moreCastSpeed: 0,
  approxMorePerSpellLevel: 0,
  characterInt: 0,
}

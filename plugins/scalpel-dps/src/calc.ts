/**
 * Attack + spell DPS pipelines for PoE1 and PoE2 (independent implementation).
 *
 * Attack: (base+flat) × (1+inc%) × (1+more%) × (1+gainAsExtra%) × APS × critFactor
 * Spell:  skillHit × (1+incSpell%) × (1+more%) × (1+gainAsExtra%) × CPS × critFactor
 */

import { refreshParsedStats } from './itemImport'
import type { GlobalMods, HitBreakdown, WeaponStats } from './types'

function moreFactor(morePercent: number): number {
  return 1 + morePercent / 100
}

function increasedFactor(increasedPercent: number): number {
  return 1 + increasedPercent / 100
}

function resistFactor(enemyResistPercent: number): number {
  return 1 - enemyResistPercent / 100
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

function emptyBreakdown(mode: HitBreakdown['mode']): HitBreakdown {
  return {
    mode,
    physHit: 0,
    eleHit: 0,
    chaosHit: 0,
    avgHit: 0,
    aps: 0,
    critChance: 0,
    critFactor: 1,
    pdps: 0,
    edps: 0,
    cdps: 0,
    totalDps: 0,
    extraHit: 0,
  }
}

export function computeAttack(weapon: WeaponStats, g: GlobalMods): HitBreakdown {
  const physBase = (weapon.physMin + weapon.physMax) / 2 + g.flatPhys
  const eleBase = weapon.eleAvg + g.flatEle
  const chaosBase = weapon.chaosAvg + g.flatChaos

  const moreDmg = moreFactor(g.moreDamage)

  const physHit = Math.max(0, physBase) * increasedFactor(g.increasedPhys) * moreDmg
  const eleHit =
    Math.max(0, eleBase) * increasedFactor(g.increasedEle) * moreDmg * resistFactor(g.enemyResist)
  const chaosHit =
    Math.max(0, chaosBase) *
    increasedFactor(g.increasedChaos) *
    moreDmg *
    resistFactor(g.enemyResist)

  const extraHit =
    (physHit + eleHit + chaosHit) * ((weapon.gainDamageAsExtra + weapon.gainEleAsExtra) / 100)
  const avgHit = physHit + eleHit + chaosHit + extraHit

  const aps = Math.max(
    0,
    weapon.aps * increasedFactor(g.increasedAttackSpeed) * moreFactor(g.moreAttackSpeed),
  )

  const critChance = clamp(weapon.critChance * increasedFactor(g.increasedCritChance), 0, 100)
  const critMulti = g.critMulti + weapon.extraCritMulti
  const critFactor = 1 + (critChance / 100) * (critMulti / 100 - 1)

  const pdps = physHit * aps * critFactor
  const edps = eleHit * aps * critFactor
  const cdps = chaosHit * aps * critFactor
  const extraDps = extraHit * aps * critFactor

  return {
    mode: 'attack',
    physHit,
    eleHit,
    chaosHit,
    avgHit,
    aps,
    critChance,
    critFactor,
    pdps,
    edps,
    cdps,
    totalDps: pdps + edps + cdps + extraDps,
    extraHit,
  }
}

/**
 * Spell contribution from a caster weapon + shared skill baseline.
 *
 * gainAsExtra is modeled as a multiplicative add-on after increased/more
 * (wand A/B compare; not full conversion).
 * Skill levels only apply when globals.approxMorePerSpellLevel > 0.
 */
export function computeSpell(
  weapon: WeaponStats,
  g: GlobalMods,
  poe: 1 | 2 = 2,
): HitBreakdown {
  const base = Math.max(0, g.skillHitAvg + g.flatEle)
  if (base <= 0) return emptyBreakdown('spell')

  const inc = g.increasedSpell + weapon.incSpellDamage + g.characterInt * weapon.spellPerInt
  const levelMore =
    (weapon.spellSkillLevels + weapon.coldSpellLevels) * g.approxMorePerSpellLevel

  const scaled =
    base * increasedFactor(inc) * moreFactor(g.moreSpell + g.moreDamage) * moreFactor(levelMore)

  const gainPct = weapon.gainDamageAsExtra + weapon.gainEleAsExtra
  const extraHit = scaled * (gainPct / 100)
  const hit = (scaled + extraHit) * resistFactor(g.enemyResist)

  // PoE1 wand compare: local attack speed (and quality AS enchant) counts as cast speed.
  const asAsCast =
    poe === 1 ? weapon.incAttackSpeed + weapon.enchantAttackSpeed : 0

  const aps = Math.max(
    0,
    g.skillCastsPerSec *
      increasedFactor(g.increasedCastSpeed + weapon.incCastSpeed + asAsCast) *
      moreFactor(g.moreCastSpeed + g.moreAttackSpeed),
  )

  const critChance = clamp(
    g.skillCritChance * increasedFactor(g.increasedCritChance + weapon.incSpellCrit),
    0,
    100,
  )
  const critMulti = g.critMulti + weapon.extraCritMulti
  const critFactor = 1 + (critChance / 100) * (critMulti / 100 - 1)

  const totalDps = hit * aps * critFactor
  const coreHit = scaled * resistFactor(g.enemyResist)
  const extraAfterResist = extraHit * resistFactor(g.enemyResist)

  return {
    mode: 'spell',
    physHit: 0,
    eleHit: coreHit,
    chaosHit: 0,
    avgHit: hit,
    aps,
    critChance,
    critFactor,
    pdps: 0,
    edps: coreHit * aps * critFactor,
    cdps: 0,
    totalDps,
    extraHit: extraAfterResist,
  }
}

export function computeHit(weapon: WeaponStats, g: GlobalMods, poe: 1 | 2 = 2): HitBreakdown {
  const w = refreshParsedStats(weapon)
  return w.mode === 'spell' ? computeSpell(w, g, poe) : computeAttack(w, g)
}

export function formatDps(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`
  if (n >= 100) return n.toFixed(0)
  return n.toFixed(1)
}

export function formatPctDelta(a: number, b: number): string {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0) return '—'
  const d = ((b - a) / a) * 100
  const sign = d > 0 ? '+' : ''
  return `${sign}${d.toFixed(1)}%`
}

export function hasAttackDamage(weapon: WeaponStats): boolean {
  return (
    weapon.physMin > 0 || weapon.physMax > 0 || weapon.eleAvg > 0 || weapon.chaosAvg > 0
  )
}

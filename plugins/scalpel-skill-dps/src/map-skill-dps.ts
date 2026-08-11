export type FlatDamage = {
  type: string
  average: number
  totalMin: number
  totalMax: number
}

export type SkillDpsEntry = {
  name: string
  /** Skill / gem icon URL (poe CDN), when present on the ninja model. */
  iconUrl: string | null
  /** Total DPS (avg damage × rate when rate applies). */
  dps: number
  /** Average damage per use — matches ninja's big "Average Damage" number. */
  averageDamage: number
  rate: number
  rateKind: number
  critChance: number
  critMultiplier: number
  hitChance: number
  duration: number | null
  aoeRadius: number | null
  cooldown: number | null
  flat: FlatDamage[]
  supportGems: string[]
  /** Support gem icons aligned with supportGems (null when missing). */
  supportIconUrls: Array<string | null>
  mainGems: string[]
}

export type DefensiveStrip = {
  life: number | null
  energyShield: number | null
  mana: number | null
  spirit: number | null
  level: number | null
  className: string | null
  /** Class portrait as used on poe.ninja (`assets.poe.ninja/poe2/classes/…`). */
  classIconUrl: string | null
  account: string | null
  name: string | null
  league: string | null
}

export type MappedCharacter = {
  defenses: DefensiveStrip
  skills: SkillDpsEntry[]
}

type RawFlat = {
  type?: string
  average?: number
  totalMin?: number
  totalMax?: number
}

type RawDps = {
  name?: string
  dps?: number
  damage?: number[]
  rate?: number
  rateKind?: number
  critChance?: number
  critMultiplier?: number
  hitChance?: number
  duration?: number
  aoeRadius?: number
  cooldown?: number
  offensive?: { flat?: RawFlat[] }
}

type RawGem = {
  name?: string
  itemData?: {
    icon?: string
    gemSkill?: string
  }
}

type RawSkill = {
  allGems?: RawGem[]
  dps?: RawDps[]
}

type RawCharModel = {
  account?: string
  name?: string
  league?: string
  level?: number
  class?: string
  defensiveStats?: {
    life?: number
    energyShield?: number
    mana?: number
    spirit?: number
  }
  skills?: RawSkill[]
}

const NINJA_CLASS_ICON_BASE = 'https://assets.poe.ninja/poe2/classes'

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** poe.ninja class portraits: lowercase, spaces → hyphens (`Blood Mage` → `blood-mage`). */
export function ninjaClassIconUrl(className: string | null | undefined): string | null {
  if (!className || typeof className !== 'string') return null
  const slug = className
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug ? `${NINJA_CLASS_ICON_BASE}/${slug}.webp` : null
}

function gemIconUrl(gem: RawGem | undefined): string | null {
  if (!gem?.itemData) return null
  const icon = typeof gem.itemData.icon === 'string' ? gem.itemData.icon : null
  const skill = typeof gem.itemData.gemSkill === 'string' ? gem.itemData.gemSkill : null
  // Match ninja skill rows (gem item art), but BlankGem is useless — prefer skill art.
  if (icon && !/BlankGem/i.test(icon)) return icon
  return skill ?? icon
}

/** Map ninja charModel → skill DPS rows (skills with empty dps omitted, like the UI). */
export function mapCharacterModel(charModel: unknown): MappedCharacter {
  const cm = (charModel ?? {}) as RawCharModel
  const className = typeof cm.class === 'string' ? cm.class : null
  const defenses: DefensiveStrip = {
    life: num(cm.defensiveStats?.life),
    energyShield: num(cm.defensiveStats?.energyShield),
    mana: num(cm.defensiveStats?.mana),
    spirit: num(cm.defensiveStats?.spirit),
    level: num(cm.level),
    className,
    classIconUrl: ninjaClassIconUrl(className),
    account: typeof cm.account === 'string' ? cm.account : null,
    name: typeof cm.name === 'string' ? cm.name : null,
    league: typeof cm.league === 'string' ? cm.league : null,
  }

  const skills: SkillDpsEntry[] = []
  for (const skill of cm.skills ?? []) {
    const rawGems = skill.allGems ?? []
    const gems = rawGems.map((g) => g.name).filter((n): n is string => Boolean(n))
    const dpsList = Array.isArray(skill.dps) ? skill.dps : []
    for (const d of dpsList) {
      if (!d || typeof d !== 'object') continue
      const name = typeof d.name === 'string' && d.name ? d.name : gems[0] ?? 'Unknown'
      const matched = rawGems.find((g) => g.name === name) ?? rawGems[0]
      const averageDamage = Array.isArray(d.damage) && typeof d.damage[0] === 'number' ? d.damage[0] : 0
      const flat: FlatDamage[] = []
      for (const f of d.offensive?.flat ?? []) {
        if (!f?.type || typeof f.average !== 'number') continue
        flat.push({
          type: f.type,
          average: f.average,
          totalMin: typeof f.totalMin === 'number' ? f.totalMin : 0,
          totalMax: typeof f.totalMax === 'number' ? f.totalMax : 0,
        })
      }
      const supportRaw = rawGems.slice(1)
      skills.push({
        name,
        iconUrl: gemIconUrl(matched),
        dps: typeof d.dps === 'number' ? d.dps : 0,
        averageDamage,
        rate: typeof d.rate === 'number' ? d.rate : 0,
        rateKind: typeof d.rateKind === 'number' ? d.rateKind : 0,
        critChance: typeof d.critChance === 'number' ? d.critChance : 0,
        critMultiplier: typeof d.critMultiplier === 'number' ? d.critMultiplier : 0,
        hitChance: typeof d.hitChance === 'number' ? d.hitChance : 0,
        duration: num(d.duration),
        aoeRadius: num(d.aoeRadius),
        cooldown: num(d.cooldown),
        flat,
        mainGems: gems.slice(0, 1),
        supportGems: gems.slice(1),
        supportIconUrls: supportRaw.map((g) => gemIconUrl(g)),
      })
    }
  }

  skills.sort((a, b) => b.averageDamage - a.averageDamage)
  return { defenses, skills }
}

/** Compact ninja-style number (84k, 1.2k, 283k). */
export function formatCompact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`
  if (abs >= 1000) {
    const k = n / 1000
    if (abs >= 100_000) return `${Math.round(k)}k`
    if (abs >= 10_000) return `${k.toFixed(0)}k`
    return `${k.toFixed(1).replace(/\.0$/, '')}k`
  }
  if (abs >= 100) return String(Math.round(n))
  if (abs >= 10) return n.toFixed(1).replace(/\.0$/, '')
  return n.toFixed(2).replace(/\.?0+$/, '') || '0'
}

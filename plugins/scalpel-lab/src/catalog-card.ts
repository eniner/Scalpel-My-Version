import type { CoeCatalogItemResult } from '@scalpelpoe/plugin-sdk'

/** CoE-style base card stat lines (quality-scaled defences). */
export function catalogItemCardLines(item: CoeCatalogItemResult, quality = 20): string[] {
  const lines: string[] = [`Quality: ${quality}%`]
  const p = item.props
  const q = 1 + quality / 100
  const scale = (v: number) => Math.round(v * q)
  if (p.armour != null) lines.push(`Armour: ${scale(Number(p.armour))}`)
  if (p.evasion != null) lines.push(`Evasion: ${scale(Number(p.evasion))}`)
  if (p.energyshield != null || p.energy_shield != null) {
    lines.push(`Energy Shield: ${scale(Number(p.energyshield ?? p.energy_shield))}`)
  }
  if (p.ward != null) lines.push(`Ward: ${scale(Number(p.ward))}`)
  if (p.block != null) lines.push(`Block: ${p.block}`)
  if (p.crit != null) lines.push(`Critical Strike Chance: ${p.crit}%`)
  if (p.aps != null) lines.push(`Attacks per Second: ${p.aps}`)
  if (p.damage_min != null && p.damage_max != null) {
    lines.push(`Physical Damage: ${scale(Number(p.damage_min))}-${scale(Number(p.damage_max))}`)
  }
  const lvl = item.requirements.level ?? item.dropLevel
  if (lvl != null) lines.push(`Requires Level ${lvl}`)
  for (const imp of item.implicits) lines.push(imp)
  return lines
}

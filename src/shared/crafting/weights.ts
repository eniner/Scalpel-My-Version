import type { CraftMod } from './types'

export function modBindGroups(mod: CraftMod): string[] {
  return mod.bg?.length ? mod.bg : [mod.g]
}

export function isGroupBlocked(mod: CraftMod, blockedGroups: Set<string>): boolean {
  return modBindGroups(mod).some((g) => blockedGroups.has(g))
}

export function spawnWeight(mod: CraftMod, tags: Set<string>, baseType?: string): number {
  if (mod.pool === 'marksman') {
    if (!tags.has('can_roll_marksman')) return 0
    for (const [tag, weight] of mod.w) {
      if (tag === '__marksman__') return weight
    }
    return 0
  }
  if (baseType) {
    for (const [tag, weight] of mod.w) {
      if (tag === baseType) {
        let w = weight
        if (mod.gw) {
          for (const [gtag, mult] of mod.gw) {
            if (tags.has(gtag)) {
              w = Math.floor((w * mult) / 100)
              break
            }
          }
        }
        return w
      }
    }
  }
  for (const [tag, weight] of mod.w) {
    if (tags.has(tag)) {
      let w = weight
      if (mod.gw) {
        for (const [gtag, mult] of mod.gw) {
          if (tags.has(gtag)) {
            w = Math.floor((w * mult) / 100)
            break
          }
        }
      }
      return w
    }
  }
  return 0
}

export function pickWeighted<T extends { weight: number }>(items: T[], rng: () => number): T | null {
  let total = 0
  for (const it of items) total += it.weight
  if (total <= 0) return null
  let roll = rng() * total
  for (const it of items) {
    roll -= it.weight
    if (roll <= 0) return it
  }
  return items[items.length - 1] ?? null
}

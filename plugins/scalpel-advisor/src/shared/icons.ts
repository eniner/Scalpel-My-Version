import { defaultPoeItem, getItemIcon } from '@scalpelpoe/plugin-sdk'
import type { PriceEntry } from '@scalpelpoe/plugin-sdk'
import bundledPoe1 from '../data/item-icons-poe1.json'

/** Scalpel's PoE1 sheet — used when the host hasn't published __scalpel.iconMap
 *  yet and price rows arrive without `icon` (older hosts / race on overlay open). */
const BUNDLED: Record<string, string> = bundledPoe1 as Record<string, string>

/** Lowercased index of the bundled sheet for Of/of mismatch tolerance. */
const BUNDLED_LOWER = (() => {
  const m = new Map<string, string>()
  for (const [k, v] of Object.entries(BUNDLED)) m.set(k.toLowerCase(), v)
  return m
})()

/** Build name → icon URL from a price snapshot (covers items missing from iconMap). */
export function indexPriceIcons(entries: PriceEntry[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const e of entries) {
    const icon = e.icon ?? lookupBundledIcon(e.name)
    if (!icon) continue
    map.set(e.name, icon)
    map.set(e.name.toLowerCase(), icon)
    for (const v of nameVariants(e.name)) {
      if (!map.has(v)) map.set(v, icon)
      const low = v.toLowerCase()
      if (!map.has(low)) map.set(low, icon)
    }
  }
  return map
}

export type IconResolveOpts = {
  /** Prefer this base type (e.g. gem trade mapping `type`). */
  baseType?: string | null
  /** Extra lookups from ctx.prices icons. */
  priceIcons?: Map<string, string>
  /** Alternate names to try (priceId title case, unique keys, …). */
  aliases?: string[]
}

/**
 * Expand Title-Case artifacts ("Scarab Of X") into PoE iconMap keys ("Scarab of X").
 * Mid-string Of/The/And/A/An are lowercased — matches bundled item-icons-poe1 keys.
 */
export function nameVariants(name: string): string[] {
  if (!name) return []
  const out: string[] = [name]
  const soft = name.replace(/(?<=\S\s)(Of|The|And|A|An)\b/g, (m) => m.toLowerCase())
  if (soft !== name) out.push(soft)
  return out
}

export function lookupBundledIcon(name: string): string | null {
  if (!name) return null
  for (const v of nameVariants(name)) {
    const hit = BUNDLED[v] ?? BUNDLED_LOWER.get(v.toLowerCase())
    if (hit) return hit
  }
  return null
}

/**
 * Resolve a PoE item icon URL using Scalpel's global iconMap (via getItemIcon),
 * then price-feed icons, then the bundled PoE1 sheet shipped with Advisor.
 */
export function resolveItemIcon(name: string, opts: IconResolveOpts = {}): string | null {
  if (!name) return null

  const tryNames: string[] = []
  const push = (n: string | null | undefined) => {
    if (!n) return
    for (const v of nameVariants(n)) {
      if (!tryNames.includes(v)) tryNames.push(v)
    }
  }

  push(name)
  for (const a of opts.aliases ?? []) push(a)
  if (opts.baseType) push(opts.baseType)

  // Transfigured gems: "Skill of Foo" → also try base "Skill"
  const ofIdx = name.lastIndexOf(' of ')
  if (ofIdx > 0) push(name.slice(0, ofIdx))
  const ofIdxCap = name.lastIndexOf(' Of ')
  if (ofIdxCap > 0) push(name.slice(0, ofIdxCap))

  for (const n of tryNames) {
    try {
      const fromMap = getItemIcon(defaultPoeItem({ name: n, baseType: opts.baseType || n }))
      if (fromMap) return fromMap
    } catch {
      // Host may not expose getItemIcon / __scalpel yet
    }
  }

  if (opts.priceIcons) {
    for (const n of tryNames) {
      const hit = opts.priceIcons.get(n) ?? opts.priceIcons.get(n.toLowerCase())
      if (hit) return hit
    }
  }

  for (const n of tryNames) {
    const bundled = lookupBundledIcon(n)
    if (bundled) return bundled
  }

  return null
}

import { getItemClasses } from '@shared/data/items/item-classes'
import { getPoeVersion } from '../game-state'
import { matchModToStat } from './stat-matcher/mod-matcher'
import { ARMOUR_CLASSES, WEAPON_CLASSES } from './stat-matcher/item-classes'
import { GEM_LEVEL_MOD } from './stat-matcher/producers/explicits'
import type { StatFilter } from './trade'

const RUNE_BASE_PREFIX = /^(Runeforged|Runemastered)\s+/i

const QUALIFIER_BY_ITEM_CLASS: Record<string, string> = {
  Charms: 'Charm',
  Flasks: 'Flask',
  Jewels: 'Jewel',
}

/** Strip build-planner base hints like `(Str/Dex Base)` from a base type name. */
export function normalizeGuideBaseType(raw: string): string {
  return raw
    .trim()
    .replace(/\s*\([^)]*\bBase\b[^)]*\)\s*$/i, '')
    .trim()
}

/** Resolve trade item class from base-type lookup, then slot mapping. */
export function resolveGuideItemClass(baseType: string, slotClass?: string): string {
  const normalized = normalizeGuideBaseType(baseType)
  if (normalized) {
    const classes = getItemClasses(getPoeVersion())
    const candidates = [normalized]
    const withoutRune = normalized.replace(RUNE_BASE_PREFIX, '')
    if (withoutRune !== normalized) candidates.push(withoutRune)
    for (const name of candidates) {
      for (const [cls, info] of Object.entries(classes)) {
        if (info.bases?.some((b) => b.name === name)) return cls
      }
    }
  }
  return slotClass?.trim() ?? ''
}

/** Keep the highest-priority explicit stat filters (guide order). */
export function limitGuideStatFilters(filters: readonly StatFilter[], maxExplicit: number): StatFilter[] {
  const misc = filters.filter((f) => f.type !== 'explicit')
  const explicit = filters.filter((f) => f.type === 'explicit').slice(0, maxExplicit)
  return [...misc, ...explicit]
}

/** Normalize a guide stat-priority line before stat matching. */
export function normalizeGuideModLine(raw: string): string {
  return raw
    .replace(/\s*\(local\)\s*$/i, '')
    .replace(/\bdamage\b/gi, 'Damage')
    .trim()
}

/** Strip GGG / MaxRoll markup from build-guide text. */
export function stripGuideMarkup(text: string): string {
  return text
    .replace(/<[^>{}]+>\{([^}]*)\}/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\{([^}]*)\}/g, '$1')
    .replace(/\r\n/g, '\n')
    .trim()
}

/** Pull numbered stat-priority lines from guide notes (`1. …`, `2. …`). */
export function parseGuideStatLines(notes?: string): string[] {
  if (!notes?.trim()) return []
  const clean = stripGuideMarkup(notes)
  return clean
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^\d+\.\s/.test(l))
    .map((l) => l.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean)
}

/** Convert guide priority mod lines into trade stat filters (presence search). */
export function buildGuideStatFilters(modLines: readonly string[], itemClass?: string): StatFilter[] {
  const preferQualifier = QUALIFIER_BY_ITEM_CLASS[itemClass ?? ''] ?? null
  const preferLocal = itemClass != null && (ARMOUR_CLASSES.has(itemClass) || WEAPON_CLASSES.has(itemClass))
  const seen = new Set<string>()
  const filters: StatFilter[] = []

  for (const raw of modLines) {
    const cleaned = normalizeGuideModLine(raw)
    if (!cleaned) continue
    const matched = matchModToStat(cleaned, preferLocal, 'explicit', false, preferQualifier)
    if (!matched || seen.has(matched.statId)) continue
    seen.add(matched.statId)

    let min: number | null = null
    let max: number | null = null
    if (GEM_LEVEL_MOD.test(cleaned) && matched.value != null) {
      min = matched.value
      max = matched.value
    }

    filters.push({
      id: matched.statId,
      text: cleaned,
      value: matched.value,
      min,
      max,
      enabled: true,
      type: 'explicit',
      option: matched.option,
    })
  }

  return filters
}

export function buildBaseTypeStatFilter(baseType: string, enabled = true): StatFilter {
  return {
    id: 'misc.basetype',
    text: normalizeGuideBaseType(baseType),
    value: null,
    min: null,
    max: null,
    enabled,
    type: 'misc',
  }
}

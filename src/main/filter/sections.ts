import type { FilterAction, FilterBlock, FilterFile, FilterSection, FilterSectionTier } from '@shared/types'
import type { FilterContinueParent, FilterSectionEffects } from '@shared/contracts/filter-sections'

export type { FilterSection, FilterSectionTier }

const TYPE_TITLES: Record<string, string> = {
  currency: 'Currency',
  'currency->emotions': 'Emotions (Delirium)',
  'currency->leveling': 'Campaign currency',
  gold: 'Gold',
  uniques: 'Uniques',
  gems: 'Gems',
  'gems-': 'Gems (extra)',
  fragments: 'Fragments',
  'fragments-': 'Fragments (extra)',
  waystones: 'Waystones',
  'waystone-': 'Waystones (extra)',
  jewels: 'Jewels',
  'jewels-': 'Jewels (extra)',
  exoticbases: 'Exotic bases',
  exoticmods: 'Exotic mods',
  artifact: 'Artifacts',
  relics: 'Relics',
  verisium: 'Verisium',
  chancing: 'Chancing',
  leveling: 'Leveling',
  'leveling-': 'Leveling (extra)',
  rare: 'Rares',
  'rare-': 'Rares (extra)',
  sockets: 'Sockets',
  'sockets-': 'Sockets (extra)',
  maplike: 'Map-like',
  'maplike-': 'Map-like (extra)',
  endgame: 'Endgame',
  'endgame-': 'Endgame (extra)',
  special: 'Special',
  'special-': 'Special (extra)',
  anyremaining: 'Any remaining',
  hidelayer: 'Hide layer',
  conditionalhide: 'Conditional hide',
  questlikeexception: 'Quest exceptions',
  miscmapitemsextra: 'Misc map items',
  xenotiering: 'Xeno tiering',
  legacytemp: 'Legacy / temp',
  decorators: 'Decorators',
  'decorators-': 'Decorators (extra)',
  rr: 'RR',
  'rr-': 'RR (extra)',
  ut: 'UT',
}

const TIER_ORDER = [
  's',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  't1',
  't2',
  't3',
  't4',
  't5',
  't6',
  't7',
  't8',
  't9',
  't10',
]

function titleForTypePath(typePath: string): string {
  if (TYPE_TITLES[typePath]) return TYPE_TITLES[typePath]
  const leaf = typePath.split('->').pop() ?? typePath
  return leaf
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function labelForTier(tier: string): string {
  const t = tier.toLowerCase()
  if (/^[a-z]$/.test(t)) return `${t.toUpperCase()} tier`
  if (t.startsWith('supply')) return `Supplies: ${tier.replace(/^supplies?/i, '').replace(/^[-_]?/, '') || 'general'}`
  if (t.includes('wisdom')) return 'Wisdom scrolls'
  if (t.includes('jeweller')) return "Jeweller's"
  return tier.replace(/[-_]+/g, ' ').toUpperCase()
}

function tierSortKey(tier: string): number {
  const t = tier.toLowerCase()
  const idx = TIER_ORDER.indexOf(t)
  if (idx >= 0) return idx
  if (t.startsWith('supply')) return 100 + t.length
  return 200
}

function rgbaFromAction(action: FilterAction | undefined, fallback: string): string {
  if (!action || action.values.length < 3) return fallback
  const [r, g, b] = action.values.map(Number)
  const a = action.values[3] != null ? Number(action.values[3]) / 255 : 1
  return `rgba(${r},${g},${b},${a})`
}

function previewActionsOf(block: FilterBlock): FilterAction[] {
  const keep = new Set(['SetTextColor', 'SetBorderColor', 'SetBackgroundColor', 'SetFontSize'])
  return block.actions.filter((a) => keep.has(a.type)).map((a) => ({ type: a.type, values: [...a.values] }))
}

function effectsOf(block: FilterBlock): FilterSectionEffects {
  const byType = new Map(block.actions.map((a) => [a.type, a]))
  const effects: FilterSectionEffects = {}
  const beam = byType.get('PlayEffect')
  if (beam?.values[0]) effects.beam = beam.values[0]
  const mm = byType.get('MinimapIcon')
  if (mm && mm.values.length >= 3) {
    effects.minimap = { size: mm.values[0], color: mm.values[1], shape: mm.values[2] }
  }
  const custom = byType.get('CustomAlertSound') ?? byType.get('CustomAlertSoundOptional')
  if (custom?.values[0]) {
    effects.sound = custom.values[0]
    effects.customSound = true
  } else {
    const alert = byType.get('PlayAlertSound') ?? byType.get('PlayAlertSoundPositional')
    if (alert?.values[0]) effects.sound = alert.values[0]
  }
  return effects
}

function continueParentsBefore(filter: FilterFile, blockIndex: number): FilterContinueParent[] {
  const parents: FilterContinueParent[] = []
  for (let i = blockIndex - 1; i >= 0; i--) {
    const b = filter.blocks[i]
    const bases = baseTypesOf(b)
    if (!b.continue || bases.length > 0) break
    const tag = b.tierTag
    const label = tag ? `${tag.typePath}/${tag.tier}` : `Continue #${i + 1}`
    parents.unshift({ blockIndex: i, label, effects: effectsOf(b) })
    if (parents.length >= 4) break
  }
  return parents
}

function styleFromBlock(block: FilterBlock): { text: string; bg: string; border: string } {
  const byType = new Map(block.actions.map((a) => [a.type, a]))
  return {
    text: rgbaFromAction(byType.get('SetTextColor'), 'rgba(200,200,200,1)'),
    bg: rgbaFromAction(byType.get('SetBackgroundColor'), 'rgba(0,0,0,0.6)'),
    border: rgbaFromAction(byType.get('SetBorderColor'), 'transparent'),
  }
}

function baseTypesOf(block: FilterBlock): string[] {
  return block.conditions.filter((c) => c.type === 'BaseType').flatMap((c) => c.values)
}

function makeTier(
  filter: FilterFile,
  block: FilterBlock,
  blockIndex: number,
  tier: string,
  label: string,
  baseTypes: string[],
): FilterSectionTier {
  const effects = effectsOf(block)
  const parents = continueParentsBefore(filter, blockIndex)
  return {
    tier,
    label,
    blockIndex,
    visibility: block.visibility,
    previewLabel: baseTypes[0] ?? label,
    previewActions: previewActionsOf(block),
    style: styleFromBlock(block),
    baseTypes,
    itemCount: baseTypes.length,
    continue: block.continue || undefined,
    effects: Object.keys(effects).length > 0 ? effects : undefined,
    continueParents: parents.length > 0 ? parents : undefined,
  }
}

/** Synthetic `$type` for blocks that have BaseTypes but no NeverSink `$type/$tier` tags. */
export const UNTAGGED_TYPE_PATH = '__untagged__'

/**
 * Group NeverSink-tagged blocks into FilterBlade-style sections.
 * Untagged blocks with BaseTypes land in a trailing "Untagged" bucket.
 * Continue-only decorator rows (no BaseType) are skipped as sections but
 * attached as continueParents on the next BaseType-bearing rule.
 */
export function buildFilterSections(filter: FilterFile): FilterSection[] {
  const byType = new Map<string, FilterSectionTier[]>()

  filter.blocks.forEach((block, blockIndex) => {
    const baseTypes = baseTypesOf(block)
    // Skip pure Continue decorator rows with no BaseType — they aren't tier lists.
    if (block.continue && baseTypes.length === 0) return

    const tag = block.tierTag
    if (!tag) {
      if (baseTypes.length === 0) return
      const list = byType.get(UNTAGGED_TYPE_PATH) ?? []
      list.push(makeTier(filter, block, blockIndex, `block-${blockIndex}`, `Block ${blockIndex + 1}`, baseTypes))
      byType.set(UNTAGGED_TYPE_PATH, list)
      return
    }

    const list = byType.get(tag.typePath) ?? []
    list.push(makeTier(filter, block, blockIndex, tag.tier, labelForTier(tag.tier), baseTypes))
    byType.set(tag.typePath, list)
  })

  const sections: FilterSection[] = []
  for (const [typePath, tiers] of byType) {
    tiers.sort((a, b) => tierSortKey(a.tier) - tierSortKey(b.tier) || a.blockIndex - b.blockIndex)
    const shownCount = tiers.filter((t) => t.visibility === 'Show').length
    sections.push({
      typePath,
      title: typePath === UNTAGGED_TYPE_PATH ? 'Untagged' : titleForTypePath(typePath),
      tiers,
      shownCount,
      totalCount: tiers.length,
    })
  }

  const PRIORITY = [
    'currency',
    'currency->emotions',
    'currency->leveling',
    'gold',
    'uniques',
    'fragments',
    'waystones',
    'gems',
    'jewels',
    'rare',
    'exoticbases',
  ]
  sections.sort((a, b) => {
    if (a.typePath === UNTAGGED_TYPE_PATH) return 1
    if (b.typePath === UNTAGGED_TYPE_PATH) return -1
    const ai = PRIORITY.indexOf(a.typePath)
    const bi = PRIORITY.indexOf(b.typePath)
    if (ai >= 0 || bi >= 0) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    return a.title.localeCompare(b.title)
  })

  return sections
}

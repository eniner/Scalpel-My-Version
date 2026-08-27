import type { FilterAction, FilterBlock, FilterCondition, PriceEntry, Visibility } from '@shared/types'
import { SCALPEL_FILTER_NAME, SCALPEL_GENERATOR_MARK } from './scalpel-owned'
import { serializeBlock } from './writer'

export const GENERATE_VERSION = 1

export type FilterStrictness = 'default' | 'strict'

export interface GenerateFilterInput {
  game: 1 | 2
  prices: PriceEntry[]
  uniquesByBase: Record<string, string[]>
  generatedAt: Date
  strictness?: FilterStrictness
}

type TierId = 't1' | 't2' | 't3' | 't4'

interface Cuts {
  t1Chaos: number
  t2Chaos: number
  t3Chaos: number
  t4Chaos: number
}

interface Style {
  font: string
  text: string[]
  border: string[]
  bg: string[]
  sound?: string[]
  effect?: string[]
  minimap?: string[]
}

const STYLES: Record<TierId, Style> = {
  t1: {
    font: '45',
    text: ['255', '255', '255', '255'],
    border: ['255', '0', '0', '255'],
    bg: ['80', '0', '0', '240'],
    sound: ['1', '300'],
    effect: ['Red'],
    minimap: ['0', 'Red', 'Star'],
  },
  t2: {
    font: '40',
    text: ['255', '210', '100', '255'],
    border: ['255', '180', '0', '255'],
    bg: ['50', '30', '0', '230'],
    sound: ['2', '250'],
    effect: ['Yellow'],
    minimap: ['1', 'Yellow', 'Diamond'],
  },
  t3: {
    font: '34',
    text: ['180', '220', '255', '255'],
    border: ['80', '140', '200', '255'],
    bg: ['0', '20', '40', '220'],
    sound: ['3', '200'],
    minimap: ['2', 'Blue', 'Circle'],
  },
  t4: {
    font: '28',
    text: ['200', '200', '200', '255'],
    border: ['120', '120', '120', '255'],
    bg: ['0', '0', '0', '180'],
  },
}

const MAP_STYLE: Style = {
  font: '36',
  text: ['150', '255', '150', '255'],
  border: ['0', '180', '0', '255'],
  bg: ['0', '30', '0', '220'],
  minimap: ['1', 'Green', 'Square'],
}

const LINK_STYLE: Style = {
  font: '40',
  text: ['255', '255', '255', '255'],
  border: ['255', '0', '255', '255'],
  bg: ['40', '0', '40', '230'],
  sound: ['6', '250'],
  effect: ['White'],
}

/** ninja category / type → Scalpel typePath. Uniques are handled separately. */
const ECONOMY_TYPEPATH: Record<string, string> = {
  currency: 'currency',
  fragments: 'fragments',
  'divination-cards': 'divination',
  essences: 'essences',
  scarabs: 'scarabs',
  oils: 'oils',
  fossils: 'fossils',
  resonators: 'resonators',
  incubators: 'incubators',
  runes: 'runes',
  'soul-cores': 'soul-cores',
  omen: 'omens',
  omens: 'omens',
}

const SKIP_CATEGORIES = new Set([
  'skill-gems',
  'unique-maps',
  'beasts',
  'cluster-jewels',
  'delirium-orbs',
  'invitations',
])

function isUniqueCategory(category: string, ninjaType?: string): boolean {
  if (category.startsWith('unique')) return true
  return (ninjaType ?? '').startsWith('Unique')
}

function cutsFromPrices(prices: PriceEntry[]): Cuts {
  const divine = prices.find((p) => p.name.toLowerCase() === 'divine orb')
  const divineChaos = divine && divine.chaosValue > 1 ? divine.chaosValue : 150
  return {
    t1Chaos: divineChaos,
    t2Chaos: Math.max(20, divineChaos * 0.15),
    t3Chaos: 5,
    t4Chaos: 1,
  }
}

function assignTier(entry: { chaosValue: number; divineValue?: number }, cuts: Cuts): TierId | 'hide' {
  const dv = entry.divineValue ?? 0
  if (dv >= 1 || entry.chaosValue >= cuts.t1Chaos) return 't1'
  if (dv >= 0.15 || entry.chaosValue >= cuts.t2Chaos) return 't2'
  if (entry.chaosValue >= cuts.t3Chaos) return 't3'
  if (entry.chaosValue >= cuts.t4Chaos) return 't4'
  return 'hide'
}

function invertUniquesByBase(uniquesByBase: Record<string, string[]>): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const [base, names] of Object.entries(uniquesByBase)) {
    for (const name of names) {
      const key = name.toLowerCase()
      const arr = out.get(key) ?? []
      arr.push(base)
      out.set(key, arr)
    }
  }
  return out
}

function styleActions(style: Style): FilterAction[] {
  const actions: FilterAction[] = [
    { type: 'SetFontSize', values: [style.font] },
    { type: 'SetTextColor', values: style.text },
    { type: 'SetBorderColor', values: style.border },
    { type: 'SetBackgroundColor', values: style.bg },
  ]
  if (style.sound) actions.push({ type: 'PlayAlertSound', values: style.sound })
  if (style.effect) actions.push({ type: 'PlayEffect', values: style.effect })
  if (style.minimap) actions.push({ type: 'MinimapIcon', values: style.minimap })
  return actions
}

function cond(
  type: string,
  values: string[],
  operator: FilterCondition['operator'] = '==',
  explicit = true,
): FilterCondition {
  return { type, operator, values, explicitOperator: explicit }
}

function block(opts: {
  visibility?: Visibility
  typePath: string
  tier: string
  conditions: FilterCondition[]
  actions: FilterAction[]
  leadingComment?: string
}): FilterBlock {
  return {
    id: '',
    visibility: opts.visibility ?? 'Show',
    conditions: opts.conditions,
    actions: opts.actions,
    continue: false,
    lineStart: 1,
    lineEnd: 1,
    leadingComment: opts.leadingComment,
    inlineComment: `$type->${opts.typePath} $tier->${opts.tier}`,
    tierTag: { typePath: opts.typePath, tier: opts.tier },
  }
}

function bucketNames(namesByTier: Record<TierId | 'hide', string[]>, name: string, tier: TierId | 'hide'): void {
  if (!namesByTier[tier].includes(name)) namesByTier[tier].push(name)
}

function emptyBuckets(): Record<TierId | 'hide', string[]> {
  return { t1: [], t2: [], t3: [], t4: [], hide: [] }
}

function emitSection(out: string[], title: string, blocks: FilterBlock[]): void {
  const nonempty = blocks.filter((b) => {
    const bt = b.conditions.find((c) => c.type === 'BaseType')
    // Structural blocks (no BaseType) always emit. Economy blocks skip empty lists.
    if (!bt) return true
    return bt.values.length > 0
  })
  if (nonempty.length === 0) return
  nonempty[0] = { ...nonempty[0], leadingComment: `# [[${title}]]` }
  for (const b of nonempty) {
    out.push(serializeBlock(b, '\t').join('\n'))
    out.push('')
  }
}

function showTiers(
  typePath: string,
  buckets: Record<TierId | 'hide', string[]>,
  extraConds: FilterCondition[],
  includeHide: boolean,
  strictness: FilterStrictness,
): FilterBlock[] {
  const t4 = strictness === 'strict' ? [] : buckets.t4
  const hide = strictness === 'strict' ? [...buckets.hide, ...buckets.t4] : buckets.hide
  const blocks: FilterBlock[] = []
  for (const tier of ['t1', 't2', 't3', 't4'] as TierId[]) {
    const names = tier === 't4' ? t4 : buckets[tier]
    if (names.length === 0) continue
    blocks.push(
      block({
        typePath,
        tier,
        conditions: [...extraConds, cond('BaseType', names)],
        actions: styleActions(STYLES[tier]),
      }),
    )
  }
  if (includeHide && hide.length > 0) {
    blocks.push(
      block({
        visibility: 'Hide',
        typePath,
        tier: 'hide',
        conditions: [...extraConds, cond('BaseType', hide)],
        actions: [],
      }),
    )
  }
  return blocks
}

/** Build a complete tagged .filter from live prices. Pure — no I/O. */
export function generateFilter(input: GenerateFilterInput): string {
  const strictness = input.strictness ?? 'default'
  const cuts = cutsFromPrices(input.prices)
  const uniqueToBases = invertUniquesByBase(input.uniquesByBase)
  const usedNames = new Set<string>()

  const economy: Record<string, Record<TierId | 'hide', string[]>> = {}
  const uniqueBuckets = emptyBuckets()
  const uniqueBest = new Map<string, { chaosValue: number; divineValue?: number }>()

  for (const entry of input.prices) {
    if (!entry.name || !(entry.chaosValue > 0)) continue
    const cat = entry.category ?? ''
    if (SKIP_CATEGORIES.has(cat)) continue

    if (isUniqueCategory(cat, entry.ninjaType)) {
      const bases = uniqueToBases.get(entry.name.toLowerCase())
      if (!bases || bases.length === 0) continue
      for (const base of bases) {
        const prev = uniqueBest.get(base)
        if (!prev || entry.chaosValue > prev.chaosValue) {
          uniqueBest.set(base, { chaosValue: entry.chaosValue, divineValue: entry.divineValue })
        }
      }
      continue
    }

    const typePath = ECONOMY_TYPEPATH[cat]
    if (!typePath) continue
    const key = entry.name.toLowerCase()
    if (usedNames.has(key)) continue
    usedNames.add(key)
    if (!economy[typePath]) economy[typePath] = emptyBuckets()
    bucketNames(economy[typePath], entry.name, assignTier(entry, cuts))
  }

  for (const [base, best] of uniqueBest) {
    bucketNames(uniqueBuckets, base, assignTier(best, cuts))
  }

  const iso = input.generatedAt.toISOString()
  const gameLabel = input.game === 2 ? 'poe2' : 'poe1'
  const mapClass = input.game === 2 ? 'Waystones' : 'Maps'
  const hideLevel = input.game === 2 ? 65 : 68

  const out: string[] = [
    '# Scalpel Filter',
    SCALPEL_GENERATOR_MARK,
    `# generator-version: ${GENERATE_VERSION}`,
    `# game: ${gameLabel}`,
    `# generated: ${iso}`,
    `#name: ${SCALPEL_FILTER_NAME}`,
    '#',
    '# Economy tiers are rebuilt from live prices. Edits you make in Scalpel',
    '# (hide, colors, moving a base) are recorded and replayed on refresh.',
    '# FilterBlade / online filters can still be imported alongside this file.',
    '',
  ]

  emitSection(out, 'uniques', [
    ...showTiers('uniques', uniqueBuckets, [cond('Rarity', ['Unique'], '==', true)], true, strictness),
    block({
      typePath: 'uniques',
      tier: 'other',
      conditions: [cond('Rarity', ['Unique'], '==', true)],
      actions: styleActions(STYLES.t4),
    }),
  ])

  const economyOrder = [
    'currency',
    'fragments',
    'divination',
    'essences',
    'scarabs',
    'oils',
    'fossils',
    'resonators',
    'incubators',
    'runes',
    'soul-cores',
    'omens',
  ]
  for (const typePath of economyOrder) {
    const buckets = economy[typePath]
    if (!buckets) continue
    emitSection(out, typePath, showTiers(typePath, buckets, [], false, strictness))
  }

  emitSection(out, 'links', [
    block({
      typePath: 'links',
      tier: '6link',
      conditions: [cond('LinkedSockets', ['6'], '>=', true)],
      actions: styleActions(LINK_STYLE),
    }),
  ])

  const mapBlocks: FilterBlock[] = [
    block({
      typePath: 'maps',
      tier: 'any',
      conditions: [cond('Class', [mapClass], '==', true)],
      actions: styleActions(MAP_STYLE),
    }),
  ]
  if (input.game === 2) {
    mapBlocks.push(
      block({
        typePath: 'maps',
        tier: 'tablet',
        conditions: [cond('Class', ['Tablet'], '==', true)],
        actions: styleActions(MAP_STYLE),
      }),
    )
  }
  emitSection(out, 'maps', mapBlocks)

  emitSection(out, 'quest', [
    block({
      typePath: 'quest',
      tier: 'any',
      conditions: [cond('Class', ['Quest Items'], '==', true)],
      actions: styleActions(STYLES.t3),
    }),
  ])

  emitSection(out, 'endgame', [
    block({
      visibility: 'Hide',
      typePath: 'endgame',
      tier: 'hide',
      conditions: [cond('AreaLevel', [String(hideLevel)], '>=', true)],
      actions: [],
    }),
  ])

  emitSection(out, 'leveling', [
    block({
      typePath: 'leveling',
      tier: 'show',
      conditions: [],
      actions: [
        { type: 'SetFontSize', values: ['32'] },
        { type: 'SetTextColor', values: ['200', '200', '200', '255'] },
        { type: 'SetBackgroundColor', values: ['0', '0', '0', '180'] },
      ],
    }),
  ])

  return out.join('\n').replace(/\n{3,}/g, '\n\n')
}

import { tabletRegex, type TabletRegex } from './vendor/tablets/Tablet.Gen'

/** PoE2 tablet affix slot. Tablets have no avoid axis -- all affixes are wantable. */
export type TabletAffix = 'PREFIX' | 'SUFFIX'

export interface TabletMod {
  /** Upstream token id (stable). Used for selection sets + presets. */
  id: number
  regex: string
  /** Display text with `#` placeholders (multi-line mods joined with `|`). */
  text: string
  affix: TabletAffix
  /** League-mechanic tags: default, breach, delirium, expedition, ritual, abyss,
   *  incursion, map_boss. A mod may carry several. */
  tags: string[]
  ranges: number[][]
  values: number[]
}

/** Collapse the generator's `##`/`##%` roll placeholders to the single-`#` form the
 *  ModList renderer expects. Mirrors waystone-mods.ts formatText. */
function formatText(name: string): string {
  return name.replace(/##%/g, '#%').replace(/##/g, '#')
}

function tokensToMods(data: TabletRegex[]): TabletMod[] {
  return data.map((m) => ({
    id: m.id,
    regex: m.regex,
    text: formatText(m.name),
    affix: (m.prefix ? 'PREFIX' : 'SUFFIX') as TabletAffix,
    tags: m.tags,
    ranges: m.ranges,
    values: m.values,
  }))
}

export const TABLET_MODS: TabletMod[] = tokensToMods(tabletRegex)

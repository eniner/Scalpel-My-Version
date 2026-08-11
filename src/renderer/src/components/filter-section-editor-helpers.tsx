import type {
  ConditionPreset,
  FilterCondition,
  FilterSection,
  FilterSectionEffects,
  FilterSectionTier,
  HistoryEntry,
} from '@shared/types'
import { POE_COLOR_HEX } from '@shared/data/filter/filter-actions'

const PIN_KEY = 'scalpel.filterSectionEditor.pinnedSections'
const HIDE_ZONE_KEY = 'scalpel.filterSectionEditor.hideOnMap'
const SESSION_KEY = 'scalpel.filterSectionEditor.session'
const PRESETS_KEY = 'scalpel.filterSectionEditor.conditionPresets'

export interface EditorSession {
  activeType?: string
  activeGroup?: string
  expandedTier?: number | null
  query?: string
  globalQuery?: string
  visFilter?: 'all' | 'show' | 'hide'
  sortByPrice?: boolean
  workbenchMode?: 'browse' | 'edit' | 'advanced' | 'guide'
}

export function loadPinnedSections(): string[] {
  try {
    const raw = localStorage.getItem(PIN_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function savePinnedSections(paths: string[]): void {
  localStorage.setItem(PIN_KEY, JSON.stringify(paths))
}

export function loadHideOnMap(): boolean {
  try {
    return localStorage.getItem(HIDE_ZONE_KEY) === '1'
  } catch {
    return false
  }
}

export function saveHideOnMap(on: boolean): void {
  localStorage.setItem(HIDE_ZONE_KEY, on ? '1' : '0')
}

export function loadSession(): EditorSession {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as EditorSession
  } catch {
    return {}
  }
}

export function saveSession(session: EditorSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function loadConditionPresets(): ConditionPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (p): p is ConditionPreset =>
        !!p &&
        typeof p === 'object' &&
        typeof (p as ConditionPreset).id === 'string' &&
        typeof (p as ConditionPreset).name === 'string' &&
        Array.isArray((p as ConditionPreset).conditions),
    )
  } catch {
    return []
  }
}

export function saveConditionPresets(presets: ConditionPreset[]): void {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets.slice(0, 40)))
}

export function upsertConditionPreset(name: string, conditions: FilterCondition[]): ConditionPreset {
  const list = loadConditionPresets()
  const preset: ConditionPreset = {
    id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || 'Preset',
    conditions: conditions
      .filter((c) => c.type !== 'BaseType')
      .map((c) => ({
        type: c.type,
        operator: c.operator,
        values: [...c.values],
        explicitOperator: c.explicitOperator,
      })),
    createdAt: Date.now(),
  }
  saveConditionPresets([preset, ...list.filter((p) => p.name.toLowerCase() !== preset.name.toLowerCase())])
  return preset
}

export function deleteConditionPreset(id: string): void {
  saveConditionPresets(loadConditionPresets().filter((p) => p.id !== id))
}

const SECTION_TEMPLATES_KEY = 'scalpel.filterSectionTemplates.v1'

export interface SectionTemplateTier {
  tier: string
  visibility: 'Show' | 'Hide' | 'Minimal'
  conditions: FilterCondition[]
}

export interface SectionTemplate {
  id: string
  name: string
  typePath: string
  title: string
  tiers: SectionTemplateTier[]
  createdAt: number
}

export function loadSectionTemplates(): SectionTemplate[] {
  try {
    const raw = localStorage.getItem(SECTION_TEMPLATES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (t): t is SectionTemplate =>
        !!t &&
        typeof (t as SectionTemplate).id === 'string' &&
        typeof (t as SectionTemplate).name === 'string' &&
        Array.isArray((t as SectionTemplate).tiers),
    )
  } catch {
    return []
  }
}

export function saveSectionTemplates(templates: SectionTemplate[]): void {
  localStorage.setItem(SECTION_TEMPLATES_KEY, JSON.stringify(templates.slice(0, 40)))
}

export function upsertSectionTemplate(
  name: string,
  section: FilterSection,
  tiersWithConditions: Array<{ tier: string; visibility: 'Show' | 'Hide' | 'Minimal'; conditions: FilterCondition[] }>,
): SectionTemplate {
  const list = loadSectionTemplates()
  const template: SectionTemplate = {
    id: `st-${Date.now()}`,
    name: name.trim() || section.title,
    typePath: section.typePath,
    title: section.title,
    tiers: tiersWithConditions.map((t) => ({
      tier: t.tier,
      visibility: t.visibility,
      conditions: t.conditions
        .filter((c) => c.type !== 'BaseType')
        .map((c) => ({
          type: c.type,
          operator: c.operator,
          values: [...c.values],
          explicitOperator: c.explicitOperator,
        })),
    })),
    createdAt: Date.now(),
  }
  saveSectionTemplates([template, ...list.filter((t) => t.name.toLowerCase() !== template.name.toLowerCase())])
  return template
}

export function deleteSectionTemplate(id: string): void {
  saveSectionTemplates(loadSectionTemplates().filter((t) => t.id !== id))
}

export function exportSectionTemplatesJson(): string {
  return JSON.stringify(loadSectionTemplates(), null, 2)
}

export function importSectionTemplatesJson(json: string): { ok: boolean; error?: string; count?: number } {
  try {
    const parsed = JSON.parse(json) as unknown
    const incoming = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' ? [parsed] : null
    if (!incoming) return { ok: false, error: 'Expected JSON array or template object' }
    const valid = incoming.filter(
      (t): t is SectionTemplate =>
        !!t &&
        typeof (t as SectionTemplate).name === 'string' &&
        Array.isArray((t as SectionTemplate).tiers),
    )
    if (valid.length === 0) return { ok: false, error: 'No valid templates in JSON' }
    const existing = loadSectionTemplates()
    const merged = [
      ...valid.map((t) => ({
        ...t,
        id: t.id || `st-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        typePath: t.typePath || '',
        title: t.title || t.name,
        createdAt: t.createdAt || Date.now(),
      })),
      ...existing,
    ]
    saveSectionTemplates(merged)
    return { ok: true, count: valid.length }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

const LOOT_SUITE_KEY = 'scalpel.filterLootRegressionSuite.v1'

export interface LootSuiteItem {
  id: string
  label: string
  baseType: string
  itemClass?: string
  rarity?: string
  stackSize?: number
  itemLevel?: number
  quality?: number
  areaLevel?: number
  corrupted?: boolean
  identified?: boolean
  /** Snapshot of last known winner label */
  expectedWinner?: string
  expectedVisibility?: string
}

export function loadLootSuite(): LootSuiteItem[] {
  try {
    const raw = localStorage.getItem(LOOT_SUITE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as LootSuiteItem[]) : []
  } catch {
    return []
  }
}

export function saveLootSuite(items: LootSuiteItem[]): void {
  localStorage.setItem(LOOT_SUITE_KEY, JSON.stringify(items.slice(0, 60)))
}

export function addLootSuiteItem(item: Omit<LootSuiteItem, 'id'>): LootSuiteItem {
  const list = loadLootSuite()
  const row: LootSuiteItem = { ...item, id: `ls-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }
  saveLootSuite([row, ...list.filter((x) => x.baseType !== row.baseType || x.stackSize !== row.stackSize)])
  return row
}

export function removeLootSuiteItem(id: string): void {
  saveLootSuite(loadLootSuite().filter((x) => x.id !== id))
}

export function clearLootSuite(): void {
  saveLootSuite([])
}

/** Section-type tool presets (Currency / Uniques / Maps …). */
export interface SectionTypePreset {
  id: string
  match: RegExp
  label: string
  hint: string
  suggestedTools: string[]
  /** Hide tiers whose id looks like C/D/E/F when applying quick policy */
  hideLowTiers?: boolean
}

export const SECTION_TYPE_PRESETS: SectionTypePreset[] = [
  {
    id: 'currency',
    match: /currency|stackedsix|stacked/i,
    label: 'Currency',
    hint: 'Economy nudges, batch StackSize, Strictness migrate',
    suggestedTools: ['nudges', 'batch', 'strictness', 'economy'],
    hideLowTiers: true,
  },
  {
    id: 'uniques',
    match: /unique/i,
    label: 'Uniques',
    hint: 'What wins?, style picker, filmstrip regression',
    suggestedTools: ['match', 'filmstrip', 'style'],
  },
  {
    id: 'maps',
    match: /map|waystone|tablet/i,
    label: 'Maps / Waystones',
    hint: 'AreaLevel conditions, batch visibility, preflight',
    suggestedTools: ['batch', 'find', 'preflight'],
  },
  {
    id: 'divination',
    match: /divination|card/i,
    label: 'Divination',
    hint: 'Economy policy, nudges, batch hide',
    suggestedTools: ['economy', 'nudges', 'batch'],
    hideLowTiers: true,
  },
  {
    id: 'flasks',
    match: /flask/i,
    label: 'Flasks',
    hint: 'Quality thresholds, batch conditions',
    suggestedTools: ['batch', 'find'],
  },
  {
    id: 'gems',
    match: /gem/i,
    label: 'Gems',
    hint: 'Batch visibility, condition find',
    suggestedTools: ['batch', 'find'],
  },
]

export function sectionTypePresetFor(typePath: string): SectionTypePreset | null {
  return SECTION_TYPE_PRESETS.find((p) => p.match.test(typePath)) ?? null
}

/** Stable fingerprint of section content for dirty detection. */
export function sectionsFingerprint(sections: FilterSection[]): string {
  return sections
    .map((s) =>
      [
        s.typePath,
        ...s.tiers.map(
          (t) =>
            `${t.blockIndex}:${t.visibility}:${t.baseTypes.join(',')}:${t.effects?.beam ?? ''}:${t.effects?.sound ?? ''}:${t.effects?.minimap?.shape ?? ''}`,
        ),
      ].join('|'),
    )
    .join('\n')
}

export interface BaseConflict {
  baseType: string
  shows: Array<{ typePath: string; title: string; tierLabel: string; blockIndex: number }>
  hides: Array<{ typePath: string; title: string; tierLabel: string; blockIndex: number }>
}

/**
 * True shadowing only: same BaseType listed more than once in the same
 * `$type` + `$tier` (duplicate rule), or both Show and Hide for that exact slot.
 * Cross-section repeats (Currency vs Stackedsix) and different tiers are intentional
 * NeverSink patterns and are not reported.
 */
export function findBaseConflicts(sections: FilterSection[]): BaseConflict[] {
  type Slot = { typePath: string; tier: string; title: string; tierLabel: string; blockIndex: number; visibility: string }
  const byBase = new Map<string, Slot[]>()

  for (const s of sections) {
    for (const t of s.tiers) {
      for (const base of t.baseTypes) {
        const list = byBase.get(base) ?? []
        list.push({
          typePath: s.typePath,
          tier: t.tier,
          title: s.title,
          tierLabel: t.label,
          blockIndex: t.blockIndex,
          visibility: t.visibility,
        })
        byBase.set(base, list)
      }
    }
  }

  const out: BaseConflict[] = []
  for (const [baseType, slots] of byBase) {
    const byKey = new Map<string, Slot[]>()
    for (const slot of slots) {
      const key = `${slot.typePath}\0${slot.tier}`
      const list = byKey.get(key) ?? []
      list.push(slot)
      byKey.set(key, list)
    }
    for (const group of byKey.values()) {
      if (group.length < 2) continue
      const shows = group
        .filter((g) => g.visibility !== 'Hide')
        .map((g) => ({
          typePath: g.typePath,
          title: g.title,
          tierLabel: g.tierLabel,
          blockIndex: g.blockIndex,
        }))
      const hides = group
        .filter((g) => g.visibility === 'Hide')
        .map((g) => ({
          typePath: g.typePath,
          title: g.title,
          tierLabel: g.tierLabel,
          blockIndex: g.blockIndex,
        }))
      // Duplicate Show rows in the same type/tier, or Show+Hide for the same slot.
      if (shows.length > 1 || (shows.length >= 1 && hides.length >= 1)) {
        out.push({ baseType, shows, hides })
      }
    }
  }
  return out.sort((a, b) => a.baseType.localeCompare(b.baseType))
}

export async function playEffectSound(
  effects: FilterSectionEffects | undefined,
  filterDir: string | null,
): Promise<void> {
  if (!effects?.sound) return
  try {
    if (effects.customSound) {
      if (!filterDir) return
      const url = await window.api.getSoundDataUrl(filterDir, effects.sound)
      if (!url) return
      const audio = new Audio(url)
      audio.volume = 0.35
      await audio.play().catch(() => {})
      return
    }
    const id = effects.sound.padStart(2, '0')
    const soundUrl = new URL(`../assets/sounds/AlertSound_${id}.ogg`, import.meta.url).href
    const audio = new Audio(soundUrl)
    audio.volume = 0.35
    await audio.play().catch(() => {})
  } catch {
    /* ignore */
  }
}

export function EffectChips({
  effects,
  missingSounds,
  compact,
  filterDir,
}: {
  effects?: FilterSectionEffects
  missingSounds?: Set<string>
  compact?: boolean
  filterDir?: string | null
}): JSX.Element | null {
  if (!effects) return null
  const fs = compact ? 9 : 10
  const chips: JSX.Element[] = []
  if (effects.beam) {
    const hex = POE_COLOR_HEX[effects.beam] ?? '#aaa'
    chips.push(
      <span
        key="beam"
        title={`Beam: ${effects.beam}`}
        style={{
          fontSize: fs,
          padding: '1px 6px',
          borderRadius: 4,
          background: `${hex}33`,
          border: `1px solid ${hex}`,
          color: '#f0e6d2',
        }}
      >
        Beam {effects.beam}
      </span>,
    )
  }
  if (effects.minimap) {
    const hex = POE_COLOR_HEX[effects.minimap.color] ?? '#aaa'
    chips.push(
      <span
        key="mm"
        title={`Minimap ${effects.minimap.shape} ${effects.minimap.color}`}
        style={{
          fontSize: fs,
          padding: '1px 6px',
          borderRadius: 4,
          background: `${hex}22`,
          border: `1px solid ${hex}`,
          color: '#f0e6d2',
        }}
      >
        ◉ {effects.minimap.shape}
      </span>,
    )
  }
  if (effects.sound) {
    const missing = effects.customSound && missingSounds?.has(effects.sound)
    chips.push(
      <button
        key="snd"
        type="button"
        title={missing ? `Missing sound: ${effects.sound}` : `Play sound: ${effects.sound}`}
        disabled={!!missing}
        onClick={(e) => {
          e.stopPropagation()
          void playEffectSound(effects, filterDir ?? null)
        }}
        style={{
          fontSize: fs,
          padding: '1px 6px',
          borderRadius: 4,
          background: missing ? 'rgba(248,113,113,0.25)' : 'rgba(255,255,255,0.08)',
          border: missing ? '1px solid #f87171' : '1px solid rgba(255,255,255,0.2)',
          color: missing ? '#fca5a5' : '#f0e6d2',
          cursor: missing ? 'default' : 'pointer',
        }}
      >
        {missing ? '⚠ ' : '♪ '}
        {effects.customSound ? effects.sound.replace(/^.*[\\/]/, '') : `#${effects.sound}`}
      </button>,
    )
  }
  if (chips.length === 0) return null
  return <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>{chips}</span>
}

export function ContinueBadge({ tier }: { tier: FilterSectionTier }): JSX.Element | null {
  const hasParents = (tier.continueParents?.length ?? 0) > 0
  if (!tier.continue && !hasParents) return null
  const parentLabels = tier.continueParents?.map((p) => p.label).join(', ')
  return (
    <span
      title={
        [
          tier.continue ? 'This rule Continues to later matches' : null,
          parentLabels ? `Styled by Continue parents: ${parentLabels}` : null,
        ]
          .filter(Boolean)
          .join(' · ') || undefined
      }
      style={{
        fontSize: 9,
        fontWeight: 700,
        padding: '1px 5px',
        borderRadius: 4,
        background: 'rgba(96,165,250,0.2)',
        border: '1px solid rgba(96,165,250,0.55)',
        color: '#93c5fd',
      }}
    >
      {tier.continue ? 'Continue' : 'Chain'}
      {hasParents ? ` ←${tier.continueParents!.length}` : ''}
    </span>
  )
}

export function HistoryMiniList({
  entries,
  busy,
  onRestore,
}: {
  entries: HistoryEntry[]
  busy?: boolean
  onRestore: (id: number) => void
}): JSX.Element {
  if (entries.length === 0) {
    return <div style={{ fontSize: 11, color: '#9a9aab' }}>No undo history yet.</div>
  }
  return (
    <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {entries.map((e, i) => (
        <button
          key={e.id}
          type="button"
          disabled={busy}
          onClick={() => onRestore(e.id)}
          title="Restore filter to state before this edit"
          style={{
            textAlign: 'left',
            fontSize: 11,
            padding: '5px 8px',
            background: i === 0 ? 'rgba(201,162,39,0.15)' : 'rgba(0,0,0,0.35)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 4,
            color: '#f0e6d2',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontWeight: 600 }}>{e.description}</div>
          <div style={{ color: '#9a9aab', fontSize: 10 }}>{new Date(e.timestamp).toLocaleTimeString()}</div>
        </button>
      ))}
    </div>
  )
}

/** DIY windowing for large BaseType lists — no extra deps. */
export function useVirtualWindow(count: number, rowHeight: number, viewportHeight: number, scrollTop: number) {
  const overscan = 6
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const visible = Math.ceil(viewportHeight / rowHeight) + overscan * 2
  const end = Math.min(count, start + visible)
  return { start, end, totalHeight: count * rowHeight, offsetY: start * rowHeight }
}

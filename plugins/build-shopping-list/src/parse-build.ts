import { compareSlots, inventoryIdToSlotClass, slotLabel, stripBuildMarkup } from './slots'
import type { BuildPlan, GearEntry, GearGroup, GearRarity } from './types'

interface BuildInventorySlot {
  inventory_id: string
  unique_name?: string
  additional_text?: string
  level_interval?: number | [number, number]
  slot_x?: number
  slot_y?: number
}

interface BuildFile {
  name?: string
  author?: string
  inventory_slots?: BuildInventorySlot[]
}

function normalizeRarity(raw?: string): GearRarity {
  if (!raw) return 'unknown'
  const r = raw.toLowerCase()
  if (r === 'unique') return 'unique'
  if (r === 'rare') return 'rare'
  if (r === 'magic') return 'magic'
  if (r === 'normal') return 'normal'
  return 'unknown'
}

function levelLabel(interval?: number | [number, number]): string | undefined {
  if (interval == null) return undefined
  if (typeof interval === 'number') return `Level ${interval}+`
  const [min, max] = interval
  if (max >= 100) return `Level ${min}+`
  return `Level ${min}–${max}`
}

function levelGroupKey(interval?: number | [number, number]): string {
  if (interval == null) return 'default'
  if (typeof interval === 'number') return `lvl-${interval}`
  return `lvl-${interval[0]}-${interval[1]}`
}

function levelGroupLabel(interval?: number | [number, number]): string {
  const label = levelLabel(interval)
  return label ? `Gear (${label})` : 'Gear'
}

function resolveSlotKey(inv: string, slot_x?: number): string {
  if (inv === 'Trinket1') {
    if (slot_x === 3) return 'Charm2'
    if (slot_x === 2) return 'Charm1'
  }
  if (inv === 'Flask1' && slot_x === 1) return 'Flask2'
  if (inv === 'Ring2') return 'Ring2'
  return inv.replace(/1$/, '')
}

function normalizeBaseTitle(raw: string): string {
  return raw
    .trim()
    .replace(/\s*\([^)]*\bBase\b[^)]*\)\s*$/i, '')
    .trim()
}

function parseAdditionalText(text: string): { title: string; notes: string } {
  const clean = stripBuildMarkup(text)
  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return { title: 'Rare item', notes: '' }
  const title = normalizeBaseTitle(lines[0])
  const notes = lines.slice(1).join('\n')
  return { title, notes }
}

function entryFromBuildSlot(slot: BuildInventorySlot, index: number): GearEntry {
  const inv = slot.inventory_id
  const slotKey = resolveSlotKey(inv, slot.slot_x)
  const slotLabelKey = inv === 'Trinket1' || inv === 'Flask1' ? slotKey : inv
  const isUnique = Boolean(slot.unique_name)
  const level = levelLabel(slot.level_interval)

  if (isUnique) {
    const name = slot.unique_name!
    return {
      id: `build-${inv}-${slot.slot_x ?? 0}-${index}-${name}`,
      slot: slotKey,
      slotLabel: slotLabel(slotLabelKey),
      title: name,
      subtitle: level,
      rarity: 'unique',
      isUnique: true,
      itemClass: inventoryIdToSlotClass(inv),
    }
  }

  const { title, notes } = parseAdditionalText(slot.additional_text ?? '')
  return {
    id: `build-${inv}-${slot.slot_x ?? 0}-${index}-${title}`,
    slot: slotKey,
    slotLabel: slotLabel(slotLabelKey),
    title,
    subtitle: level,
    rarity: 'rare',
    notes: notes || undefined,
    isUnique: false,
    itemClass: inventoryIdToSlotClass(inv),
  }
}

export function parseBuildFile(raw: unknown): BuildPlan {
  const data = raw as BuildFile
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid build file: expected a JSON object.')
  }
  const slots = data.inventory_slots ?? []
  if (slots.length === 0) {
    throw new Error('No inventory_slots found. Export a .build file from MaxRoll (Export Build Planner GGG).')
  }

  const grouped = new Map<string, { label: string; entries: GearEntry[] }>()
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]
    const key = levelGroupKey(slot.level_interval)
    const label = levelGroupLabel(slot.level_interval)
    const bucket = grouped.get(key) ?? { label, entries: [] }
    bucket.entries.push(entryFromBuildSlot(slot, i))
    grouped.set(key, bucket)
  }

  const groups: GearGroup[] = [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([id, { label, entries }]) => ({
      id,
      label,
      entries: entries.sort((a, b) => compareSlots(a.slot, b.slot)),
    }))

  return {
    name: data.name?.trim() || 'Imported build',
    author: data.author?.trim(),
    source: 'build-file',
    sourceLabel: '.build file',
    groups,
  }
}

export function parseBuildJson(text: string): BuildPlan {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Invalid JSON. Paste a .build file or use Import file.')
  }
  return parseBuildFile(parsed)
}

/** Re-export for tests */
export type { BuildFile }

import { parseBuildFile } from './parse-build'
import { compareSlots, slotLabel } from './slots'
import type { BuildPlan, GearEntry, GearGroup, GearRarity } from './types'

const MAXROLL_PLANNER_RE = /maxroll\.gg\/poe2\/planner\/([a-z0-9]+)/i

export function extractMaxrollPlannerId(input: string): string | null {
  const trimmed = input.trim()
  if (/^[a-z0-9]{6,12}$/i.test(trimmed)) return trimmed
  const m = trimmed.match(MAXROLL_PLANNER_RE)
  return m?.[1] ?? null
}

function lexicalToText(node: { text?: string; children?: unknown[] } | undefined): string {
  if (!node) return ''
  let out = node.text ?? ''
  for (const child of node.children ?? []) {
    out += lexicalToText(child as { text?: string; children?: unknown[] })
  }
  return out
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

function baseDisplayName(basePath?: string): string | undefined {
  if (!basePath) return undefined
  const leaf = basePath.split('/').pop()
  if (!leaf) return undefined
  return leaf.replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/(\d+)$/, ' $1').trim()
}

interface MaxrollItem {
  base?: string
  name?: string
  unique?: string
  rarity?: string
}

interface MaxrollVariant {
  id?: string
  name?: string
  items?: Record<string, number>
  slotMetadata?: Record<string, { notes?: { root?: { text?: string; children?: unknown[] } } }>
}

interface MaxrollProfile {
  id?: string
  name?: string
  equipment?: {
    variants?: MaxrollVariant[]
    items?: Record<string, number>
    slotMetadata?: MaxrollVariant['slotMetadata']
  }
}

interface MaxrollPlannerData {
  items?: Record<string, MaxrollItem>
  profiles?: MaxrollProfile[]
}

function entryFromMaxrollSlot(
  slot: string,
  item: MaxrollItem | undefined,
  notes: string | undefined,
  profileId: string,
  variantId: string,
): GearEntry {
  const rarity = normalizeRarity(item?.rarity)
  const isUnique = rarity === 'unique'
  const baseName = baseDisplayName(item?.base)
  const displayName = isUnique
    ? (item?.name ?? item?.unique ?? 'Unique')
    : (item?.name && item.name !== baseName ? item.name : baseName ?? 'Rare item')

  return {
    id: `maxroll-${profileId}-${variantId}-${slot}-${displayName}`,
    slot,
    slotLabel: slotLabel(slot),
    title: displayName,
    subtitle: isUnique ? undefined : baseName,
    rarity,
    notes: notes?.trim() || undefined,
    isUnique,
  }
}

function parsePlannerData(profileName: string, data: MaxrollPlannerData): BuildPlan {
  const groups: GearGroup[] = []

  for (const prof of data.profiles ?? []) {
    const eq = prof.equipment
    if (!eq) continue
    const variants = eq.variants ?? [
      { id: prof.id ?? 'default', name: prof.name, items: eq.items, slotMetadata: eq.slotMetadata },
    ]
    for (const variant of variants) {
      const entries: GearEntry[] = []
      for (const [slot, itemId] of Object.entries(variant.items ?? {})) {
        const item = data.items?.[String(itemId)]
        const noteRoot = variant.slotMetadata?.[slot]?.notes?.root ?? eq.slotMetadata?.[slot]?.notes?.root
        const notes = lexicalToText(noteRoot)
        entries.push(
          entryFromMaxrollSlot(
            slot,
            item,
            notes,
            prof.id ?? prof.name ?? 'profile',
            variant.id ?? variant.name ?? 'variant',
          ),
        )
      }
      entries.sort((a, b) => compareSlots(a.slot, b.slot))
      if (entries.length === 0) continue
      groups.push({
        id: `${prof.id ?? prof.name}-${variant.id ?? variant.name}`,
        label: `${prof.name ?? 'Profile'}${variant.name && variant.name !== prof.name ? ` / ${variant.name}` : ''}`,
        entries,
      })
    }
  }

  if (groups.length === 0) {
    throw new Error('No equipment found in this MaxRoll planner.')
  }

  return {
    name: profileName,
    source: 'maxroll',
    sourceLabel: 'MaxRoll planner',
    groups,
  }
}

function extractPlannerBlock(html: string): { profileName: string; data: MaxrollPlannerData } {
  const marker = '"poe2-planner-by-id":'
  const start = html.indexOf(marker)
  if (start < 0) throw new Error('Could not find planner data on the MaxRoll page.')

  let i = start + marker.length
  while (html[i] !== '{') i++
  let depth = 0
  const begin = i
  for (; i < html.length; i++) {
    const ch = html[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        const parsed = JSON.parse(html.slice(begin, i + 1)) as {
          profile?: { name?: string; data?: string }
        }
        if (!parsed.profile?.data) throw new Error('MaxRoll planner profile is empty.')
        return {
          profileName: parsed.profile.name?.trim() || 'MaxRoll build',
          data: JSON.parse(parsed.profile.data) as MaxrollPlannerData,
        }
      }
    }
  }
  throw new Error('Failed to parse MaxRoll page JSON.')
}

export async function fetchMaxrollPlanner(plannerId: string, fetchFn: typeof fetch): Promise<BuildPlan> {
  const res = await fetchFn(`https://maxroll.gg/poe2/planner/${plannerId}`, {
    headers: { 'User-Agent': 'Scalpel-BuildShoppingList/0.1' },
  })
  if (!res.ok) throw new Error(`MaxRoll returned ${res.status}. Check the planner URL.`)
  const html = await res.text()
  const { profileName, data } = extractPlannerBlock(html)
  return parsePlannerData(profileName, data)
}

export async function importBuildInput(input: string, fetchFn: typeof fetch): Promise<BuildPlan> {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('Paste a MaxRoll URL, planner ID, or .build JSON.')

  const plannerId = extractMaxrollPlannerId(trimmed)
  if (plannerId && !trimmed.startsWith('{')) {
    return fetchMaxrollPlanner(plannerId, fetchFn)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    throw new Error('Invalid JSON. Paste a .build file or use Import file.')
  }
  return parseBuildFile(parsed)
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

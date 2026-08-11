import { normalizeModText } from './text'
import type { CraftDataset, CraftMod, GenKind } from './types'

export interface CraftModIndex {
  /** Spawn-tag (base name or item tag) → mods that list that tag in `w`. */
  bySpawnTag: Map<string, CraftMod[]>
  /** `${kind}|${normalized text}` → mods (all tiers sharing the template). */
  byNormText: Map<string, CraftMod[]>
  byKind: { p: CraftMod[]; s: CraftMod[] }
}

const cache = new WeakMap<CraftDataset, CraftModIndex>()

/** Build once per dataset — turns O(all mods) craft loops into O(base pool). */
export function getCraftModIndex(data: CraftDataset): CraftModIndex {
  const hit = cache.get(data)
  if (hit) return hit

  const bySpawnTag = new Map<string, CraftMod[]>()
  const byNormText = new Map<string, CraftMod[]>()
  const byKind: { p: CraftMod[]; s: CraftMod[] } = { p: [], s: [] }

  const pushTag = (tag: string, mod: CraftMod) => {
    let list = bySpawnTag.get(tag)
    if (!list) {
      list = []
      bySpawnTag.set(tag, list)
    }
    list.push(mod)
  }

  for (const mod of data.mods) {
    if (mod.k === 'p') byKind.p.push(mod)
    else byKind.s.push(mod)

    for (const [tag] of mod.w) pushTag(tag, mod)

    const norm = normalizeModText(mod.t)
    if (norm) {
      const key = `${mod.k}|${norm}`
      let list = byNormText.get(key)
      if (!list) {
        list = []
        byNormText.set(key, list)
      }
      list.push(mod)
    }
  }

  const index: CraftModIndex = { bySpawnTag, byNormText, byKind }
  cache.set(data, index)
  return index
}

/** Candidate mods that could ever spawn for this base + tag set (before weight filter). */
export function candidateModsForTags(
  data: CraftDataset,
  tags: Set<string>,
  kind: GenKind,
  baseType?: string,
): CraftMod[] {
  const index = getCraftModIndex(data)
  const seen = new Set<string>()
  const out: CraftMod[] = []

  const consider = (mod: CraftMod) => {
    if (mod.k !== kind) return
    if (seen.has(mod.id)) return
    seen.add(mod.id)
    out.push(mod)
  }

  if (baseType) {
    for (const mod of index.bySpawnTag.get(baseType) ?? []) consider(mod)
  }
  for (const tag of tags) {
    for (const mod of index.bySpawnTag.get(tag) ?? []) consider(mod)
  }

  // Marksman / edge cases with empty w still live in byKind — only if nothing found.
  if (!out.length) {
    for (const mod of index.byKind[kind]) consider(mod)
  }
  return out
}

export function resolveModFromLineIndexed(
  data: CraftDataset,
  line: string,
  kind: GenKind,
): CraftMod | null {
  const index = getCraftModIndex(data)
  const norm = normalizeModText(line)
  if (!norm) return null
  const list = index.byNormText.get(`${kind}|${norm}`)
  if (!list?.length) return null
  // Prefer longest original text (closest tier match among normalized equals).
  let best = list[0]
  for (let i = 1; i < list.length; i++) {
    if (list[i].t.length > best.t.length) best = list[i]
  }
  return best
}

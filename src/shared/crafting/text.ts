/** Normalize PoE mod text for fuzzy matching (clipboard vs RePoE templates). */
export function normalizeModText(text: string): string {
  return text
    .replace(/\[([^|\]]+)\|([^\]]+)\]/g, '$2')
    .replace(/\[([^\]]+)\]/g, '$1')
    .replace(/\([^)]*\)/g, '')
    .replace(/#/g, '')
    .replace(/\d+(?:\.\d+)?/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function textsRoughlyMatch(a: string, b: string): boolean {
  const na = normalizeModText(a)
  const nb = normalizeModText(b)
  if (!na || !nb) return false
  if (na === nb) return true
  if (na.includes(nb) || nb.includes(na)) return true
  const aw = na.split(' ').filter((w) => w.length > 2)
  const bw = nb.split(' ').filter((w) => w.length > 2)
  if (aw.length === 0 || bw.length === 0) return false
  const overlap = aw.filter((w) => bw.includes(w)).length
  return overlap / Math.min(aw.length, bw.length) >= 0.6
}

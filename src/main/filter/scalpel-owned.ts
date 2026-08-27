/** Marker written into Scalpel-generated filters so we can tell them apart from
 *  FilterBlade / hand-authored files. Keep this string stable: refresh and
 *  origin detection both key off an exact line match in the header. */
export const SCALPEL_GENERATOR_MARK = '# generator: scalpel'

export const SCALPEL_FILTER_FILENAME = 'Scalpel.filter'

export const SCALPEL_FILTER_NAME = 'Scalpel'

export type FilterOrigin = 'scalpel' | 'filterblade' | 'other'

/** True when `content` is a filter Scalpel generated (not a FilterBlade import). */
export function isScalpelGenerated(content: string): boolean {
  return content
    .split(/\r?\n/)
    .slice(0, 20)
    .some((line) => line.trim() === SCALPEL_GENERATOR_MARK)
}

export function originFromFilter(content: string, fileName: string): FilterOrigin {
  if (isScalpelGenerated(content)) return 'scalpel'
  const base = fileName.replace(/\.filter$/i, '')
  if (base.endsWith('-local')) return 'filterblade'
  return 'other'
}

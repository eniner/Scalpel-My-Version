/** Pure helpers for PoE production_Config.ini boolean keys. */

const APPLY_ITEM_FILTER_TO_RITUAL = 'apply_item_filter_to_ritual'

function detectEol(ini: string): string {
  return ini.includes('\r\n') ? '\r\n' : ini.includes('\r') ? '\r' : '\n'
}

function splitIniLines(ini: string): { lines: string[]; endsWithEol: boolean; eol: string } {
  const eol = detectEol(ini)
  const endsWithEol = /\r\n$|\n$|\r$/.test(ini)
  const lines = ini.split(/\r\n|\n|\r/)
  if (endsWithEol && lines[lines.length - 1] === '') lines.pop()
  return { lines, endsWithEol, eol }
}

/** Read `apply_item_filter_to_ritual` from a PoE2 config body. Missing → false. */
export function getApplyItemFilterToRitual(ini: string): boolean {
  const m = ini.match(new RegExp(`^\\s*${APPLY_ITEM_FILTER_TO_RITUAL}\\s*=\\s*([^\\r\\n]+)`, 'im'))
  if (!m) return false
  return m[1].trim().toLowerCase() === 'true'
}

/** Set / insert `apply_item_filter_to_ritual` while preserving EOL style. */
export function setApplyItemFilterToRitual(ini: string, enabled: boolean): string {
  const value = enabled ? 'true' : 'false'
  const { lines, endsWithEol, eol } = splitIniLines(ini)
  let saw = false
  const out = lines.map((line) => {
    if (new RegExp(`^\\s*${APPLY_ITEM_FILTER_TO_RITUAL}\\s*=`, 'i').test(line)) {
      saw = true
      return `${APPLY_ITEM_FILTER_TO_RITUAL}=${value}`
    }
    return line
  })
  if (!saw) out.push(`${APPLY_ITEM_FILTER_TO_RITUAL}=${value}`)
  return out.join(eol) + (endsWithEol || !saw ? eol : '')
}

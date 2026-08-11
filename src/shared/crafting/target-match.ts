/** Expand user search terms to mod text / CoE group names. */
const TARGET_ALIASES: Array<{ terms: string[]; needles: string[] }> = [
  {
    terms: ['projectile level', 'projectile levels', 'project levels', 'proj level', 'proj levels'],
    needles: ['level of all projectile', 'increasesocketedgemlevel', 'projectile skill'],
  },
  {
    terms: ['melee level', 'melee levels'],
    needles: ['level of all melee', 'increasesocketedgemlevel'],
  },
  {
    terms: ['mark skill', 'mark skills'],
    needles: ['mark skill', 'effect of your mark'],
  },
]

export function normalizeTargetQuery(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Collapse concrete rolls / `#` placeholders so `(92-100)%` matches `(#-#)%`. */
export function templateTargetQuery(s: string): string {
  return normalizeTargetQuery(
    s
      .replace(/-?\d+(?:\.\d+)?/g, '#')
      .replace(/#+/g, '#')
      .replace(/\(#-#\)%/g, '%')
      .replace(/#%/g, '%')
      .replace(/\(#-#\)/g, '')
      .replace(/\+#/g, '+')
      .replace(/#/g, '')
      .replace(/\s*,\s*/g, ', ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

/** Pull numeric rolls from a mod line (order preserved). */
export function extractModNumbers(text: string): number[] {
  const out: number[] = []
  const re = /-?\d+(?:\.\d+)?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const n = Number(m[0])
    if (Number.isFinite(n)) out.push(n)
  }
  return out
}

export interface ParsedTargetQuery {
  /** Text needle used for includes / alias match (no >= / t1 prefix). */
  needle: string
  /**
   * Minimum required for the first numeric roll on the mod line.
   * e.g. T1 92% ES → minValue 92 so 15% ES does not count.
   */
  minValue?: number
}

/**
 * Parse condition text.
 * Supported:
 * - `>=92% increased Energy Shield`
 * - `t1: % increased Energy Shield` (minValue left unset — UI should set it from tier)
 * - plain `% increased Energy Shield` (any tier)
 */
export function parseTargetQuery(query: string): ParsedTargetQuery {
  let raw = query.trim().replace(/^\(+/, '').replace(/\)+$/, '')
  let minValue: number | undefined

  // `>=92 % increased…` or `>=92% increased…` — keep a leading % on the needle.
  const ge = raw.match(/^>=\s*(-?\d+(?:\.\d+)?)(%?)\s*(.*)$/i)
  if (ge) {
    minValue = Number(ge[1])
    const pct = ge[2] ?? ''
    const rest = (ge[3] ?? '').trim()
    raw = pct && rest && !rest.startsWith('%') ? `${pct} ${rest}` : `${pct}${rest ? (pct ? ' ' : '') + rest : ''}`
    raw = raw.trim()
  } else {
    const tN = raw.match(/^t(\d+)\s*:\s*(.*)$/i)
    if (tN) {
      // Tier label alone doesn't encode a value — keep needle; caller/UI should pass minValue.
      raw = tN[2] ?? ''
    }
  }

  // UI may store `(#-#)% increased…, +(#-#) to Stun` — scrub placeholders; keep primary clause.
  raw = raw
    .replace(/\(#-#\)%/g, '%')
    .replace(/#%/g, '%')
    .replace(/\(#-#\)/g, '')
    .replace(/\+#/g, '+')
    .replace(/#/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const primary = (raw.split(',')[0] ?? raw).trim()

  return {
    needle: normalizeTargetQuery(primary.length >= 8 ? primary : raw),
    minValue: Number.isFinite(minValue) ? minValue : undefined,
  }
}

function textMatchesNeedle(
  mod: { text: string; group: string; name?: string; kind: 'p' | 's' },
  needle: string,
): boolean {
  if (!needle) return false
  const hay = normalizeTargetQuery([mod.text, mod.group, mod.name ?? '', humanGroup(mod.group)].join(' '))
  if (hay.includes(needle)) return true
  const hayT = templateTargetQuery(hay)
  const needleT = templateTargetQuery(needle)
  if (needleT && (hayT.includes(needleT) || needleT.includes(templateTargetQuery(mod.text.split(',')[0] ?? '')))) {
    return true
  }
  // Primary-clause match: "% increased energy shield" hits hybrid ES+Stun lines.
  const needlePrimary = templateTargetQuery(needle.split(',')[0] ?? needle)
  const modPrimary = templateTargetQuery(mod.text.split(',')[0] ?? mod.text)
  if (needlePrimary && modPrimary && (modPrimary.includes(needlePrimary) || needlePrimary.includes(modPrimary))) {
    return true
  }
  for (const { terms, needles } of TARGET_ALIASES) {
    if (!terms.some((t) => needle.includes(t))) continue
    if (needles.some((n) => hay.includes(n) || hayT.includes(templateTargetQuery(n)))) return true
  }
  return false
}

export function modMatchesTargetQuery(
  mod: { text: string; group: string; name?: string; kind: 'p' | 's' },
  query: string,
  kind: 'all' | 'p' | 's',
  opts?: { minValue?: number },
): boolean {
  if (kind !== 'all' && mod.kind !== kind) return false
  const parsed = parseTargetQuery(query)
  const minValue = opts?.minValue ?? parsed.minValue
  if (!parsed.needle && minValue == null) return false
  if (parsed.needle && !textMatchesNeedle(mod, parsed.needle)) return false

  if (minValue != null) {
    const nums = extractModNumbers(mod.text)
    if (!nums.length) return false
    // First roll is the primary stat for local defence % mods (CoE-style).
    if (nums[0] < minValue) return false
  }
  return Boolean(parsed.needle) || minValue != null
}

function humanGroup(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase()
}

import { cleanOcrRewardName, expandTruncatedRewardName, extractRewardSegments, sanitizeOcrRewardLine } from './rewards'
import { matchCanonicalRewardName } from './rewards-catalog'

export const PLUGIN_VERSION = '2.5.2'

const LOOSE_QTY_RE = /^(\d+)\s+(?!x\b)(.+)$/i
const RUNIC_ENTRY_RE = /^(skill|support)\s*:?\s*(.+)$/i

export interface DecodedRow {
  qty: number
  name: string
  explicit: boolean
  raw: string
}

function titleCaseWords(s: string): string {
  return s
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

/** Grand Expedition runic pages: "Skill: Skyfall", "Support: Healing Runes". */
export function parseRunicEntry(text: string): { kind: 'Skill' | 'Support'; name: string } | null {
  const s = sanitizeOcrRewardLine(text).replace(/\s+/g, ' ').trim()
  const m = s.match(RUNIC_ENTRY_RE)
  if (!m) return null
  const tail = cleanOcrRewardName(m[2]!.trim())
  if (!tail || tail.length < 3 || !/[a-z]/i.test(tail)) return null
  const kind = m[1]!.toLowerCase() === 'support' ? 'Support' : 'Skill'
  return { kind, name: titleCaseWords(tail) }
}

export function isRunicEntryName(name: string): boolean {
  return /^(Skill|Support):/i.test(name.trim())
}

function resolveName(name: string): string {
  const expanded = expandTruncatedRewardName(name)
  return matchCanonicalRewardName(expanded) ?? matchCanonicalRewardName(name) ?? expanded
}

/** Turn one row's noisy read into a catalog name when possible. */
export function decodeRowText(raw: string): DecodedRow | null {
  const runic = parseRunicEntry(raw)
  if (runic) {
    return {
      qty: 1,
      name: `${runic.kind}: ${runic.name}`,
      explicit: true,
      raw: sanitizeOcrRewardLine(raw),
    }
  }

  const text = sanitizeOcrRewardLine(raw)
  if (!text || text.length < 3) return null
  if (/^(skill|support)\s*:?\s*$/i.test(text)) return null

  const segments = extractRewardSegments(text)
  if (segments.length > 0) {
    const seg = segments[0]!
    return {
      qty: seg.qty,
      name: resolveName(seg.name),
      explicit: true,
      raw: text,
    }
  }

  const loose = text.match(LOOSE_QTY_RE)
  if (loose) {
    const qty = Number(loose[1])
    const cleaned = cleanOcrRewardName(loose[2]!)
    const resolved = resolveName(cleaned)
    if (matchCanonicalRewardName(resolved) || cleaned.length >= 4) {
      return {
        qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
        name: resolved,
        explicit: true,
        raw: text,
      }
    }
  }

  const stripped = cleanOcrRewardName(text.replace(/^\d+\s*[%xX]\s*/, ''))
  const resolved = resolveName(stripped)
  if (matchCanonicalRewardName(resolved)) {
    const qtyM = text.match(/^(\d+)\s*[%xX]/)
    return {
      qty: qtyM ? Number(qtyM[1]) : 1,
      name: resolved,
      explicit: !!qtyM,
      raw: text,
    }
  }

  if (stripped.length >= 4 && /[a-z]/i.test(stripped)) {
    if (/^(skill|support)$/i.test(stripped)) return null
    return { qty: 1, name: resolved ?? stripped, explicit: false, raw: text }
  }
  return null
}

function noisePenalty(raw: string): number {
  if (parseRunicEntry(raw)) return 0
  const letters = (raw.match(/[a-z]/gi) ?? []).length
  const ratio = letters / Math.max(1, raw.length)
  if (ratio < 0.45) return 80
  if (/[:|]{1,}/.test(raw) && !/skill|support/i.test(raw)) return 25
  if (/\b[A-Z]{2,}\b/.test(raw) && !/\bx\b/i.test(raw) && !/skill|support/i.test(raw)) return 15
  return 0
}

function scoreDecoded(d: DecodedRow, raw: string): number {
  let s = d.name.length
  if (d.explicit) s += 40
  if (isRunicEntryName(d.name)) s += 120
  if (matchCanonicalRewardName(d.name)) s += 80
  if (/\brune\b/i.test(d.name) || /\borb\b/i.test(d.name)) s += 20
  if (/\b(prism|bauble|jewell|uncut|gem)\b/i.test(d.name)) s += 15
  s -= noisePenalty(raw)
  return s
}

/** Pick the best decode from multiple OCR passes on the same row crop. */
export function pickBestRowDecode(reads: string[]): DecodedRow | null {
  let best: DecodedRow | null = null
  let bestScore = -1
  for (const raw of reads) {
    const d = decodeRowText(raw)
    if (!d) continue
    const s = scoreDecoded(d, raw)
    if (s > bestScore) {
      bestScore = s
      best = d
    }
  }
  return best
}

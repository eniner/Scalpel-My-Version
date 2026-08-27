import type { ConditionType, CustomTier, FilterAction, FilterBlock, FilterCondition, Visibility } from '@shared/types'
import { parseFilterFile } from './parser'
import { serializeBlock } from './writer'

export const CUSTOM_TIER_MARK = '$custom->'
export const CUSTOM_TIER_PREFIX = 'scalpel-'
/** NeverSink / FilterBlade section paths we must not write into. */
export const CUSTOM_TYPE_PATH = 'scalpel-custom'

const DEFAULT_ACTIONS: FilterAction[] = [
  { type: 'SetFontSize', values: ['40'] },
  { type: 'SetTextColor', values: ['255', '210', '100', '255'] },
  { type: 'SetBorderColor', values: ['255', '180', '0', '255'] },
  { type: 'SetBackgroundColor', values: ['50', '30', '0', '230'] },
  { type: 'PlayAlertSound', values: ['2', '250'] },
  { type: 'PlayEffect', values: ['Yellow'] },
  { type: 'MinimapIcon', values: ['1', 'Yellow', 'Diamond'] },
]

export function isCustomComment(comment: string | undefined): boolean {
  return !!comment && comment.includes(CUSTOM_TIER_MARK)
}

export function isCustomBlock(block: { inlineComment?: string }): boolean {
  return isCustomComment(block.inlineComment)
}

export function sanitizeTierId(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'keep'
}

export function sanitizeTypePath(_raw: string): string {
  // Always emit our own section so FilterBlade.xyz does not fold these into
  // Currency / Uniques / etc. when the file is imported on their site.
  return CUSTOM_TYPE_PATH
}

export function emittedTierName(id: string): string {
  return id.startsWith(CUSTOM_TIER_PREFIX) ? id : `${CUSTOM_TIER_PREFIX}${id}`
}

function cond(type: ConditionType, values: string[], operator: FilterCondition['operator'] = '=='): FilterCondition {
  return { type, operator, values, explicitOperator: true }
}

function customBlock(tier: CustomTier): FilterBlock {
  const id = sanitizeTierId(tier.id)
  const typePath = sanitizeTypePath(tier.typePath)
  const tag = emittedTierName(id)
  const visibility: Visibility = tier.visibility === 'Hide' ? 'Hide' : 'Show'
  const conditions: FilterCondition[] = []
  conditions.push(cond('BaseType', tier.baseTypes))
  const actions = visibility === 'Hide' ? [] : DEFAULT_ACTIONS
  return {
    id: '',
    visibility,
    conditions,
    actions,
    continue: false,
    lineStart: 1,
    lineEnd: 1,
    leadingComment: undefined,
    inlineComment: `$type->${typePath} $tier->${tag} ${CUSTOM_TIER_MARK}${id}`,
    tierTag: { typePath, tier: tag },
  }
}

function detectEol(content: string): '\r\n' | '\n' {
  return content.includes('\r\n') ? '\r\n' : '\n'
}

function firstRuleIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    if (/^(Show|Hide|Minimal)\b/.test(lines[i].trim())) return i
  }
  return lines.length
}

/** Drop previously injected custom blocks. Leaves NeverSink / generated rules intact. */
export function stripCustomTiers(content: string): string {
  const file = parseFilterFile('custom-strip.filter', content)
  const custom = file.blocks.filter(isCustomBlock)
  if (custom.length === 0) return content
  const lines = [...file.rawLines]
  const ranges = custom
    .map((b) => {
      const start = Math.max(0, b.lineStart - 1)
      let end = b.lineEnd
      while (end < lines.length && lines[end].trim() === '') end++
      return { start, end }
    })
    .sort((a, b) => b.start - a.start)
  for (const r of ranges) lines.splice(r.start, r.end - r.start)
  const eol = file.eol ?? detectEol(content)
  return lines.join(eol).replace(/(\r?\n){3,}/g, eol + eol)
}

/**
 * Strip old custom blocks, then insert sidecar tiers immediately before the first
 * Show/Hide so they win first-match without editing upstream BaseType lists.
 */
export function injectCustomTiers(content: string, tiers: CustomTier[]): string {
  const stripped = stripCustomTiers(content)
  const emit = tiers.filter((t) => t.baseTypes.length > 0)
  if (emit.length === 0) return stripped
  const eol = detectEol(stripped)
  const lines = stripped.split(/\r?\n/)
  const at = firstRuleIndex(lines)
  const indent = lines.find((l) => l.startsWith('\t') || /^ {2,}/.test(l))?.match(/^(\t| {2,})/)?.[1] ?? '\t'
  const chunk: string[] = []
  for (const tier of emit) {
    chunk.push(...serializeBlock(customBlock(tier), indent))
    chunk.push('')
  }
  lines.splice(at, 0, ...chunk)
  return lines.join(eol).replace(/(\r?\n){3,}/g, eol + eol)
}

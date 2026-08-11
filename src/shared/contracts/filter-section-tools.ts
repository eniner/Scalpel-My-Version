import type { ComparisonOperator, ConditionResult, Visibility } from './core'

/** Lightweight match-chain row for the section-editor debugger. */
export interface FilterMatchStep {
  blockIndex: number
  visibility: Visibility
  continue: boolean
  isWinner: boolean
  /** True when a later match that never applies because an earlier Show/Hide won. */
  shadowed?: boolean
  typePath?: string
  tier?: string
  label: string
  conditions: Array<{
    type: string
    operator: ComparisonOperator | string
    values: string[]
    result: ConditionResult
  }>
  styleSummary: string
}

export interface FilterMatchRequest {
  baseType: string
  itemClass?: string
  rarity?: string
  stackSize?: number
  areaLevel?: number
  itemLevel?: number
  quality?: number
  corrupted?: boolean
  identified?: boolean
  /** Raw PoE Ctrl+C clipboard text — parsed and preferred over discrete fields. */
  clipboardText?: string
  /** Include matching rules after the winner (shadowed / never applied). */
  includeShadowed?: boolean
}

export interface ParsedClipboardItem {
  ok: boolean
  error?: string
  baseType?: string
  name?: string
  itemClass?: string
  rarity?: string
  stackSize?: number
  itemLevel?: number
  quality?: number
  areaLevel?: number
  corrupted?: boolean
  identified?: boolean
}

export interface FilterMatchResponse {
  ok: boolean
  error?: string
  winnerIndex: number | null
  steps: FilterMatchStep[]
  breakpoints?: Array<{ min: number; max: number; blockIndex: number | null; label: string }>
}

export interface MoveConflictPreview {
  ok: boolean
  error?: string
  /** Destination would become the in-game winner for a default synthetic item. */
  becomesWinner: boolean
  /** Current winner block index (before move), if any. */
  currentWinnerIndex: number | null
  currentWinnerLabel?: string
  /** Warning when an earlier rule still wins after the move. */
  warning?: string
  steps: FilterMatchStep[]
}

export interface StrictnessDiffRequest {
  leftPath: string
  rightPath: string
}

export interface ConditionPreset {
  id: string
  name: string
  conditions: Array<{
    type: string
    operator: string
    values: string[]
    explicitOperator?: boolean
  }>
  createdAt: number
}

export interface FilterReapplyPreview {
  ok: boolean
  error?: string
  onlineFilterName?: string
  intentCount: number
  applied: number
  skipped: number
  conflicts: Array<{ description: string }>
}

export interface FilterReapplyResult {
  ok: boolean
  error?: string
  applied?: number
  skipped?: number
  skippedForValidity?: number
  conflicts?: Array<{ description: string }>
}

export interface SectionDiffTier {
  typePath: string
  title: string
  onlyCurrent: string[]
  onlyOther: string[]
  visibilityChanges: Array<{ tier: string; current: string; other: string }>
}

export interface FilterVersionDiff {
  ok: boolean
  error?: string
  versionLabel?: string
  leftLabel?: string
  rightLabel?: string
  sections: SectionDiffTier[]
  changedSectionCount: number
}

export interface FilterPreflightIssue {
  id: string
  severity: 'error' | 'warn'
  message: string
  typePath?: string
  tier?: string
  blockIndex?: number
  baseType?: string
}

export interface FilterPreflightResult {
  ok: boolean
  error?: string
  issues: FilterPreflightIssue[]
}

export interface ApplySectionDeltaRequest {
  typePath: string
  /** Path of the filter to pull BaseTypes / visibility FROM (usually Soft / right). */
  sourcePath: string
  addMissingFromSource: boolean
  applyVisibilityFromSource: boolean
  removeExtrasNotInSource: boolean
}

export interface ApplySectionDeltaResult {
  ok: boolean
  error?: string
  added: number
  removed: number
  visibilityChanged: number
}

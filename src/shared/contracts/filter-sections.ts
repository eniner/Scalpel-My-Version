import type { Visibility } from './core'
import type { FilterAction } from './items'

/** Beam / minimap / sound summary for a tier row (inline chips). */
export interface FilterSectionEffects {
  beam?: string
  minimap?: { size: string; color: string; shape: string }
  /** Built-in PlayAlertSound id, or custom filename. */
  sound?: string
  customSound?: boolean
}

/** A preceding Continue decorator that styles this tier's match chain. */
export interface FilterContinueParent {
  blockIndex: number
  label: string
  effects: FilterSectionEffects
}

/** One NeverSink-tagged tier row inside a section (e.g. currency / s). */
export interface FilterSectionTier {
  tier: string
  label: string
  blockIndex: number
  visibility: Visibility
  previewLabel: string
  /** Actions used by LootLabel (colors / font size). */
  previewActions: FilterAction[]
  style: { text: string; bg: string; border: string }
  baseTypes: string[]
  itemCount: number
  /** True when this rule itself has Continue. */
  continue?: boolean
  /** Beam / minimap / alert for inline chips. */
  effects?: FilterSectionEffects
  /** Immediate preceding Continue-only decorator parents (file order). */
  continueParents?: FilterContinueParent[]
}

/** A FilterBlade-style section grouped by `$type->…` path. */
export interface FilterSection {
  typePath: string
  title: string
  tiers: FilterSectionTier[]
  shownCount: number
  totalCount: number
}

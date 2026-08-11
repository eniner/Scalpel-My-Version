// src/main/filter/intents.ts

import type { FilterAction, FilterCondition, Visibility } from '@shared/types'

export interface MoveBaseTypePayload {
  value: string
  fromTier: string
}

export interface SetVisibilityPayload {
  visibility: 'Show' | 'Hide' | 'Minimal'
}

export interface SetThresholdPayload {
  condition: 'StackSize' | 'Quality' | 'MemoryStrands'
  operator: string
  value: number
}

export interface SetActionPayload {
  action: string
  values: string[]
}

export interface RemoveBaseTypePayload {
  value: string
}

export interface InsertSectionRulePayload {
  baseType: string
  visibility: Visibility
  /** Non-BaseType conditions to restore on the new/updated tier. */
  conditions: FilterCondition[]
  actions: FilterAction[]
}

export interface DeleteBlockPayload {
  /** Snapshot of BaseTypes that were on the deleted rule (for describe). */
  baseTypes: string[]
}

export interface SetConditionPayload {
  condition: string
  operator: string
  /** Empty values = remove this condition type. */
  values: string[]
}

export type IntentPayload =
  | { type: 'move-basetype'; payload: MoveBaseTypePayload }
  | { type: 'set-visibility'; payload: SetVisibilityPayload }
  | { type: 'set-threshold'; payload: SetThresholdPayload }
  | { type: 'set-action'; payload: SetActionPayload }
  | { type: 'remove-basetype'; payload: RemoveBaseTypePayload }
  | { type: 'insert-section-rule'; payload: InsertSectionRulePayload }
  | { type: 'delete-block'; payload: DeleteBlockPayload }
  | { type: 'set-condition'; payload: SetConditionPayload }

export type IntentType =
  | 'move-basetype'
  | 'set-visibility'
  | 'set-threshold'
  | 'set-action'
  | 'remove-basetype'
  | 'insert-section-rule'
  | 'delete-block'
  | 'set-condition'

export interface Intent {
  type: IntentType
  target: { typePath: string; tier: string }
  payload:
    | MoveBaseTypePayload
    | SetVisibilityPayload
    | SetThresholdPayload
    | SetActionPayload
    | RemoveBaseTypePayload
    | InsertSectionRulePayload
    | DeleteBlockPayload
    | SetConditionPayload
  timestamp: number
}

export interface IntentLog {
  filterName: string
  intents: Intent[]
}

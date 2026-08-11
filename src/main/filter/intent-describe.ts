import type {
  DeleteBlockPayload,
  InsertSectionRulePayload,
  Intent,
  MoveBaseTypePayload,
  RemoveBaseTypePayload,
  SetActionPayload,
  SetConditionPayload,
  SetThresholdPayload,
  SetVisibilityPayload,
} from './intents'

/** Turn a recorded intent into a human-readable description (+ item name for moves). */
export function describeIntent(intent: Intent): { description: string; itemName?: string } {
  const { typePath, tier } = intent.target
  if (intent.type === 'move-basetype') {
    const p = intent.payload as MoveBaseTypePayload
    if (p.fromTier === '__new__') {
      return { description: `Added to ${typePath}/${tier}`, itemName: p.value }
    }
    return { description: `Moved to ${typePath}/${tier}`, itemName: p.value }
  }
  if (intent.type === 'set-visibility') {
    const p = intent.payload as SetVisibilityPayload
    return { description: `Set ${typePath}/${tier} to ${p.visibility}` }
  }
  if (intent.type === 'set-threshold') {
    const p = intent.payload as SetThresholdPayload
    return { description: `Set ${p.condition} ${p.operator} ${p.value} on ${typePath}/${tier}` }
  }
  if (intent.type === 'set-action') {
    const p = intent.payload as SetActionPayload
    return { description: `Changed ${p.action} on ${typePath}/${tier}` }
  }
  if (intent.type === 'remove-basetype') {
    const p = intent.payload as RemoveBaseTypePayload
    return { description: `Removed from ${typePath}/${tier}`, itemName: p.value }
  }
  if (intent.type === 'insert-section-rule') {
    const p = intent.payload as InsertSectionRulePayload
    return { description: `Inserted rule ${typePath}/${tier}`, itemName: p.baseType }
  }
  if (intent.type === 'delete-block') {
    const p = intent.payload as DeleteBlockPayload
    const n = p.baseTypes?.length ?? 0
    return { description: `Deleted ${typePath}/${tier}${n ? ` (${n} items)` : ''}` }
  }
  if (intent.type === 'set-condition') {
    const p = intent.payload as SetConditionPayload
    if (!p.values.length) {
      return { description: `Removed ${p.condition} on ${typePath}/${tier}` }
    }
    return {
      description: `Set ${p.condition} ${p.operator} ${p.values.join(' ')} on ${typePath}/${tier}`,
    }
  }
  return { description: `Changed ${typePath}/${tier}` }
}

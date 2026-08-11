// src/main/filter/intent-replay.ts

import type { ActionType, ComparisonOperator, FilterBlock, FilterCondition, FilterFile } from '@shared/types'
import type {
  InsertSectionRulePayload,
  Intent,
  IntentLog,
  MoveBaseTypePayload,
  RemoveBaseTypePayload,
  SetActionPayload,
  SetConditionPayload,
  SetThresholdPayload,
  SetVisibilityPayload,
} from './intents'
import { parseFilterFile } from './parser'

export interface ReplayConflict {
  intent: Intent
  description: string
  options: { label: string; action: 'keep-mine' | 'take-upstream' }[]
}

export interface ReplayResult {
  filter: FilterFile
  modifiedBlocks: Set<number>
  /** Blocks that should be dropped from the output entirely (e.g. a move emptied
   *  the block's only condition, which would otherwise become a catch-all). */
  removedBlocks: Set<number>
  conflicts: ReplayConflict[]
  stats: {
    applied: number
    skipped: number
    conflicts: number
  }
}

function findBlockByTierTag(
  filter: FilterFile,
  typePath: string,
  tier: string,
): { block: FilterBlock; index: number } | null {
  for (let i = 0; i < filter.blocks.length; i++) {
    const b = filter.blocks[i]
    if (b.tierTag && b.tierTag.typePath === typePath && b.tierTag.tier === tier) {
      return { block: b, index: i }
    }
  }
  return null
}

function findBaseTypeInFilter(filter: FilterFile, value: string): { block: FilterBlock; index: number } | null {
  for (let i = 0; i < filter.blocks.length; i++) {
    const b = filter.blocks[i]
    for (const cond of b.conditions) {
      if (cond.type === 'BaseType' && cond.values.includes(value)) {
        return { block: b, index: i }
      }
    }
  }
  return null
}

function findFirstBlockOfType(filter: FilterFile, typePath: string): number {
  for (let i = 0; i < filter.blocks.length; i++) {
    if (filter.blocks[i].tierTag?.typePath === typePath) return i
  }
  return Math.max(0, filter.blocks.length - 1)
}

function upsertCondition(block: FilterBlock, cond: FilterCondition): void {
  if (cond.type === 'BaseType') return
  const existing = block.conditions.find((c) => c.type === cond.type)
  if (existing) {
    existing.operator = cond.operator
    existing.values = [...cond.values]
    existing.explicitOperator = cond.explicitOperator
  } else {
    const baseIdx = block.conditions.findIndex((c) => c.type === 'BaseType')
    const row = { ...cond, values: [...cond.values] }
    if (baseIdx >= 0) block.conditions.splice(baseIdx, 0, row)
    else block.conditions.push(row)
  }
}

function ensureBaseType(block: FilterBlock, value: string): void {
  const bt = block.conditions.find((c) => c.type === 'BaseType')
  if (bt) {
    if (!bt.values.includes(value)) bt.values.push(value)
  } else {
    block.conditions.push({
      type: 'BaseType',
      operator: '==',
      values: [value],
      explicitOperator: true,
    })
  }
}

export function replayIntents(
  upstreamContent: string,
  upstreamPath: string,
  intentLog: IntentLog,
  options?: { resolutions?: Map<number, 'keep-mine' | 'take-upstream'>; forceApply?: boolean },
): ReplayResult {
  const filter = parseFilterFile(upstreamPath, upstreamContent)
  const conflicts: ReplayConflict[] = []
  const modifiedBlocks = new Set<number>()
  const removedBlocks = new Set<number>()
  let applied = 0
  let skipped = 0

  for (let i = 0; i < intentLog.intents.length; i++) {
    const intent = intentLog.intents[i]
    const { typePath, tier } = intent.target
    const match = findBlockByTierTag(filter, typePath, tier)
    const resolution = options?.resolutions?.get(i)
    const forceApply = options?.forceApply ?? false

    if (intent.type === 'insert-section-rule') {
      const p = intent.payload as InsertSectionRulePayload
      if (match) {
        ensureBaseType(match.block, p.baseType)
        match.block.visibility = p.visibility
        for (const c of p.conditions) upsertCondition(match.block, c)
        for (const a of p.actions) {
          const existing = match.block.actions.find((x) => x.type === a.type)
          if (existing) existing.values = [...a.values]
          else match.block.actions.push({ ...a, values: [...a.values] })
        }
        modifiedBlocks.add(match.index)
        applied++
      } else {
        const insertAt = findFirstBlockOfType(filter, typePath)
        const styleNeighbor = filter.blocks[insertAt]
        const newBlock: FilterBlock = {
          id: `replay-insert-${Date.now()}-${i}`,
          visibility: p.visibility,
          conditions: [
            ...p.conditions.map((c) => ({ ...c, values: [...c.values] })),
            { type: 'BaseType', operator: '==', values: [p.baseType], explicitOperator: true },
          ],
          actions:
            p.actions.length > 0
              ? p.actions.map((a) => ({ ...a, values: [...a.values] }))
              : (styleNeighbor?.actions ?? []).map((a) => ({ ...a, values: [...a.values] })),
          continue: false,
          lineStart: 0,
          lineEnd: 0,
          inlineComment: `$type->${typePath} $tier->${tier}`,
          tierTag: { typePath, tier },
        }
        filter.blocks.splice(insertAt, 0, newBlock)
        const shift = (set: Set<number>): void => {
          const next = [...set].map((idx) => (idx >= insertAt ? idx + 1 : idx))
          set.clear()
          for (const idx of next) set.add(idx)
        }
        shift(modifiedBlocks)
        shift(removedBlocks)
        modifiedBlocks.add(insertAt)
        applied++
      }
      continue
    }

    if (intent.type === 'delete-block') {
      if (!match) {
        applied++
        continue
      }
      removedBlocks.add(match.index)
      modifiedBlocks.delete(match.index)
      applied++
      continue
    }

    if (!match) {
      conflicts.push({
        intent,
        description: `Target tier ${typePath}/${tier} no longer exists in the updated filter.`,
        options: [],
      })
      skipped++
      continue
    }

    if (intent.type === 'move-basetype') {
      const p = intent.payload as MoveBaseTypePayload
      const current = findBaseTypeInFilter(filter, p.value)

      if (!current && p.fromTier === '__new__') {
        ensureBaseType(match.block, p.value)
        modifiedBlocks.add(match.index)
        applied++
        continue
      }

      if (!current) {
        conflicts.push({
          intent,
          description: `"${p.value}" no longer exists in the filter.`,
          options: [],
        })
        skipped++
        continue
      }

      const isInOriginalTier = current.block.tierTag?.tier === p.fromTier
      const isAlreadyInTarget = current.block.tierTag?.tier === tier && current.block.tierTag?.typePath === typePath

      if (isAlreadyInTarget) {
        applied++
        continue
      }

      if (!isInOriginalTier && p.fromTier !== '__new__' && !resolution && !forceApply) {
        const upstreamTier = current.block.tierTag?.tier ?? 'unknown'
        conflicts.push({
          intent,
          description: `"${p.value}" was moved to ${upstreamTier} by the filter update, but you had it in ${tier}.`,
          options: [
            { label: `Keep mine (${tier})`, action: 'keep-mine' },
            { label: `Take update (${upstreamTier})`, action: 'take-upstream' },
          ],
        })
        skipped++
        continue
      }

      if (resolution === 'take-upstream') {
        skipped++
        continue
      }

      for (const cond of current.block.conditions) {
        if (cond.type === 'BaseType') {
          cond.values = cond.values.filter((v) => v !== p.value)
        }
      }
      current.block.conditions = current.block.conditions.filter(
        (c) => !(c.type === 'BaseType' && c.values.length === 0),
      )
      if (current.block.conditions.length === 0) {
        removedBlocks.add(current.index)
        modifiedBlocks.delete(current.index)
      } else {
        modifiedBlocks.add(current.index)
      }
      ensureBaseType(match.block, p.value)
      modifiedBlocks.add(match.index)
      applied++
    } else if (intent.type === 'remove-basetype') {
      const p = intent.payload as RemoveBaseTypePayload
      for (const cond of match.block.conditions) {
        if (cond.type === 'BaseType') {
          cond.values = cond.values.filter((v) => v !== p.value)
        }
      }
      match.block.conditions = match.block.conditions.filter(
        (c) => !(c.type === 'BaseType' && c.values.length === 0),
      )
      if (match.block.conditions.length === 0) {
        removedBlocks.add(match.index)
        modifiedBlocks.delete(match.index)
      } else {
        modifiedBlocks.add(match.index)
      }
      applied++
    } else if (intent.type === 'set-visibility') {
      const p = intent.payload as SetVisibilityPayload
      match.block.visibility = p.visibility
      modifiedBlocks.add(match.index)
      applied++
    } else if (intent.type === 'set-threshold') {
      const p = intent.payload as SetThresholdPayload
      const cond = match.block.conditions.find((c) => c.type === p.condition)
      if (cond) {
        cond.operator = p.operator as ComparisonOperator
        cond.values = [String(p.value)]
      } else {
        upsertCondition(match.block, {
          type: p.condition,
          operator: p.operator as ComparisonOperator,
          values: [String(p.value)],
          explicitOperator: true,
        })
      }
      modifiedBlocks.add(match.index)
      applied++
    } else if (intent.type === 'set-condition') {
      const p = intent.payload as SetConditionPayload
      if (!p.values.length) {
        match.block.conditions = match.block.conditions.filter((c) => c.type !== p.condition)
      } else {
        upsertCondition(match.block, {
          type: p.condition,
          operator: (p.operator || '==') as ComparisonOperator,
          values: [...p.values],
          explicitOperator: true,
        })
      }
      modifiedBlocks.add(match.index)
      applied++
    } else if (intent.type === 'set-action') {
      const p = intent.payload as SetActionPayload
      if (p.values.length === 0) {
        match.block.actions = match.block.actions.filter((a) => a.type !== p.action)
      } else {
        const existing = match.block.actions.find((a) => a.type === p.action)
        if (existing) {
          existing.values = p.values
        } else {
          match.block.actions.push({ type: p.action as ActionType, values: p.values })
        }
      }
      modifiedBlocks.add(match.index)
      applied++
    } else {
      skipped++
    }
  }

  return {
    filter,
    modifiedBlocks,
    removedBlocks,
    conflicts,
    stats: { applied, skipped: Math.max(0, skipped - conflicts.length), conflicts: conflicts.length },
  }
}

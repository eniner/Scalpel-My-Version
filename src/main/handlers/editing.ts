import { ipcMain } from 'electron'
import type Store from 'electron-store'
import type {
  AppSettings,
  ApplySectionDeltaRequest,
  ApplySectionDeltaResult,
  FilterAction,
  FilterBlock,
  FilterChange,
  FilterMatchRequest,
  FilterMatchResponse,
  FilterMatchStep,
  FilterPreflightIssue,
  FilterPreflightResult,
  FilterVersionDiff,
  LootSimRequest,
  MoveConflictPreview,
  ParsedClipboardItem,
  PoeItem,
  SectionDiffTier,
} from '@shared/types'
import { defaultPoeItem } from '@shared/poe-item'
import { evaluateAndSend, getLastEvaluatedItem, getRecentEvaluatedItems } from '../evaluation'
import { isCustomBlock } from '../filter/custom-tier-inject'
import { applyCustomTiersToFile, moveItemBetweenCustomTiers } from '../filter/custom-tiers'
import { describeIntent } from '../filter/intent-describe'
import { getIntents, mergeIntents, record, replaceIntents } from '../filter/intent-recorder'
import {
  addBaseTypeToTier,
  deleteFilterBlock,
  insertSectionRule,
  moveBaseTypeBetweenTiers,
  moveFilterBlock,
  removeBaseTypeFromTier,
  updateQualityThresholds,
  updateStackThresholds,
  updateStrandThresholds,
  writeBlockEdit,
} from '../filter/writer'
import { buildFilterSections } from '../filter/sections'
import { findMatchingBlocks, findStackSizeBreakpoints, evaluateBlock } from '../filter/matcher'
import { simulateLootDrops } from '../filter/loot-sim'
import { parseFilterFile } from '../filter/parser'
import { getCurrentFilter, loadFilter } from '../filter-state'
import { getPoeVersion } from '../game-state'
import { captureSnapshot } from '../history'
import { reloadFilterInGame } from '../overlay'
import { getProfileBackedSetting } from '../profiles/profile-settings'
import { readVersionContent } from '../update/versions'
import { parseItemText } from '../trade/clipboard'
import { basename, extname, join } from 'node:path'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import type { FilterFile, MatchResult } from '@shared/types'

function customIdOf(block: FilterBlock | undefined): string | null {
  if (!block || !isCustomBlock(block)) return null
  const m = block.inlineComment?.match(/\$custom->(\S+)/)
  return m?.[1] ?? null
}

function applyCustomRetier(
  store: Store<AppSettings>,
  filterPath: string,
  baseTypes: string[],
  fromId: string | null,
  toId: string | null,
  toTypePath: string | undefined,
  itemJson: string,
): void {
  for (const bt of baseTypes) {
    moveItemBetweenCustomTiers(filterPath, bt, fromId, toId, toTypePath)
  }
  applyCustomTiersToFile(filterPath)
  loadFilter(filterPath)
  if (itemJson) {
    try {
      evaluateAndSend(JSON.parse(itemJson) as PoeItem)
    } catch {
      /* ignore */
    }
  }
  if (store.get('reloadOnSave') !== false) reloadFilterInGame()
}

function matchStepsFromResults(matches: MatchResult[]): FilterMatchStep[] {
  const winnerIdx = matches.find((m) => m.isFirstMatch)?.blockIndex ?? null
  return matches.map((m) => {
    const tag = m.block.tierTag
    const label = tag ? `${tag.typePath}/${tag.tier}` : `Block #${m.blockIndex + 1}`
    const styleBits = m.block.actions
      .filter((a) =>
        [
          'SetTextColor',
          'SetBorderColor',
          'SetBackgroundColor',
          'SetFontSize',
          'PlayEffect',
          'MinimapIcon',
          'PlayAlertSound',
          'CustomAlertSound',
        ].includes(a.type),
      )
      .map((a) => `${a.type} ${a.values.join(' ')}`)
      .slice(0, 4)
    const shadowed = winnerIdx != null && !m.isFirstMatch && !m.block.continue && m.blockIndex > winnerIdx
    return {
      blockIndex: m.blockIndex,
      visibility: m.block.visibility,
      continue: m.block.continue,
      isWinner: m.isFirstMatch,
      shadowed: shadowed || undefined,
      typePath: tag?.typePath,
      tier: tag?.tier,
      label,
      conditions: m.evaluatedConditions.map((ec) => ({
        type: ec.condition.type,
        operator: ec.condition.operator,
        values: ec.condition.values,
        result: ec.result,
      })),
      styleSummary: styleBits.join(' · ') || '(no style actions)',
    }
  })
}

function ensureFilterLoaded(store: Store<AppSettings>): FilterFile | null {
  const path = getProfileBackedSetting(store, 'filterPath') as string | undefined
  if (path) {
    const current = getCurrentFilter()
    if (!current || current.path !== path) {
      try {
        loadFilter(path)
      } catch {
        return null
      }
    }
  }
  return getCurrentFilter()
}

function buildSyntheticItem(req: Partial<FilterMatchRequest> & { baseType: string }): PoeItem {
  const version = getPoeVersion() === 2 ? 2 : 1
  return defaultPoeItem(
    {
      baseType: req.baseType,
      name: req.baseType,
      itemClass: req.itemClass ?? '',
      rarity: (req.rarity as PoeItem['rarity']) ?? 'Normal',
      stackSize: req.stackSize ?? 1,
      areaLevel: req.areaLevel,
      itemLevel: req.itemLevel ?? 100,
      quality: req.quality ?? 0,
      corrupted: req.corrupted ?? false,
      identified: req.identified ?? true,
    },
    version,
  )
}

function sectionDiffBetween(
  left: FilterFile,
  right: FilterFile,
  leftLabel: string,
  rightLabel: string,
): FilterVersionDiff {
  const leftSections = buildFilterSections(left)
  const rightSections = buildFilterSections(right)
  const rightByPath = new Map(rightSections.map((s) => [s.typePath, s]))
  const out: SectionDiffTier[] = []

  for (const cur of leftSections) {
    const oth = rightByPath.get(cur.typePath)
    const curBases = new Set(cur.tiers.flatMap((t) => t.baseTypes))
    const othBases = new Set(oth?.tiers.flatMap((t) => t.baseTypes) ?? [])
    const onlyCurrent = [...curBases].filter((b) => !othBases.has(b)).sort()
    const onlyOther = [...othBases].filter((b) => !curBases.has(b)).sort()
    const visibilityChanges: SectionDiffTier['visibilityChanges'] = []
    if (oth) {
      const othTierVis = new Map(oth.tiers.map((t) => [t.tier, t.visibility]))
      for (const t of cur.tiers) {
        const ov = othTierVis.get(t.tier)
        if (ov && ov !== t.visibility) {
          visibilityChanges.push({ tier: t.tier, current: t.visibility, other: ov })
        }
      }
    }
    if (onlyCurrent.length || onlyOther.length || visibilityChanges.length || !oth) {
      out.push({
        typePath: cur.typePath,
        title: cur.title,
        onlyCurrent,
        onlyOther: oth ? onlyOther : [...othBases].sort(),
        visibilityChanges,
      })
    }
    rightByPath.delete(cur.typePath)
  }
  for (const oth of rightByPath.values()) {
    out.push({
      typePath: oth.typePath,
      title: oth.title,
      onlyCurrent: [],
      onlyOther: [...new Set(oth.tiers.flatMap((t) => t.baseTypes))].sort(),
      visibilityChanges: [],
    })
  }
  out.sort((a, b) => a.title.localeCompare(b.title))
  return {
    ok: true,
    leftLabel,
    rightLabel,
    versionLabel: `${leftLabel} vs ${rightLabel}`,
    sections: out,
    changedSectionCount: out.length,
  }
}

// ---- History description helpers -------------------------------------------

const ACTION_LABELS: Record<string, string> = {
  SetTextColor: 'text color',
  SetBorderColor: 'border color',
  SetBackgroundColor: 'background color',
  SetFontSize: 'font size',
  PlayAlertSound: 'alert sound',
  PlayAlertSoundPositional: 'alert sound',
  PlaySound: 'alert sound',
  PlayEffect: 'beam effect',
  MinimapIcon: 'minimap icon',
  CustomAlertSound: 'custom sound',
  CustomAlertSoundOptional: 'custom sound',
  DisableDropSound: 'drop sound',
  EnableDropSound: 'drop sound',
}

function describeBlockEdit(oldBlock: FilterBlock, newBlock: FilterBlock): string {
  const changes: string[] = []

  // Visibility change
  if (oldBlock.visibility !== newBlock.visibility) {
    changes.push(`${oldBlock.visibility} \u2192 ${newBlock.visibility}`)
  }

  // Build action maps for comparison
  const oldActions = new Map<string, FilterAction>()
  for (const a of oldBlock.actions) oldActions.set(a.type, a)
  const newActions = new Map<string, FilterAction>()
  for (const a of newBlock.actions) newActions.set(a.type, a)

  // Detect changed/added/removed actions
  for (const [type, newAction] of newActions) {
    const oldAction = oldActions.get(type)
    const label = ACTION_LABELS[type] ?? type
    if (!oldAction) {
      // Added
      if (newAction.values.length > 0) changes.push(`added ${label}`)
    } else if (JSON.stringify(oldAction.values) !== JSON.stringify(newAction.values)) {
      // Changed
      if (newAction.values.length === 0) {
        changes.push(`removed ${label}`)
      } else {
        changes.push(`changed ${label}`)
      }
    }
  }
  for (const [type] of oldActions) {
    if (!newActions.has(type)) {
      changes.push(`removed ${ACTION_LABELS[type] ?? type}`)
    }
  }

  if (changes.length === 0) return 'No visible changes'
  // Capitalize first change, join with commas
  const desc = changes.join(', ')
  return desc.charAt(0).toUpperCase() + desc.slice(1)
}

// ---- IPC handlers ----------------------------------------------------------

export function register(store: Store<AppSettings>): void {
  ipcMain.handle('get-filter-sections', () => {
    const path = getProfileBackedSetting(store, 'filterPath') as string | undefined
    if (path) {
      const current = getCurrentFilter()
      if (!current || current.path !== path) {
        try {
          loadFilter(path)
        } catch (err) {
          return { ok: false as const, error: String(err), sections: [] }
        }
      }
    }
    const currentFilter = getCurrentFilter()
    if (!currentFilter) return { ok: false as const, error: 'No filter loaded', sections: [] }
    return { ok: true as const, path: currentFilter.path, sections: buildFilterSections(currentFilter) }
  })

  ipcMain.handle('set-section-tier-visibility', (_event, blockIndex: number, visibility: FilterBlock['visibility']) => {
    const currentFilter = getCurrentFilter()
    if (!currentFilter) return { ok: false, error: 'No filter loaded' }
    const oldBlock = currentFilter.blocks[blockIndex]
    if (!oldBlock) return { ok: false, error: 'Block not found' }
    if (oldBlock.visibility === visibility) return { ok: true }
    try {
      const updatedBlock: FilterBlock = { ...oldBlock, visibility }
      const tier = oldBlock.tierTag?.tier ?? `block #${blockIndex + 1}`
      captureSnapshot(
        currentFilter.path,
        'block-edit',
        `${oldBlock.visibility} → ${visibility} (${tier})`,
        undefined,
        oldBlock.tierTag?.typePath,
      )
      if (oldBlock.tierTag) {
        record({
          type: 'set-visibility',
          target: { typePath: oldBlock.tierTag.typePath, tier: oldBlock.tierTag.tier },
          payload: { visibility },
          timestamp: Date.now(),
        })
      }
      writeBlockEdit(currentFilter, blockIndex, updatedBlock)
      const path = getProfileBackedSetting(store, 'filterPath')
      if (path) loadFilter(path)
      reloadFilterInGame()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('get-filter-block', (_event, blockIndex: number) => {
    const path = getProfileBackedSetting(store, 'filterPath') as string | undefined
    if (path) {
      const current = getCurrentFilter()
      if (!current || current.path !== path) {
        try {
          loadFilter(path)
        } catch (err) {
          return { ok: false as const, error: String(err) }
        }
      }
    }
    const currentFilter = getCurrentFilter()
    if (!currentFilter) return { ok: false as const, error: 'No filter loaded' }
    const block = currentFilter.blocks[blockIndex]
    if (!block) return { ok: false as const, error: 'Block not found' }
    return { ok: true as const, block, blockIndex }
  })

  ipcMain.handle('simulate-loot-drops', (_event, req: LootSimRequest) => {
    const path = getProfileBackedSetting(store, 'filterPath') as string | undefined
    if (path) {
      const current = getCurrentFilter()
      if (!current || current.path !== path) {
        try {
          loadFilter(path)
        } catch (err) {
          return { ok: false as const, error: String(err), drops: [], shown: 0, hidden: 0 }
        }
      }
    }
    const currentFilter = getCurrentFilter()
    if (!currentFilter) return { ok: false as const, error: 'No filter loaded', drops: [], shown: 0, hidden: 0 }
    try {
      const result = simulateLootDrops(currentFilter, req, getPoeVersion() === 2 ? 2 : 1)
      return { ok: true as const, ...result }
    } catch (err) {
      return { ok: false as const, error: String(err), drops: [], shown: 0, hidden: 0 }
    }
  })

  ipcMain.handle('add-basetype-to-tier', (_event, blockIndex: number, baseType: string) => {
    const currentFilter = getCurrentFilter()
    if (!currentFilter) return { ok: false, error: 'No filter loaded' }
    try {
      const block = currentFilter.blocks[blockIndex]
      captureSnapshot(currentFilter.path, 'block-edit', `Added "${baseType}" to tier`, baseType)
      if (block?.tierTag) {
        record({
          type: 'move-basetype',
          target: { typePath: block.tierTag.typePath, tier: block.tierTag.tier },
          payload: { value: baseType, fromTier: '__new__' },
          timestamp: Date.now(),
        })
      }
      addBaseTypeToTier(currentFilter, blockIndex, baseType)
      const path = getProfileBackedSetting(store, 'filterPath')
      if (path) loadFilter(path)
      if (store.get('reloadOnSave') !== false) reloadFilterInGame()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('remove-basetype-from-tier', (_event, blockIndex: number, baseType: string) => {
    const currentFilter = getCurrentFilter()
    if (!currentFilter) return { ok: false, error: 'No filter loaded' }
    try {
      const block = currentFilter.blocks[blockIndex]
      captureSnapshot(currentFilter.path, 'block-edit', `Removed "${baseType}" from tier`, baseType)
      if (block?.tierTag) {
        record({
          type: 'remove-basetype',
          target: { typePath: block.tierTag.typePath, tier: block.tierTag.tier },
          payload: { value: baseType },
          timestamp: Date.now(),
        })
      }
      removeBaseTypeFromTier(currentFilter, blockIndex, baseType)
      const path = getProfileBackedSetting(store, 'filterPath')
      if (path) loadFilter(path)
      if (store.get('reloadOnSave') !== false) reloadFilterInGame()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('delete-filter-block', (_event, blockIndex: number) => {
    const currentFilter = getCurrentFilter()
    if (!currentFilter) return { ok: false, error: 'No filter loaded' }
    try {
      const block = currentFilter.blocks[blockIndex]
      const label = block?.tierTag ? `${block.tierTag.typePath}/${block.tierTag.tier}` : `block #${blockIndex + 1}`
      captureSnapshot(currentFilter.path, 'block-edit', `Deleted tier ${label}`, undefined, block?.tierTag?.typePath)
      if (block?.tierTag) {
        const bases = block.conditions.find((c) => c.type === 'BaseType')?.values ?? []
        record({
          type: 'delete-block',
          target: { typePath: block.tierTag.typePath, tier: block.tierTag.tier },
          payload: { baseTypes: [...bases] },
          timestamp: Date.now(),
        })
      }
      deleteFilterBlock(currentFilter, blockIndex)
      const path = getProfileBackedSetting(store, 'filterPath')
      if (path) loadFilter(path)
      if (store.get('reloadOnSave') !== false) reloadFilterInGame()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('move-filter-block', (_event, fromIndex: number, toIndex: number) => {
    const currentFilter = getCurrentFilter()
    if (!currentFilter) return { ok: false, error: 'No filter loaded' }
    try {
      const block = currentFilter.blocks[fromIndex]
      const label = block?.tierTag ? `${block.tierTag.typePath}/${block.tierTag.tier}` : `block #${fromIndex + 1}`
      captureSnapshot(
        currentFilter.path,
        'tier-move',
        `Reordered ${label} → #${toIndex + 1}`,
        undefined,
        block?.tierTag?.typePath,
      )
      moveFilterBlock(currentFilter, fromIndex, toIndex)
      const path = getProfileBackedSetting(store, 'filterPath')
      if (path) loadFilter(path)
      if (store.get('reloadOnSave') !== false) reloadFilterInGame()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle(
    'insert-section-rule',
    (
      _event,
      opts: {
        typePath: string
        tier: string
        baseType: string
        beforeBlockIndex: number
        visibility?: FilterBlock['visibility']
        copyStyleFromIndex?: number
        cloneConditions?: boolean
      },
    ) => {
      const currentFilter = getCurrentFilter()
      if (!currentFilter) return { ok: false, error: 'No filter loaded' }
      try {
        captureSnapshot(
          currentFilter.path,
          'block-edit',
          `Added rule "${opts.baseType}" (${opts.typePath}/${opts.tier})`,
          opts.baseType,
          opts.typePath,
        )
        const styleSrc =
          opts.copyStyleFromIndex != null
            ? currentFilter.blocks[opts.copyStyleFromIndex]
            : currentFilter.blocks[opts.beforeBlockIndex]
        const cloneConditions = opts.cloneConditions !== false
        const conditions = cloneConditions
          ? (styleSrc?.conditions ?? [])
              .filter((c) => c.type !== 'BaseType')
              .map((c) => ({ ...c, values: [...c.values] }))
          : []
        const actions = (styleSrc?.actions ?? [])
          .filter((a) =>
            [
              'SetTextColor',
              'SetBorderColor',
              'SetBackgroundColor',
              'SetFontSize',
              'PlayAlertSound',
              'PlayEffect',
              'MinimapIcon',
            ].includes(a.type),
          )
          .map((a) => ({ ...a, values: [...a.values] }))

        insertSectionRule(currentFilter, opts)

        const tierId = opts.tier.trim().replace(/\s+/g, '').toLowerCase() || 'custom'
        record({
          type: 'insert-section-rule',
          target: { typePath: opts.typePath, tier: tierId },
          payload: {
            baseType: opts.baseType.trim(),
            visibility: opts.visibility ?? 'Show',
            conditions,
            actions,
          },
          timestamp: Date.now(),
        })

        const path = getProfileBackedSetting(store, 'filterPath')
        if (path) loadFilter(path)
        if (store.get('reloadOnSave') !== false) reloadFilterInGame()
        return { ok: true }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    },
  )

  ipcMain.handle('save-block-edit', (_event, blockIndex: number, updatedBlock: FilterBlock, itemJson?: string) => {
    const currentFilter = getCurrentFilter()
    if (!currentFilter) return { ok: false, error: 'No filter loaded' }
    try {
      const oldBlock = currentFilter.blocks[blockIndex]
      const item: PoeItem | undefined = itemJson ? JSON.parse(itemJson) : undefined
      const _tier = oldBlock?.tierTag?.tier ?? `block #${blockIndex + 1}`
      const changedActions: string[] = []
      if (oldBlock.visibility !== updatedBlock.visibility) changedActions.push('visibility')
      const oldActionsStr = new Map(oldBlock.actions.map((a) => [a.type, JSON.stringify(a.values)]))
      const newActionsStr = new Map(updatedBlock.actions.map((a) => [a.type, JSON.stringify(a.values)]))
      for (const [type, val] of newActionsStr) {
        if (oldActionsStr.get(type) !== val) changedActions.push(type)
      }
      for (const type of oldActionsStr.keys()) {
        if (!newActionsStr.has(type)) changedActions.push(type)
      }
      const itemName = item?.baseType
      const desc = describeBlockEdit(oldBlock, updatedBlock)
      captureSnapshot(currentFilter.path, 'block-edit', desc, itemName, oldBlock?.tierTag?.typePath)
      // Record intents for the edit
      const tierTag = oldBlock.tierTag
      if (tierTag) {
        const target = { typePath: tierTag.typePath, tier: tierTag.tier }
        const now = Date.now()

        // Visibility change
        if (oldBlock.visibility !== updatedBlock.visibility) {
          record({
            type: 'set-visibility',
            target,
            payload: { visibility: updatedBlock.visibility },
            timestamp: now,
          })
        }

        // Action changes - compare old vs new
        const oldActionsMap = new Map(oldBlock.actions.map((a) => [a.type, a.values]))
        const newActionsMap = new Map(updatedBlock.actions.map((a) => [a.type, a.values]))
        for (const [actionType, newValues] of newActionsMap) {
          const oldValues = oldActionsMap.get(actionType)
          if (!oldValues || JSON.stringify(oldValues) !== JSON.stringify(newValues)) {
            record({
              type: 'set-action',
              target,
              payload: { action: actionType, values: newValues },
              timestamp: now,
            })
          }
        }
        // Actions removed
        for (const [actionType] of oldActionsMap) {
          if (!newActionsMap.has(actionType)) {
            record({
              type: 'set-action',
              target,
              payload: { action: actionType, values: [] },
              timestamp: now,
            })
          }
        }

        // Threshold-style condition edits (StackSize / Quality / MemoryStrands)
        for (const condType of ['StackSize', 'Quality', 'MemoryStrands'] as const) {
          const oldC = oldBlock.conditions.find((c) => c.type === condType)
          const newC = updatedBlock.conditions.find((c) => c.type === condType)
          if (!newC && !oldC) continue
          if (
            !oldC ||
            !newC ||
            oldC.operator !== newC.operator ||
            JSON.stringify(oldC.values) !== JSON.stringify(newC.values)
          ) {
            if (newC?.values[0] != null && !Number.isNaN(parseInt(newC.values[0], 10))) {
              record({
                type: 'set-threshold',
                target,
                payload: {
                  condition: condType,
                  operator: newC.operator,
                  value: parseInt(newC.values[0], 10),
                },
                timestamp: now,
              })
            }
          }
        }

        // General non-BaseType condition edits (Class, Rarity, AreaLevel, …)
        const oldNonBase = oldBlock.conditions.filter((c) => c.type !== 'BaseType')
        const newNonBase = updatedBlock.conditions.filter((c) => c.type !== 'BaseType')
        const thresholdTypes = new Set(['StackSize', 'Quality', 'MemoryStrands'])
        const allTypes = new Set([...oldNonBase, ...newNonBase].map((c) => c.type))
        for (const condType of allTypes) {
          if (thresholdTypes.has(condType)) continue
          const oldC = oldNonBase.find((c) => c.type === condType)
          const newC = newNonBase.find((c) => c.type === condType)
          if (
            !oldC ||
            !newC ||
            oldC.operator !== newC.operator ||
            JSON.stringify(oldC.values) !== JSON.stringify(newC.values)
          ) {
            record({
              type: 'set-condition',
              target,
              payload: {
                condition: condType,
                operator: newC?.operator ?? '==',
                values: newC ? [...newC.values] : [],
              },
              timestamp: now,
            })
          }
        }
      }
      writeBlockEdit(currentFilter, blockIndex, updatedBlock)
      // Reload to get fresh parsed state
      const path = getProfileBackedSetting(store, 'filterPath')
      if (path) loadFilter(path)

      // Re-evaluate and send fresh overlay data
      const freshFilter = getCurrentFilter()
      if (freshFilter && item) {
        evaluateAndSend(item)
      }
      reloadFilterInGame()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle(
    'move-item-tier',
    (_event, baseType: string, fromBlockIndex: number, toBlockIndex: number, itemJson: string) => {
      const currentFilter = getCurrentFilter()
      if (!currentFilter) return { ok: false, error: 'No filter loaded' }
      try {
        const fromTier = currentFilter.blocks[fromBlockIndex]?.tierTag?.tier ?? `block #${fromBlockIndex + 1}`
        const toTier = currentFilter.blocks[toBlockIndex]?.tierTag?.tier ?? `block #${toBlockIndex + 1}`
        captureSnapshot(
          currentFilter.path,
          'tier-move',
          `Moved "${baseType}" from ${fromTier} to ${toTier}`,
          baseType,
          currentFilter.blocks[toBlockIndex]?.tierTag?.typePath,
        )
        // Record intent
        const fromBlock = currentFilter.blocks[fromBlockIndex]
        const toBlock = currentFilter.blocks[toBlockIndex]
        const fromCustom = customIdOf(fromBlock)
        const toCustom = customIdOf(toBlock)
        if (fromCustom || toCustom) {
          applyCustomRetier(
            store,
            currentFilter.path,
            [baseType],
            fromCustom,
            toCustom,
            toBlock?.tierTag?.typePath,
            itemJson,
          )
          return { ok: true }
        }
        if (toBlock.tierTag && fromBlock.tierTag) {
          record({
            type: 'move-basetype',
            target: { typePath: toBlock.tierTag.typePath, tier: toBlock.tierTag.tier },
            payload: { value: baseType, fromTier: fromBlock.tierTag.tier },
            timestamp: Date.now(),
          })
        }
        moveBaseTypeBetweenTiers(currentFilter, baseType, fromBlockIndex, toBlockIndex)
        // Reload to get fresh parsed state
        const path = getProfileBackedSetting(store, 'filterPath')
        if (path) loadFilter(path)

        // Re-evaluate the item against the updated filter and send fresh data
        const freshFilter = getCurrentFilter()
        if (freshFilter && itemJson) {
          const item: PoeItem = JSON.parse(itemJson)
          evaluateAndSend(item)
        }

        if (store.get('reloadOnSave') !== false) reloadFilterInGame()

        return { ok: true }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    },
  )

  ipcMain.handle(
    'batch-move-item-tier',
    (_event, baseTypes: string[], fromBlockIndex: number, toBlockIndex: number, itemJson: string) => {
      const currentFilter = getCurrentFilter()
      if (!currentFilter) return { ok: false, error: 'No filter loaded' }
      try {
        const fromTier = currentFilter.blocks[fromBlockIndex]?.tierTag?.tier ?? `block #${fromBlockIndex + 1}`
        const toTier = currentFilter.blocks[toBlockIndex]?.tierTag?.tier ?? `block #${toBlockIndex + 1}`
        captureSnapshot(
          currentFilter.path,
          'tier-move',
          `Moved ${baseTypes.length} items from ${fromTier} to ${toTier}`,
        )
        for (const bt of baseTypes) {
          // Record intent
          const fromBlock = currentFilter.blocks[fromBlockIndex]
          const toBlock = currentFilter.blocks[toBlockIndex]
          const fromCustom = customIdOf(fromBlock)
          const toCustom = customIdOf(toBlock)
          if (fromCustom || toCustom) {
            applyCustomRetier(
              store,
              currentFilter.path,
              baseTypes,
              fromCustom,
              toCustom,
              toBlock?.tierTag?.typePath,
              itemJson,
            )
            return { ok: true }
          }
          if (toBlock.tierTag && fromBlock.tierTag) {
            record({
              type: 'move-basetype',
              target: { typePath: toBlock.tierTag.typePath, tier: toBlock.tierTag.tier },
              payload: { value: bt, fromTier: fromBlock.tierTag.tier },
              timestamp: Date.now(),
            })
          }
          moveBaseTypeBetweenTiers(currentFilter, bt, fromBlockIndex, toBlockIndex)
        }
        const path = getProfileBackedSetting(store, 'filterPath')
        if (path) loadFilter(path)

        const freshFilter = getCurrentFilter()
        if (freshFilter && itemJson) {
          try {
            const item: PoeItem = JSON.parse(itemJson)
            evaluateAndSend(item)
          } catch {
            /* item may no longer match any block after batch move - that's ok */
          }
        }

        if (store.get('reloadOnSave') !== false) reloadFilterInGame()

        return { ok: true }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    },
  )

  ipcMain.handle('update-stack-thresholds', (_event, oldBoundary: number, newBoundary: number, itemJson: string) => {
    const currentFilter = getCurrentFilter()
    if (!currentFilter) return { ok: false, error: 'No filter loaded' }
    try {
      const item: PoeItem | undefined = itemJson ? JSON.parse(itemJson) : undefined
      captureSnapshot(
        currentFilter.path,
        'stack-threshold',
        `Changed stack boundary ${oldBoundary} \u2192 ${newBoundary}`,
        item?.baseType,
      )
      // Record threshold intent - find the block that owns this threshold
      for (const block of currentFilter.blocks) {
        if (!block.tierTag) continue
        const hasThreshold = block.conditions.some(
          (c) => c.type === 'StackSize' && parseInt(c.values[0], 10) === oldBoundary,
        )
        if (hasThreshold) {
          record({
            type: 'set-threshold',
            target: { typePath: block.tierTag.typePath, tier: block.tierTag.tier },
            payload: {
              condition: 'StackSize',
              operator: block.conditions.find((c) => c.type === 'StackSize')?.operator ?? '>=',
              value: newBoundary,
            },
            timestamp: Date.now(),
          })
        }
      }
      updateStackThresholds(currentFilter, oldBoundary, newBoundary)
      // Reload to get fresh parsed state
      const path = getProfileBackedSetting(store, 'filterPath')
      if (path) loadFilter(path)

      // Re-evaluate and send fresh data
      const freshFilter = getCurrentFilter()
      if (freshFilter && item) {
        evaluateAndSend(item)
      }

      if (store.get('reloadOnSave') !== false) reloadFilterInGame()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('update-quality-thresholds', (_event, oldBoundary: number, newBoundary: number, itemJson: string) => {
    const currentFilter = getCurrentFilter()
    if (!currentFilter) return { ok: false, error: 'No filter loaded' }
    try {
      const item: PoeItem | undefined = itemJson ? JSON.parse(itemJson) : undefined
      captureSnapshot(
        currentFilter.path,
        'stack-threshold',
        `Changed quality boundary ${oldBoundary} \u2192 ${newBoundary}`,
        item?.baseType,
      )
      // Record threshold intent
      for (const block of currentFilter.blocks) {
        if (!block.tierTag) continue
        const hasThreshold = block.conditions.some(
          (c) => c.type === 'Quality' && parseInt(c.values[0], 10) === oldBoundary,
        )
        if (hasThreshold) {
          record({
            type: 'set-threshold',
            target: { typePath: block.tierTag.typePath, tier: block.tierTag.tier },
            payload: {
              condition: 'Quality',
              operator: block.conditions.find((c) => c.type === 'Quality')?.operator ?? '>=',
              value: newBoundary,
            },
            timestamp: Date.now(),
          })
        }
      }
      updateQualityThresholds(currentFilter, oldBoundary, newBoundary)
      const path = getProfileBackedSetting(store, 'filterPath')
      if (path) loadFilter(path)
      const freshFilter = getCurrentFilter()
      if (freshFilter && item) {
        evaluateAndSend(item)
      }
      if (store.get('reloadOnSave') !== false) reloadFilterInGame()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('update-strand-thresholds', (_event, oldBoundary: number, newBoundary: number, itemJson: string) => {
    const currentFilter = getCurrentFilter()
    if (!currentFilter) return { ok: false, error: 'No filter loaded' }
    try {
      const item: PoeItem | undefined = itemJson ? JSON.parse(itemJson) : undefined
      captureSnapshot(
        currentFilter.path,
        'strand-threshold',
        `Changed strand boundary ${oldBoundary} \u2192 ${newBoundary}`,
        item?.baseType,
      )
      for (const block of currentFilter.blocks) {
        if (!block.tierTag) continue
        const hasThreshold = block.conditions.some(
          (c) => c.type === 'MemoryStrands' && parseInt(c.values[0], 10) === oldBoundary,
        )
        if (hasThreshold) {
          record({
            type: 'set-threshold',
            target: { typePath: block.tierTag.typePath, tier: block.tierTag.tier },
            payload: {
              condition: 'MemoryStrands',
              operator: block.conditions.find((c) => c.type === 'MemoryStrands')?.operator ?? '>=',
              value: newBoundary,
            },
            timestamp: Date.now(),
          })
        }
      }
      updateStrandThresholds(currentFilter, oldBoundary, newBoundary)
      const path = getProfileBackedSetting(store, 'filterPath')
      if (path) loadFilter(path)
      const freshFilter = getCurrentFilter()
      if (freshFilter && item) evaluateAndSend(item)
      if (store.get('reloadOnSave') !== false) reloadFilterInGame()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('reload-filter', () => {
    const path = getProfileBackedSetting(store, 'filterPath')
    if (!path) return { ok: false, error: 'No filter path set' }
    return { ok: !!loadFilter(path) }
  })

  ipcMain.handle('get-filter-changes', (): FilterChange[] => {
    const { intents } = getIntents()
    return intents
      .map((intent) => {
        const { description, itemName } = describeIntent(intent)
        const id = `${intent.type}-${intent.target.typePath}-${intent.target.tier}-${intent.timestamp}`
        return {
          id,
          description,
          itemName,
          timestamp: intent.timestamp,
          typePath: intent.target.typePath,
          tier: intent.target.tier,
          intentType: intent.type,
        }
      })
      .sort((a, b) => b.timestamp - a.timestamp)
  })

  ipcMain.handle('parse-item-text', (_event, text: string): ParsedClipboardItem => {
    try {
      const item = parseItemText(text ?? '')
      if (!item) return { ok: false, error: 'Clipboard is not a PoE item (need Item Class / Rarity header)' }
      return {
        ok: true,
        baseType: item.baseType,
        name: item.name,
        itemClass: item.itemClass,
        rarity: item.rarity,
        stackSize: item.stackSize || 1,
        itemLevel: item.itemLevel,
        quality: item.quality,
        areaLevel: item.areaLevel,
        corrupted: item.corrupted,
        identified: item.identified,
      }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('match-filter-item', (_event, req: FilterMatchRequest): FilterMatchResponse => {
    const currentFilter = ensureFilterLoaded(store)
    if (!currentFilter) return { ok: false, error: 'No filter loaded', winnerIndex: null, steps: [] }

    let item: PoeItem
    if (req.clipboardText?.includes('--------')) {
      const parsed = parseItemText(req.clipboardText)
      if (!parsed) {
        return { ok: false, error: 'Could not parse clipboard item', winnerIndex: null, steps: [] }
      }
      item = parsed
    } else {
      const baseType = (req.baseType ?? '').trim()
      if (!baseType) return { ok: false, error: 'BaseType required', winnerIndex: null, steps: [] }
      item = buildSyntheticItem({ ...req, baseType })
    }

    const matches = findMatchingBlocks(currentFilter, item, true, !!req.includeShadowed)
    const steps = matchStepsFromResults(matches)
    const winner = steps.find((s) => s.isWinner) ?? null

    let breakpoints: FilterMatchResponse['breakpoints']
    try {
      const bps = findStackSizeBreakpoints(currentFilter, item)
      if (bps.length > 1) {
        breakpoints = bps.map((bp) => ({
          min: bp.min,
          max: bp.max === Infinity ? 9999 : bp.max,
          blockIndex: bp.activeMatch?.blockIndex ?? null,
          label: bp.activeMatch
            ? bp.activeMatch.block.tierTag
              ? `${bp.activeMatch.block.tierTag.typePath}/${bp.activeMatch.block.tierTag.tier}`
              : `Block #${bp.activeMatch.blockIndex + 1}`
            : '(no match)',
        }))
      }
    } catch {
      /* ignore */
    }

    return { ok: true, winnerIndex: winner?.blockIndex ?? null, steps, breakpoints }
  })

  ipcMain.handle('get-last-evaluated-item', (): ParsedClipboardItem => {
    const item = getLastEvaluatedItem()
    if (!item) return { ok: false, error: 'No item evaluated yet — Ctrl+C an item in PoE first' }
    return {
      ok: true,
      baseType: item.baseType,
      name: item.name,
      itemClass: item.itemClass,
      rarity: item.rarity,
      stackSize: item.stackSize || 1,
      itemLevel: item.itemLevel,
      quality: item.quality,
      areaLevel: item.areaLevel,
      corrupted: item.corrupted,
      identified: item.identified,
    }
  })

  ipcMain.handle('preview-basetype-move', (_event, baseType: string, toBlockIndex: number): MoveConflictPreview => {
    const currentFilter = ensureFilterLoaded(store)
    if (!currentFilter)
      return { ok: false, error: 'No filter loaded', becomesWinner: false, currentWinnerIndex: null, steps: [] }
    const name = (baseType ?? '').trim()
    if (!name)
      return { ok: false, error: 'BaseType required', becomesWinner: false, currentWinnerIndex: null, steps: [] }
    const dest = currentFilter.blocks[toBlockIndex]
    if (!dest)
      return {
        ok: false,
        error: 'Destination block not found',
        becomesWinner: false,
        currentWinnerIndex: null,
        steps: [],
      }

    const item = buildSyntheticItem({ baseType: name })
    // Simulate item as if already only in destination: evaluate against filter where
    // we temporarily ensure BaseType is on dest for matching dest conditions.
    const matches = findMatchingBlocks(currentFilter, item, true, true)
    const steps = matchStepsFromResults(matches)
    const winner = steps.find((s) => s.isWinner)
    const destTag = dest.tierTag
    const destLabel = destTag ? `${destTag.typePath}/${destTag.tier}` : `Block #${toBlockIndex + 1}`

    // After move, dest becomes a candidate. If an earlier non-Continue match exists
    // before toBlockIndex, the move won't change in-game look.
    const earlierWinner = matches.find((m) => m.isFirstMatch && m.blockIndex < toBlockIndex)
    const destWouldMatch = (() => {
      const nonBase = dest.conditions.filter((c) => c.type !== 'BaseType')
      const eval_ = evaluateBlock({ conditions: nonBase }, item)
      return eval_.matches || nonBase.length === 0
    })()

    let warning: string | undefined
    let becomesWinner = false
    if (!destWouldMatch) {
      warning = `${destLabel} conditions may not match a default “${name}” (e.g. StackSize / Class).`
    } else if (earlierWinner) {
      const tag = earlierWinner.block.tierTag
      const label = tag ? `${tag.typePath}/${tag.tier}` : `Block #${earlierWinner.blockIndex + 1}`
      warning = `An earlier rule still wins (${label} · ${earlierWinner.block.visibility}). Moving here won’t change in-game look unless you insert above it or change conditions.`
    } else if (!winner || winner.blockIndex >= toBlockIndex) {
      becomesWinner = true
    } else {
      becomesWinner = winner.blockIndex === toBlockIndex
    }

    return {
      ok: true,
      becomesWinner,
      currentWinnerIndex: winner?.blockIndex ?? null,
      currentWinnerLabel: winner?.label,
      warning,
      steps,
    }
  })

  ipcMain.handle('diff-filter-files', (_event, leftPath: string, rightPath: string): FilterVersionDiff => {
    try {
      if (!leftPath || !rightPath) {
        return { ok: false, error: 'Pick two filters', sections: [], changedSectionCount: 0 }
      }
      if (!existsSync(leftPath) || !existsSync(rightPath)) {
        return { ok: false, error: 'Filter file not found', sections: [], changedSectionCount: 0 }
      }
      const left = parseFilterFile(leftPath, readFileSync(leftPath, 'utf-8'))
      const right = parseFilterFile(rightPath, readFileSync(rightPath, 'utf-8'))
      return sectionDiffBetween(left, right, basename(leftPath, '.filter'), basename(rightPath, '.filter'))
    } catch (err) {
      return { ok: false, error: String(err), sections: [], changedSectionCount: 0 }
    }
  })

  ipcMain.handle('diff-filter-vs-version', (_event, versionFilename: string): FilterVersionDiff => {
    const filterPath = getProfileBackedSetting(store, 'filterPath') as string | undefined
    if (!filterPath) return { ok: false, error: 'No filter path set', sections: [], changedSectionCount: 0 }
    const current = getCurrentFilter()
    if (!current) return { ok: false, error: 'No filter loaded', sections: [], changedSectionCount: 0 }

    const ver = readVersionContent(versionFilename)
    if (!ver.ok) return { ok: false, error: ver.error, sections: [], changedSectionCount: 0 }

    try {
      const otherFilter = parseFilterFile(filterPath, ver.content)
      const currentSections = buildFilterSections(current)
      const otherSections = buildFilterSections(otherFilter)
      const otherByPath = new Map(otherSections.map((s) => [s.typePath, s]))
      const out: SectionDiffTier[] = []

      for (const cur of currentSections) {
        const oth = otherByPath.get(cur.typePath)
        const curBases = new Set(cur.tiers.flatMap((t) => t.baseTypes))
        const othBases = new Set(oth?.tiers.flatMap((t) => t.baseTypes) ?? [])
        const onlyCurrent = [...curBases].filter((b) => !othBases.has(b)).sort()
        const onlyOther = [...othBases].filter((b) => !curBases.has(b)).sort()

        const visibilityChanges: SectionDiffTier['visibilityChanges'] = []
        if (oth) {
          const othTierVis = new Map(oth.tiers.map((t) => [t.tier, t.visibility]))
          for (const t of cur.tiers) {
            const ov = othTierVis.get(t.tier)
            if (ov && ov !== t.visibility) {
              visibilityChanges.push({ tier: t.tier, current: t.visibility, other: ov })
            }
          }
        }

        if (onlyCurrent.length || onlyOther.length || visibilityChanges.length || !oth) {
          out.push({
            typePath: cur.typePath,
            title: cur.title,
            onlyCurrent,
            onlyOther: oth ? onlyOther : [...othBases].sort(),
            visibilityChanges,
          })
        }
        otherByPath.delete(cur.typePath)
      }

      for (const oth of otherByPath.values()) {
        out.push({
          typePath: oth.typePath,
          title: oth.title,
          onlyCurrent: [],
          onlyOther: [...new Set(oth.tiers.flatMap((t) => t.baseTypes))].sort(),
          visibilityChanges: [],
        })
      }

      out.sort((a, b) => a.title.localeCompare(b.title))
      return {
        ok: true,
        versionLabel: versionFilename,
        sections: out,
        changedSectionCount: out.length,
      }
    } catch (err) {
      return { ok: false, error: String(err), sections: [], changedSectionCount: 0 }
    }
  })

  ipcMain.handle('get-recent-evaluated-items', (): ParsedClipboardItem[] => {
    return getRecentEvaluatedItems().map((item) => ({
      ok: true as const,
      baseType: item.baseType,
      name: item.name,
      itemClass: item.itemClass,
      rarity: item.rarity,
      stackSize: item.stackSize || 1,
      itemLevel: item.itemLevel,
      quality: item.quality,
      areaLevel: item.areaLevel,
      corrupted: item.corrupted,
      identified: item.identified,
    }))
  })

  ipcMain.handle('preflight-filter-check', (): FilterPreflightResult => {
    const currentFilter = ensureFilterLoaded(store)
    if (!currentFilter) return { ok: false, error: 'No filter loaded', issues: [] }
    const issues: FilterPreflightIssue[] = []
    const minimapBySection = new Map<string, Array<{ blockIndex: number; tier: string; key: string }>>()

    const filterDir = getProfileBackedSetting(store, 'filterDir') as string | undefined
    let soundNames = new Set<string>()
    if (filterDir && existsSync(filterDir)) {
      try {
        const soundExts = new Set(['.mp3', '.wav', '.ogg'])
        const collect = (dir: string, prefix = ''): void => {
          for (const f of readdirSync(dir)) {
            const ext = extname(f).toLowerCase()
            if (soundExts.has(ext)) soundNames.add((prefix + f).toLowerCase())
          }
        }
        collect(filterDir)
        const soundsDir = join(filterDir, 'sounds')
        if (existsSync(soundsDir)) collect(soundsDir, 'sounds/')
      } catch {
        soundNames = new Set()
      }
    }

    for (let i = 0; i < currentFilter.blocks.length; i++) {
      const b = currentFilter.blocks[i]
      const tag = b.tierTag
      const typePath = tag?.typePath
      const tier = tag?.tier
      const baseCond = b.conditions.find((c) => c.type === 'BaseType')
      if (baseCond && baseCond.values.length === 0) {
        issues.push({
          id: `empty-bt-${i}`,
          severity: 'error',
          message: 'Empty BaseType list (dangling BaseType ==)',
          typePath,
          tier,
          blockIndex: i,
        })
      }
      if (b.conditions.length === 0) {
        issues.push({
          id: `catchall-${i}`,
          severity: 'error',
          message: 'Condition-less block (matches everything)',
          typePath,
          tier,
          blockIndex: i,
        })
      }
      for (const a of b.actions) {
        if ((a.type === 'CustomAlertSound' || a.type === 'CustomAlertSoundOptional') && a.values[0]) {
          const pathVal = a.values[0].trim()
          if (!pathVal) {
            issues.push({
              id: `snd-empty-${i}`,
              severity: 'warn',
              message: 'CustomAlertSound with empty path',
              typePath,
              tier,
              blockIndex: i,
            })
          } else if (soundNames.size > 0) {
            const base = pathVal.replace(/^.*[\\/]/, '').toLowerCase()
            const full = pathVal.replace(/\\/g, '/').toLowerCase()
            if (![...soundNames].some((s) => s === base || s.endsWith('/' + base) || s === full || s.endsWith(full))) {
              issues.push({
                id: `snd-miss-${i}-${base}`,
                severity: 'warn',
                message: `Missing custom sound: ${pathVal}`,
                typePath,
                tier,
                blockIndex: i,
              })
            }
          }
        }
      }
      const mm = b.actions.find((a) => a.type === 'MinimapIcon')
      if (mm && typePath) {
        const key = mm.values.join('|')
        const list = minimapBySection.get(typePath) ?? []
        list.push({ blockIndex: i, tier: tier ?? String(i), key })
        minimapBySection.set(typePath, list)
      }
    }

    for (const [typePath, list] of minimapBySection) {
      for (let a = 0; a < list.length; a++) {
        for (let b = a + 1; b < list.length; b++) {
          if (list[a].key === list[b].key && Math.abs(list[a].blockIndex - list[b].blockIndex) <= 3) {
            issues.push({
              id: `mm-${list[a].blockIndex}-${list[b].blockIndex}`,
              severity: 'warn',
              message: `Adjacent tiers share identical MinimapIcon (${list[a].tier} & ${list[b].tier})`,
              typePath,
              blockIndex: list[a].blockIndex,
            })
          }
        }
      }
    }

    return { ok: true, issues }
  })

  ipcMain.handle(
    'apply-section-delta',
    async (_event, req: ApplySectionDeltaRequest): Promise<ApplySectionDeltaResult> => {
      const currentFilter = ensureFilterLoaded(store)
      if (!currentFilter) return { ok: false, error: 'No filter loaded', added: 0, removed: 0, visibilityChanged: 0 }
      if (!req?.typePath || !req.sourcePath) {
        return { ok: false, error: 'typePath and sourcePath required', added: 0, removed: 0, visibilityChanged: 0 }
      }
      if (!existsSync(req.sourcePath)) {
        return { ok: false, error: 'Source filter not found', added: 0, removed: 0, visibilityChanged: 0 }
      }
      try {
        const source = parseFilterFile(req.sourcePath, readFileSync(req.sourcePath, 'utf-8'))
        const srcSections = buildFilterSections(source)
        const curSections = buildFilterSections(currentFilter)
        const src = srcSections.find((s) => s.typePath === req.typePath)
        const cur = curSections.find((s) => s.typePath === req.typePath)
        if (!src) return { ok: false, error: 'Section missing in source', added: 0, removed: 0, visibilityChanged: 0 }
        if (!cur)
          return { ok: false, error: 'Section missing in current filter', added: 0, removed: 0, visibilityChanged: 0 }

        let added = 0
        let removed = 0
        let visibilityChanged = 0

        const curBases = new Set(cur.tiers.flatMap((t) => t.baseTypes))
        const srcBases = new Set(src.tiers.flatMap((t) => t.baseTypes))
        const targetTier = cur.tiers.find((t) => t.visibility === 'Show') ?? cur.tiers[0] ?? null

        if (req.addMissingFromSource && targetTier) {
          for (const base of srcBases) {
            if (curBases.has(base)) continue
            addBaseTypeToTier(currentFilter, targetTier.blockIndex, base)
            added++
            curBases.add(base)
          }
        }

        if (req.removeExtrasNotInSource) {
          for (const tier of cur.tiers) {
            for (const base of [...tier.baseTypes]) {
              if (srcBases.has(base)) continue
              removeBaseTypeFromTier(currentFilter, tier.blockIndex, base)
              removed++
            }
          }
        }

        if (req.applyVisibilityFromSource) {
          const srcVis = new Map(src.tiers.map((t) => [t.tier, t.visibility]))
          // Reload after mutations
          const path = getProfileBackedSetting(store, 'filterPath') as string
          if (path) loadFilter(path)
          const fresh = getCurrentFilter()
          if (fresh) {
            const freshSections = buildFilterSections(fresh)
            const freshCur = freshSections.find((s) => s.typePath === req.typePath)
            for (const tier of freshCur?.tiers ?? []) {
              const want = srcVis.get(tier.tier)
              if (!want || want === tier.visibility) continue
              const block = fresh.blocks[tier.blockIndex]
              if (!block) continue
              writeBlockEdit(fresh, tier.blockIndex, { ...block, visibility: want })
              visibilityChanged++
              if (block.tierTag) {
                record({
                  type: 'set-visibility',
                  target: { typePath: block.tierTag.typePath, tier: block.tierTag.tier },
                  payload: { visibility: want },
                  timestamp: Date.now(),
                })
              }
            }
          }
        }

        const path = getProfileBackedSetting(store, 'filterPath') as string
        if (path) {
          captureSnapshot(path, 'block-edit', `Applied section delta for ${req.typePath}`, undefined, req.typePath)
          loadFilter(path)
        }
        if (store.get('reloadOnSave') !== false) reloadFilterInGame()
        return { ok: true, added, removed, visibilityChanged }
      } catch (err) {
        return { ok: false, error: String(err), added: 0, removed: 0, visibilityChanged: 0 }
      }
    },
  )

  ipcMain.handle('export-filter-intents', () => {
    const log = getIntents()
    return {
      ok: true as const,
      filterName: log.filterName,
      intentCount: log.intents.length,
      json: JSON.stringify(log, null, 2),
    }
  })

  ipcMain.handle(
    'import-filter-intents',
    (
      _event,
      payload: { json: string; mode: 'replace' | 'merge'; replay?: boolean },
    ): { ok: boolean; error?: string; imported?: number; applied?: number; skipped?: number } => {
      try {
        const parsed = JSON.parse(payload.json) as { filterName?: string; intents?: unknown[] }
        if (!parsed || !Array.isArray(parsed.intents)) {
          return { ok: false, error: 'Invalid edit pack (expected { intents: [...] })' }
        }
        const intents = parsed.intents as import('../filter/intents').Intent[]
        if (payload.mode === 'replace') {
          replaceIntents({ filterName: parsed.filterName || getIntents().filterName, intents })
        } else {
          mergeIntents(intents)
        }
        const applied = 0
        const skipped = 0
        if (payload.replay) {
          const currentFilter = ensureFilterLoaded(store)
          if (!currentFilter) return { ok: false, error: 'No filter loaded' }
          // Replay is done via re-apply path; here we only import the log.
          // Callers can use apply-filter-reapply separately. Count as imported only.
        }
        return { ok: true, imported: intents.length, applied, skipped }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    },
  )

  ipcMain.handle(
    'find-filter-conditions',
    (
      _event,
      query: {
        conditionType?: string
        valueContains?: string
        missingAction?: string
        typePath?: string
      },
    ): {
      ok: boolean
      error?: string
      hits: Array<{
        blockIndex: number
        typePath?: string
        tier?: string
        label: string
        visibility: string
        match: string
      }>
    } => {
      const currentFilter = ensureFilterLoaded(store)
      if (!currentFilter) return { ok: false, error: 'No filter loaded', hits: [] }
      const hits: Array<{
        blockIndex: number
        typePath?: string
        tier?: string
        label: string
        visibility: string
        match: string
      }> = []
      const condType = query.conditionType?.trim()
      const valueQ = query.valueContains?.trim().toLowerCase()
      const missing = query.missingAction?.trim()
      const pathQ = query.typePath?.trim().toLowerCase()

      for (let i = 0; i < currentFilter.blocks.length; i++) {
        const b = currentFilter.blocks[i]
        const tag = b.tierTag
        if (pathQ && !(tag?.typePath ?? '').toLowerCase().includes(pathQ)) continue
        const label = tag ? `${tag.typePath}/${tag.tier}` : `Block #${i + 1}`

        if (missing) {
          if (!b.actions.some((a) => a.type === missing && a.values.length > 0)) {
            hits.push({
              blockIndex: i,
              typePath: tag?.typePath,
              tier: tag?.tier,
              label,
              visibility: b.visibility,
              match: `missing ${missing}`,
            })
          }
          continue
        }

        for (const c of b.conditions) {
          if (condType && c.type !== condType) continue
          if (
            valueQ &&
            !c.values.some((v) => v.toLowerCase().includes(valueQ)) &&
            !String(c.operator).includes(valueQ)
          ) {
            if (condType) {
              // type matched but value didn't — skip unless no value filter
              continue
            }
            continue
          }
          if (!condType && !valueQ) continue
          if (condType && !valueQ) {
            hits.push({
              blockIndex: i,
              typePath: tag?.typePath,
              tier: tag?.tier,
              label,
              visibility: b.visibility,
              match: `${c.type} ${c.operator} ${c.values.join(' ')}`,
            })
            break
          }
          if (valueQ) {
            const okType = !condType || c.type === condType
            const okVal = c.values.some((v) => v.toLowerCase().includes(valueQ))
            if (okType && okVal) {
              hits.push({
                blockIndex: i,
                typePath: tag?.typePath,
                tier: tag?.tier,
                label,
                visibility: b.visibility,
                match: `${c.type} ${c.operator} ${c.values.join(' ')}`,
              })
              break
            }
          }
        }
      }
      return { ok: true, hits: hits.slice(0, 200) }
    },
  )
}

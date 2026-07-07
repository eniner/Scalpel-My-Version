import type { CraftItemStateResult } from '@scalpelpoe/plugin-sdk'
import type { PoeItem } from '@scalpelpoe/plugin-sdk'
import { craftStateToPoeItem, poeItemToCraftState } from './craft-session'

const MARKSMAN_IMPLICIT = /can roll marksman modifiers/i

export interface CraftBuildContext {
  /** Belt or quiver with "Can roll Marksman modifiers" — applies to all gear in session. */
  marksmanSource: PoeItem | null
}

export const EMPTY_BUILD_CONTEXT: CraftBuildContext = { marksmanSource: null }

export function itemHasMarksmanImplicit(item: PoeItem): boolean {
  const lines = [...(item.implicits ?? []), ...(item.imbues ?? []), ...(item.enchants ?? [])]
  return lines.some((line) => MARKSMAN_IMPLICIT.test(line))
}

export function isMarksmanGearSlot(item: PoeItem): boolean {
  const c = item.itemClass.toLowerCase()
  return c.includes('belt') || c.includes('quiver')
}

/** Marksman pool active when crafting item has the implicit or worn belt/quiver does. */
export function resolveMarksmanEnabled(item: PoeItem | null, ctx: CraftBuildContext): boolean {
  if (item && itemHasMarksmanImplicit(item)) return true
  if (ctx.marksmanSource && itemHasMarksmanImplicit(ctx.marksmanSource)) return true
  return false
}

export function withMarksmanContext(
  state: CraftItemStateResult,
  ctx: CraftBuildContext,
  craftItem?: PoeItem | null,
): CraftItemStateResult {
  const item = craftItem ?? craftStateToPoeItem(state)
  return {
    ...state,
    marksmanEnabled: resolveMarksmanEnabled(item, ctx),
  }
}

export interface CraftTabProps {
  buildContext: CraftBuildContext
  onSmartImport: () => Promise<string | null>
}

export interface SmartImportResult {
  buildContext: CraftBuildContext
  craftItem?: PoeItem
  sessionState?: CraftItemStateResult
  contextOnly: boolean
  message: string
}

/** Belt/quiver → worn context; other items → craft session with inherited marksman. */
export function processHoveredImport(parsed: PoeItem, ctx: CraftBuildContext): SmartImportResult {
  if (isMarksmanGearSlot(parsed)) {
    const hasMarksman = itemHasMarksmanImplicit(parsed)
    const buildContext: CraftBuildContext = {
      marksmanSource: hasMarksman ? parsed : null,
    }
    return {
      buildContext,
      contextOnly: true,
      message: hasMarksman
        ? `Worn ${parsed.baseType} — marksman pool enabled for all gear`
        : `Worn ${parsed.baseType} — no marksman implicit (pool cleared)`,
    }
  }
  const sessionState = poeItemToCraftState(parsed, ctx)
  return {
    buildContext: ctx,
    craftItem: parsed,
    sessionState,
    contextOnly: false,
    message: `Imported ${parsed.rarity} ${parsed.baseType}${
      sessionState.marksmanEnabled ? ' · marksman pool on' : ''
    }`,
  }
}

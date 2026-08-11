import { ipcMain } from 'electron'
import type { PoeItem } from '@shared/types'
import {
  applyCraftAction,
  buildModPoolReport,
  computeTargetHit,
  createFreshItemState,
  itemStateFromPoeItem,
  listCraftActions,
  listItemClasses,
  loadCoeCatalog,
  searchBaseTypes,
  searchModTiers,
  simulateCraft,
  simulateCraftPath,
  estimateCraftSequence,
} from '@shared/crafting'
import type { CoeCatalog, CraftSequenceConfig, CraftSequenceRunResult } from '@shared/crafting'
import type {
  CraftAction,
  CraftApplyResult,
  CraftItemState,
  CraftPathResult,
  CraftResolveOpts,
  CraftSimulationResult,
} from '@shared/crafting/types'
import type { CraftApplyOptions } from '@shared/crafting/types'
import type { TargetCraftResult } from '@shared/crafting/target-hit'
import type { ModPoolReport } from '@shared/crafting/mod-pool'
import type { ModSearchHit } from '@shared/crafting/mod-search'
import { getCraftDataset } from '../crafting-data'
import { getPoeVersion } from '../game-state'
import { lookupPrice } from '../trade/prices'

const PLUGIN_ID_PATTERN = /^[\w-]+$/

function assertPoe2(): void {
  if (getPoeVersion() !== 2) throw new Error('Craft simulation is PoE 2 only.')
}

/** Live ninja/EE prices as chaos-relative overrides (Chaos Orb = 1). */
function liveChaosPriceOverrides(names: string[]): Record<string, number> {
  const chaosInfo = lookupPrice('Chaos Orb', 'Chaos Orb')
  const chaosUnit = chaosInfo?.chaosValue && chaosInfo.chaosValue > 0 ? chaosInfo.chaosValue : 0
  if (!chaosUnit) return {}
  const out: Record<string, number> = {}
  for (const name of names) {
    const info = lookupPrice(name, name)
    if (!info?.chaosValue || info.chaosValue <= 0) continue
    out[name] = info.chaosValue / chaosUnit
  }
  return out
}

function resolveState(item: PoeItem, opts?: CraftResolveOpts) {
  const data = getCraftDataset()
  if (!data) throw new Error('Crafting data not loaded.')
  return { data, state: itemStateFromPoeItem(data, item, opts) }
}

export function registerPluginCraftHandlers(): void {
  ipcMain.handle(
    'plugins:craft-list-actions',
    (_evt, _pluginId: string, item: PoeItem, opts?: CraftResolveOpts): CraftAction[] => {
      if (!PLUGIN_ID_PATTERN.test(_pluginId)) throw new Error('invalid plugin id')
      assertPoe2()
      const { data, state } = resolveState(item, opts)
      return listCraftActions(data, state)
    },
  )

  ipcMain.handle(
    'plugins:craft-simulate',
    (
      _evt,
      _pluginId: string,
      item: PoeItem,
      actionId: string,
      opts?: CraftResolveOpts,
    ): CraftSimulationResult => {
      if (!PLUGIN_ID_PATTERN.test(_pluginId)) throw new Error('invalid plugin id')
      assertPoe2()
      const { data, state } = resolveState(item, opts)
      if (!state) throw new Error(`Unknown base type "${item.baseType}" for crafting.`)
      return simulateCraft(data, state, actionId, {
        omens: opts?.omens ?? state.activeOmens,
      })
    },
  )

  ipcMain.handle(
    'plugins:craft-apply',
    (
      _evt,
      _pluginId: string,
      state: CraftItemState,
      actionId: string,
      seed?: number,
      opts?: CraftApplyOptions,
    ): CraftApplyResult => {
      if (!PLUGIN_ID_PATTERN.test(_pluginId)) throw new Error('invalid plugin id')
      assertPoe2()
      const data = getCraftDataset()
      if (!data) throw new Error('Crafting data not loaded.')
      if (!data.bases[state.baseType]) throw new Error(`Unknown base type "${state.baseType}".`)
      return applyCraftAction(data, state, actionId, seed, opts)
    },
  )

  ipcMain.handle(
    'plugins:craft-fresh-state',
    (
      _evt,
      _pluginId: string,
      baseType: string,
      itemLevel: number,
      opts?: CraftResolveOpts,
    ): CraftItemState => {
      if (!PLUGIN_ID_PATTERN.test(_pluginId)) throw new Error('invalid plugin id')
      assertPoe2()
      const data = getCraftDataset()
      if (!data) throw new Error('Crafting data not loaded.')
      const state = createFreshItemState(data, baseType, itemLevel, opts)
      if (!state) throw new Error(`Unknown base type "${baseType}".`)
      return state
    },
  )

  ipcMain.handle(
    'plugins:craft-mod-pool',
    (
      _evt,
      _pluginId: string,
      opts: {
        baseType: string
        itemLevel: number
        kind?: 'all' | 'p' | 's'
        item?: PoeItem | null
        context?: 'fresh' | 'item'
        poolSource?: 'craft' | 'marksman' | 'desecrated' | 'all'
        marksmanEnabled?: boolean
        tierFloor?: number
        catalyst?: string
        quality?: number
      },
    ): ModPoolReport => {
      if (!PLUGIN_ID_PATTERN.test(_pluginId)) throw new Error('invalid plugin id')
      assertPoe2()
      const data = getCraftDataset()
      if (!data) throw new Error('Crafting data not loaded.')
      return buildModPoolReport(data, opts)
    },
  )

  ipcMain.handle(
    'plugins:craft-target-hit',
    (
      _evt,
      _pluginId: string,
      opts: {
        state: CraftItemState
        actionId: string
        targetQuery: string
        kind?: 'all' | 'p' | 's'
        samples?: number
        omens?: string[]
      },
    ): TargetCraftResult => {
      if (!PLUGIN_ID_PATTERN.test(_pluginId)) throw new Error('invalid plugin id')
      assertPoe2()
      const data = getCraftDataset()
      if (!data) throw new Error('Crafting data not loaded.')
      return computeTargetHit(data, opts)
    },
  )

  ipcMain.handle(
    'plugins:craft-path',
    (
      _evt,
      _pluginId: string,
      opts: {
        state: CraftItemState
        steps: Array<{ actionId: string; omens?: string[]; repeatUntilHit?: boolean }>
        targetQuery: string
        kind?: 'all' | 'p' | 's'
        maxTrials?: number
        samples?: number
      },
    ): CraftPathResult => {
      if (!PLUGIN_ID_PATTERN.test(_pluginId)) throw new Error('invalid plugin id')
      assertPoe2()
      const data = getCraftDataset()
      if (!data) throw new Error('Crafting data not loaded.')
      try {
        return simulateCraftPath(data, opts)
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Craft path simulation failed.')
      }
    },
  )

  ipcMain.handle(
    'plugins:craft-search-bases',
    (
      _evt,
      _pluginId: string,
      query: string,
      limit?: number,
      itemClass?: string,
    ): string[] => {
      if (!PLUGIN_ID_PATTERN.test(_pluginId)) throw new Error('invalid plugin id')
      assertPoe2()
      const data = getCraftDataset()
      if (!data) throw new Error('Crafting data not loaded.')
      return searchBaseTypes(data, query, limit ?? 50, itemClass || undefined)
    },
  )

  ipcMain.handle('plugins:craft-list-item-classes', (_evt, _pluginId: string): string[] => {
    if (!PLUGIN_ID_PATTERN.test(_pluginId)) throw new Error('invalid plugin id')
    assertPoe2()
    const data = getCraftDataset()
    if (!data) throw new Error('Crafting data not loaded.')
    return listItemClasses(data)
  })

  ipcMain.handle(
    'plugins:craft-search-mods',
    (
      _evt,
      _pluginId: string,
      opts: {
        query: string
        itemLevel?: number
        poolSource?: 'craft' | 'marksman' | 'desecrated' | 'all'
        itemClass?: string
        kind?: 'all' | 'p' | 's'
        limit?: number
      },
    ): ModSearchHit[] => {
      if (!PLUGIN_ID_PATTERN.test(_pluginId)) throw new Error('invalid plugin id')
      assertPoe2()
      const data = getCraftDataset()
      if (!data) throw new Error('Crafting data not loaded.')
      return searchModTiers(data, opts)
    },
  )

  ipcMain.handle('plugins:craft-get-catalog', async (_evt, _pluginId: string): Promise<CoeCatalog> => {
    if (!PLUGIN_ID_PATTERN.test(_pluginId)) throw new Error('invalid plugin id')
    assertPoe2()
    return loadCoeCatalog()
  })

  ipcMain.handle(
    'plugins:craft-sequence',
    async (_evt, _pluginId: string, config: CraftSequenceConfig): Promise<CraftSequenceRunResult> => {
      if (!PLUGIN_ID_PATTERN.test(_pluginId)) throw new Error('invalid plugin id')
      assertPoe2()
      const data = getCraftDataset()
      if (!data) throw new Error('Crafting data not loaded.')
      try {
        const currencyNames = [
          ...(data.currencies?.map((c) => c.name) ?? []),
          ...(data.essences?.map((e) => e.name) ?? []),
          ...(data.catalysts?.map((c) => c.name) ?? []),
        ]
        const live = liveChaosPriceOverrides(currencyNames)
        // NEVER Monte Carlo on the Electron main thread — that hard-froze Scalpel.
        // Pool-weight / light target-odds estimate only (milliseconds).
        const run = Promise.resolve().then(() =>
          estimateCraftSequence(data, {
            ...config,
            rarity: config.rarity ?? 'Normal',
            chaosPrices: { ...live, ...(config.chaosPrices ?? {}) },
          }),
        )
        const timeout = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error('Sequence estimate timed out (5s) — try Target Odds instead.')),
            5000,
          )
        })
        return await Promise.race([run, timeout])
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Sequence simulation failed.')
      }
    },
  )
}

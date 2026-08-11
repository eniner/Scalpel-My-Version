import type { CraftApi, ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import type { PoeItem } from '@scalpelpoe/plugin-sdk'

export const CRAFT_HOST_REQUIRED =
  'This Scalpel install has no crafting engine (stock Beta builds omit it). Use the monorepo app via `npm run launch` in scalpel-main — do not patch app.asar.'

type HostApi = {
  craftListActions?: (
    pluginId: string,
    item: PoeItem,
    opts?: Parameters<CraftApi['listActions']>[1],
  ) => ReturnType<CraftApi['listActions']>
  craftSimulate?: (
    pluginId: string,
    item: PoeItem,
    actionId: string,
    opts?: Parameters<CraftApi['simulate']>[2],
  ) => ReturnType<CraftApi['simulate']>
  craftApply?: (
    pluginId: string,
    state: Parameters<CraftApi['apply']>[0],
    actionId: string,
    seed?: number,
    opts?: Parameters<CraftApi['apply']>[3],
  ) => ReturnType<CraftApi['apply']>
  craftFreshState?: (
    pluginId: string,
    baseType: string,
    itemLevel: number,
    opts?: Parameters<CraftApi['freshState']>[2],
  ) => ReturnType<CraftApi['freshState']>
  craftTargetHit?: (
    pluginId: string,
    opts: Parameters<CraftApi['targetHit']>[0],
  ) => ReturnType<CraftApi['targetHit']>
  craftPath?: (
    pluginId: string,
    opts: Parameters<CraftApi['craftPath']>[0],
  ) => ReturnType<CraftApi['craftPath']>
  craftModPool?: (pluginId: string, opts: Parameters<CraftApi['modPool']>[0]) => ReturnType<CraftApi['modPool']>
  craftSearchBases?: (
    pluginId: string,
    query: string,
    limit?: number,
    itemClass?: string,
  ) => ReturnType<CraftApi['searchBases']>
  craftListItemClasses?: (pluginId: string) => ReturnType<CraftApi['listItemClasses']>
  craftGetCatalog?: (pluginId: string) => ReturnType<CraftApi['getCatalog']>
  craftSequence?: (
    pluginId: string,
    config: Parameters<CraftApi['sequence']>[0],
  ) => ReturnType<CraftApi['sequence']>
  craftSearchMods?: (
    pluginId: string,
    opts: Parameters<CraftApi['searchMods']>[0],
  ) => ReturnType<CraftApi['searchMods']>
}

function fromWindowApi(pluginId: string): CraftApi | null {
  const api = (globalThis as { api?: HostApi }).api
  if (
    !api?.craftListActions ||
    !api?.craftSimulate ||
    !api?.craftApply ||
    !api?.craftFreshState ||
    !api?.craftTargetHit ||
    !api?.craftModPool ||
    !api?.craftSearchBases ||
    !api?.craftPath
  ) {
    return null
  }
  return {
    listActions: (item, opts) => api.craftListActions!(pluginId, item, opts),
    simulate: (item, actionId, opts) => api.craftSimulate!(pluginId, item, actionId, opts),
    apply: (state, actionId, seed, opts) => api.craftApply!(pluginId, state, actionId, seed, opts),
    freshState: (baseType, itemLevel, opts) => api.craftFreshState!(pluginId, baseType, itemLevel, opts),
    targetHit: (opts) => api.craftTargetHit!(pluginId, opts),
    craftPath: (opts) => api.craftPath!(pluginId, opts),
    modPool: (opts) => api.craftModPool!(pluginId, opts),
    searchBases: (query, limit, itemClass) => api.craftSearchBases!(pluginId, query, limit, itemClass),
    listItemClasses: () => api.craftListItemClasses?.(pluginId) ?? Promise.resolve([]),
    getCatalog: () =>
      api.craftGetCatalog?.(pluginId) ??
      Promise.reject(new Error('Catalog API missing — relaunch via Launch Scalpel.bat to rebuild.')),
    sequence: (config) =>
      api.craftSequence?.(pluginId, config) ??
      Promise.reject(new Error('Sequence API missing — relaunch via Launch Scalpel.bat to rebuild.')),
    searchMods: (opts) => api.craftSearchMods?.(pluginId, opts) ?? Promise.resolve([]),
  }
}

function hasCraftApi(craft: Partial<CraftApi> | undefined): craft is CraftApi {
  return Boolean(
    craft?.listActions &&
      craft?.simulate &&
      craft?.apply &&
      craft?.freshState &&
      craft?.targetHit &&
      craft?.craftPath &&
      craft?.modPool &&
      craft?.searchBases,
  )
}

/** ctx.craft or window.api fallback (handles stale renderer bundles). */
export function resolveCraft(ctx: ScalpelPluginContext): CraftApi | null {
  if (hasCraftApi(ctx.craft as CraftApi | undefined)) {
    const craft = ctx.craft as CraftApi
    if (!craft.getCatalog || !craft.sequence) {
      const fallback = fromWindowApi(ctx.pluginId)
      if (fallback) {
        return {
          ...craft,
          getCatalog: craft.getCatalog ?? fallback.getCatalog,
          sequence: craft.sequence ?? fallback.sequence,
        }
      }
    }
    return craft
  }
  return fromWindowApi(ctx.pluginId)
}

/**
 * Renderer-side Filter API for plugins. Forwards to the host preload bridge
 * (`window.api`) that every Scalpel window already has — including plugin
 * overlay windows. No extra main-process IPC required.
 */
import type { FilterApi } from '../../../plugin-sdk/src/types'

type HostApi = typeof window.api

export function createFilterApi(api: HostApi = window.api): FilterApi {
  return {
    getSections: () => api.getFilterSections(),
    getBlock: (blockIndex) => api.getFilterBlock(blockIndex),
    setTierVisibility: (blockIndex, visibility) => api.setSectionTierVisibility(blockIndex, visibility),
    saveBlockEdit: (blockIndex, block, itemJson) => api.saveBlockEdit(blockIndex, block, itemJson),
    addBaseTypeToTier: (blockIndex, baseType) => api.addBaseTypeToTier(blockIndex, baseType),
    removeBaseTypeFromTier: (blockIndex, baseType) => api.removeBaseTypeFromTier(blockIndex, baseType),
    moveItemTier: (baseType, fromBlockIndex, toBlockIndex, itemJson) =>
      api.moveItemTier(baseType, fromBlockIndex, toBlockIndex, itemJson),
    batchMoveItemTier: (baseTypes, fromBlockIndex, toBlockIndex, itemJson) =>
      api.batchMoveItemTier(baseTypes, fromBlockIndex, toBlockIndex, itemJson),
    previewBaseTypeMove: (baseType, toBlockIndex) => api.previewBaseTypeMove(baseType, toBlockIndex),
    deleteFilterBlock: (blockIndex) => api.deleteFilterBlock(blockIndex),
    moveFilterBlock: (fromIndex, toIndex) => api.moveFilterBlock(fromIndex, toIndex),
    insertSectionRule: (opts) => api.insertSectionRule(opts),
    applySectionDelta: (req) => api.applySectionDelta(req),
    matchItem: (req) => api.matchFilterItem(req),
    parseItemText: (text) => api.parseItemText(text),
    getLastEvaluatedItem: () => api.getLastEvaluatedItem(),
    getRecentEvaluatedItems: () => api.getRecentEvaluatedItems(),
    simulateLootDrops: (req) => api.simulateLootDrops(req),
    preflight: () => api.preflightFilterCheck(),
    findConditions: (query) => api.findFilterConditions(query),
    getHistory: () => api.getHistory(),
    undoEdit: (itemJson) => api.undoEdit(itemJson),
    undoToEntry: (entryId) => api.undoToEntry(Number(entryId)),
    undoSectionHistory: (typePath) => api.undoSectionHistory(typePath),
    listVersions: () => api.listVersions(),
    createCheckpoint: (label) => api.createCheckpoint(label),
    restoreVersion: (filename, itemJson) => api.restoreVersion(filename, itemJson),
    deleteVersion: (filename) => api.deleteVersion(filename),
    diffFilterFiles: (leftPath, rightPath) => api.diffFilterFiles(leftPath, rightPath),
    diffFilterVsVersion: (versionFilename) => api.diffFilterVsVersion(versionFilename),
    previewReapply: () => api.previewFilterReapply(),
    applyReapply: () => api.applyFilterReapply(),
    exportIntents: () => api.exportFilterIntents(),
    importIntents: (payload) => api.importFilterIntents(payload),
    getChanges: () => api.getFilterChanges(),
    reload: () => api.reloadFilter(),
    getSearchableItems: () => api.getSearchableItems(),
    getIconCache: () => api.getIconCache(),
    onIconCacheUpdated: (handler) => api.onIconCacheUpdated(handler as (cache: Record<string, string>) => void),
    getSettings: () => api.getSettings(),
    listProfiles: () => api.listProfiles(),
    scanFilterDir: (dir) => api.scanFilterDir(dir),
    detectActiveGameFilter: (filterDirOverride) => api.detectActiveGameFilter(filterDirOverride),
    scanSoundFiles: (dir) => api.scanSoundFiles(dir),
    getSoundDataUrl: (dir, filename) => api.getSoundDataUrl(dir, filename),
    batchLookupPrices: (names) => api.batchLookupPrices(names),
    onChanged: (handler) => api.onFilterChanged(handler),
    onZoneChanged: (handler) => api.onZoneChanged(handler),
    filterBladeUrl: async () => {
      try {
        return (await api.filterBladeUrl()) || null
      } catch {
        return null
      }
    },
  } as FilterApi
}

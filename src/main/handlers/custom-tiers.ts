import { ipcMain } from 'electron'
import type Store from 'electron-store'
import type { AppSettings, CustomTier, PoeItem } from '@shared/types'
import { evaluateAndSend } from '../evaluation'
import {
  addItemToCustomTier,
  applyCustomTiersToFile,
  deleteCustomTier,
  loadCustomTiers,
  removeItemFromCustomTier,
  upsertCustomTier,
} from '../filter/custom-tiers'
import { loadFilter } from '../filter-state'
import { reloadFilterInGame } from '../overlay'
import { getProfileBackedSetting } from '../profiles/profile-settings'

function activeFilterPath(store: Store<AppSettings>): string {
  return (getProfileBackedSetting(store, 'filterPath') as string) || ''
}

function applyAndReload(store: Store<AppSettings>, filterPath: string, itemJson?: string): void {
  applyCustomTiersToFile(filterPath)
  const current = getProfileBackedSetting(store, 'filterPath') as string
  if (current === filterPath) {
    loadFilter(filterPath)
    if (store.get('reloadOnSave') !== false) reloadFilterInGame()
    if (itemJson) {
      try {
        evaluateAndSend(JSON.parse(itemJson) as PoeItem)
      } catch {
        /* ignore */
      }
    }
  }
}

export function register(store: Store<AppSettings>): void {
  ipcMain.handle('get-custom-tiers', (): { tiers: CustomTier[] } => {
    const filterPath = activeFilterPath(store)
    if (!filterPath) return { tiers: [] }
    return { tiers: loadCustomTiers(filterPath).tiers }
  })

  ipcMain.handle(
    'save-custom-tier',
    (_event, tier: CustomTier): { ok: boolean; error?: string; tiers?: CustomTier[] } => {
      const filterPath = activeFilterPath(store)
      if (!filterPath) return { ok: false, error: 'No filter configured' }
      try {
        const log = upsertCustomTier(filterPath, tier)
        applyAndReload(store, filterPath)
        return { ok: true, tiers: log.tiers }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    },
  )

  ipcMain.handle('delete-custom-tier', (_event, id: string): { ok: boolean; error?: string; tiers?: CustomTier[] } => {
    const filterPath = activeFilterPath(store)
    if (!filterPath) return { ok: false, error: 'No filter configured' }
    try {
      const log = deleteCustomTier(filterPath, id)
      applyAndReload(store, filterPath)
      return { ok: true, tiers: log.tiers }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle(
    'add-custom-tier-item',
    (
      _event,
      id: string,
      baseType: string,
      itemJson?: string,
    ): { ok: boolean; error?: string; tiers?: CustomTier[] } => {
      const filterPath = activeFilterPath(store)
      if (!filterPath) return { ok: false, error: 'No filter configured' }
      if (!baseType.trim()) return { ok: false, error: 'No item name' }
      try {
        const log = addItemToCustomTier(filterPath, id || 'keep', baseType.trim())
        applyAndReload(store, filterPath, itemJson)
        return { ok: true, tiers: log.tiers }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    },
  )

  ipcMain.handle(
    'remove-custom-tier-item',
    (_event, id: string, baseType: string): { ok: boolean; error?: string; tiers?: CustomTier[] } => {
      const filterPath = activeFilterPath(store)
      if (!filterPath) return { ok: false, error: 'No filter configured' }
      try {
        const log = removeItemFromCustomTier(filterPath, id, baseType)
        applyAndReload(store, filterPath)
        return { ok: true, tiers: log.tiers }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    },
  )
}

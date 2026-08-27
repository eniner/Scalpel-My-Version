import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { ipcMain } from 'electron'
import type Store from 'electron-store'
import type { AppSettings } from '@shared/types'
import { getPoeVersion } from '../game-state'
import { applyCustomTiersToFile } from '../filter/custom-tiers'
import { generateFilter } from '../filter/generate'
import { getIntents, loadIntents } from '../filter/intent-recorder'
import { replayIntents } from '../filter/intent-replay'
import {
  isScalpelGenerated,
  originFromFilter,
  SCALPEL_FILTER_FILENAME,
  SCALPEL_FILTER_NAME,
  type FilterOrigin,
} from '../filter/scalpel-owned'
import { writeFilterSelective } from '../filter/writer'
import { getCurrentFilter, loadFilter } from '../filter-state'
import { reloadFilterInGame } from '../overlay'
import { getProfileBackedSetting } from '../profiles/profile-settings'
import { getPriceEntries, getUniquesByBase, refreshPrices } from '../trade/prices'
import { saveVersion } from '../update/versions'

export type CreateScalpelFilterResult = {
  ok: boolean
  path?: string
  error?: string
  conflict?: boolean
  warning?: string
  stats?: { applied: number; skipped: number; conflicts: number }
}

async function buildGeneratedText(store: Store<AppSettings>): Promise<{ text: string; warning?: string }> {
  const league = (getProfileBackedSetting(store, 'league') as string) || ''
  if (league) await refreshPrices(league)
  const { prices } = getPriceEntries()
  const game = getPoeVersion() === 2 ? 2 : 1
  const text = generateFilter({
    game,
    prices,
    uniquesByBase: getUniquesByBase(),
    generatedAt: new Date(),
  })
  const warning =
    prices.length === 0
      ? 'No live prices yet — structural rules were written. Refresh economy once prices load.'
      : undefined
  return { text, warning }
}

function applyGenerated(
  targetPath: string,
  generated: string,
  replay: boolean,
): { applied: number; skipped: number; conflicts: number } {
  if (!replay) {
    writeFileSync(targetPath, generated, 'utf-8')
    applyCustomTiersToFile(targetPath)
    return { applied: 0, skipped: 0, conflicts: 0 }
  }
  loadIntents(targetPath, SCALPEL_FILTER_NAME)
  const result = replayIntents(generated, targetPath, getIntents(), { forceApply: true })
  result.filter.path = targetPath
  writeFilterSelective(result.filter, result.modifiedBlocks, result.removedBlocks)
  applyCustomTiersToFile(targetPath)
  return result.stats
}

export function register(store: Store<AppSettings>): void {
  ipcMain.handle('get-filter-origin', (): { origin: FilterOrigin } => {
    const filterPath = getProfileBackedSetting(store, 'filterPath') as string
    if (!filterPath) return { origin: 'other' }
    const current = getCurrentFilter()
    const content =
      current && current.path === filterPath
        ? current.rawLines.join(current.eol ?? '\n')
        : existsSync(filterPath)
          ? readFileSync(filterPath, 'utf-8')
          : ''
    return { origin: originFromFilter(content, basename(filterPath)) }
  })

  ipcMain.handle(
    'create-scalpel-filter',
    async (_event, opts?: { force?: boolean }): Promise<CreateScalpelFilterResult> => {
      const filterDir = getProfileBackedSetting(store, 'filterDir') as string
      if (!filterDir) return { ok: false, error: 'No filter folder selected' }

      const targetPath = join(filterDir, SCALPEL_FILTER_FILENAME)
      const existed = existsSync(targetPath)
      const existing = existed ? readFileSync(targetPath, 'utf-8') : ''
      const ours = existed && isScalpelGenerated(existing)
      if (existed && !ours && !opts?.force) {
        return {
          ok: false,
          conflict: true,
          error: `${SCALPEL_FILTER_FILENAME} already exists and is not a Scalpel filter`,
        }
      }

      try {
        const { text, warning } = await buildGeneratedText(store)
        if (existed) saveVersion(targetPath, true, 'Before economy refresh')
        const stats = applyGenerated(targetPath, text, ours)
        const currentPath = getProfileBackedSetting(store, 'filterPath') as string
        if (currentPath === targetPath) {
          loadFilter(targetPath, 'Scalpel Filter')
          if (store.get('reloadOnSave') !== false) reloadFilterInGame()
        }
        return { ok: true, path: targetPath, warning, stats }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    },
  )

  ipcMain.handle('refresh-scalpel-filter', async (): Promise<CreateScalpelFilterResult> => {
    const filterPath = getProfileBackedSetting(store, 'filterPath') as string
    if (!filterPath) return { ok: false, error: 'No filter configured' }
    if (!existsSync(filterPath)) return { ok: false, error: 'Filter file is missing' }
    const existing = readFileSync(filterPath, 'utf-8')
    if (!isScalpelGenerated(existing)) {
      return { ok: false, error: 'Active filter is not a Scalpel-generated filter' }
    }
    try {
      const { text, warning } = await buildGeneratedText(store)
      saveVersion(filterPath, true, 'Before economy refresh')
      const stats = applyGenerated(filterPath, text, true)
      loadFilter(filterPath, 'Economy Refresh')
      if (store.get('reloadOnSave') !== false) reloadFilterInGame()
      return { ok: true, path: filterPath, warning, stats }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })
}

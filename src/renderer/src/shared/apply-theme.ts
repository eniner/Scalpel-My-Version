import type { Api } from '../../../preload/index'
import type { AppSettings } from '@shared/types'
import type { ThemePalette } from '@shared/theme/palette'
import { resolveCssVars } from '@shared/theme/derive'
import { resolveActivePalette } from '@shared/theme/active'
import { fontPackageCssVars, resolveFontPackage } from '@shared/theme/fonts'

export const THEME_CACHE_KEY = 'scalpel:theme-vars'
export const FONT_CACHE_KEY = 'scalpel:font-vars'

type ThemeApi = Pick<Api, 'getSettings' | 'onSettingUpdated'>

function writeVars(vars: Record<string, string>, cacheKey: string | null): void {
  const root = document.documentElement
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
  if (!cacheKey) return
  try {
    localStorage.setItem(cacheKey, JSON.stringify(vars))
  } catch {
    // private mode / quota
  }
}

function applyCachedMap(cacheKey: string): void {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(cacheKey)
  } catch {
    return
  }
  if (!raw) return
  let vars: Record<string, string>
  try {
    vars = JSON.parse(raw) as Record<string, string>
  } catch {
    return
  }
  if (typeof vars !== 'object' || vars === null) return
  const root = document.documentElement
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
}

/** Apply resolved CSS vars to :root without writing the localStorage cache.
 *  Use this on live-drag paths (e.g. color picker onChange) to avoid
 *  synchronous disk-backed writes on every frame. */
export function applyVars(palette: ThemePalette): void {
  writeVars(resolveCssVars(palette), null)
}

/** Write a resolved palette to :root and cache it for the next cold start. */
export function applyPalette(palette: ThemePalette): void {
  writeVars(resolveCssVars(palette), THEME_CACHE_KEY)
}

export function applyFontPackage(id: string): void {
  writeVars(fontPackageCssVars(resolveFontPackage(id)), FONT_CACHE_KEY)
}

/** Synchronous pre-paint: apply the last cached var map before React mounts.
 *  Eliminates the default-theme flash for non-default themes. Safe no-op
 *  when there is no cache or it is corrupt. */
export function applyCachedVars(): void {
  applyCachedMap(THEME_CACHE_KEY)
  applyCachedMap(FONT_CACHE_KEY)
}

/** Run once per renderer entry. Pre-paints from cache, then reconciles with
 *  persisted settings, then re-applies on every relevant setting change. */
export async function bootstrapTheme(): Promise<void> {
  applyCachedVars()

  const apiCandidate = (window as unknown as { api?: ThemeApi }).api
  if (!apiCandidate?.getSettings) return
  const api = apiCandidate

  let snapshot: ThemeSettingsSnapshot = {
    themeId: 'default',
    customThemePalette: null,
    fontPackageId: 'fontin',
  }

  const reapply = (): void => {
    applyPalette(resolveActivePalette(snapshot.themeId, snapshot.customThemePalette))
    applyFontPackage(snapshot.fontPackageId)
  }

  let settings: AppSettings
  try {
    settings = await api.getSettings()
  } catch {
    return // IPC unavailable; the cached pre-paint already applied, that is sufficient.
  }
  snapshot = {
    themeId: settings.themeId ?? 'default',
    customThemePalette: settings.customThemePalette ?? null,
    fontPackageId: settings.fontPackageId ?? 'fontin',
  }
  reapply()

  api.onSettingUpdated((key, value) => {
    if (key === 'themeId') snapshot = { ...snapshot, themeId: value as string }
    else if (key === 'customThemePalette') snapshot = { ...snapshot, customThemePalette: value as ThemePalette | null }
    else if (key === 'fontPackageId') snapshot = { ...snapshot, fontPackageId: value as string }
    else return
    reapply()
  })
}

interface ThemeSettingsSnapshot {
  themeId: string
  customThemePalette: ThemePalette | null
  fontPackageId: string
}

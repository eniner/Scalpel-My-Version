import type { ThemePalette } from './palette'
import { DEFAULT_PALETTE, PRESETS_BY_ID, CUSTOM_THEME_ID } from './presets'

/** Pure: pick the palette to render from the two settings fields.
 *  'custom' uses customThemePalette; any preset id uses that preset;
 *  anything unresolvable falls back to the default palette. */
export function resolveActivePalette(themeId: string, customThemePalette: ThemePalette | null): ThemePalette {
  if (themeId === CUSTOM_THEME_ID) return customThemePalette ?? DEFAULT_PALETTE
  return PRESETS_BY_ID[themeId]?.palette ?? DEFAULT_PALETTE
}

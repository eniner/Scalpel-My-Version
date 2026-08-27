/** User-editable base palette. Solid lowercase hex (#rrggbb) only.
 *  All *-dim / *-translucent / bg-hover variants are derived, never stored. */
export interface ThemePalette {
  bgSolid: string
  bgCard: string
  accent: string
  match: string
  secondaryMatch: string
  text: string
  textDim: string
  border: string
  danger: string
  warn: string
  dangerBg: string
  hideColor: string
  showColor: string
  minimalColor: string
}

export type ThemePresetGroup = 'core' | 'studio' | 'game' | 'light'

export interface ThemePreset {
  id: string
  name: string
  group: ThemePresetGroup
  palette: ThemePalette
}

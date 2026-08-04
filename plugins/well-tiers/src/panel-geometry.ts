/** Full list band scanned for row layout (fractions of panel height). */
export const SCAN_TOP_IN_PANEL = 0.07
export const SCAN_BOTTOM_IN_PANEL = 0.82

export const FIXED_LIST_TOP_IN_PANEL = 0.123
export const FIXED_LIST_BOTTOM_IN_PANEL = 0.566

export const ITEM_TEXT_LEFT_IN_PANEL = 0.34
export const ITEM_TEXT_RIGHT_IN_PANEL = 0.58

export const SKILL_TEXT_LEFT_IN_PANEL = 0.58
export const SKILL_TEXT_RIGHT_IN_PANEL = 0.99

export const SKILL_ENTRY_STRIDE = 2
export const SKILL_TEXT_Y_PHASE = 0.52

export interface RowBandOptions {
  stride?: number
  yPhaseFrac?: number
}

export const TEXT_LEFT_IN_PANEL = ITEM_TEXT_LEFT_IN_PANEL
export const TEXT_RIGHT_IN_PANEL = ITEM_TEXT_RIGHT_IN_PANEL

export const MIN_ROW_COUNT = 3
export const MAX_ROW_COUNT = 14
export const DEFAULT_ROW_COUNT = 8

export interface PanelRect {
  x: number
  y: number
  w: number
  h: number
}

export function fixedRewardRowBands(
  panel: PanelRect,
  want = DEFAULT_ROW_COUNT,
): Array<{ y: number; h: number }> {
  return rewardRowBandsForCount(panel, want)
}

export function rewardRowBandsForCount(
  panel: PanelRect,
  count: number,
  opts: RowBandOptions = {},
): Array<{ y: number; h: number }> {
  const stride = opts.stride ?? 1
  const yPhaseFrac = opts.yPhaseFrac ?? (stride > 1 ? SKILL_TEXT_Y_PHASE : 0.1)
  const n = Math.max(MIN_ROW_COUNT, Math.min(MAX_ROW_COUNT, count))
  const listTop = panel.y + panel.h * FIXED_LIST_TOP_IN_PANEL
  const maxBottom = panel.y + panel.h * SCAN_BOTTOM_IN_PANEL
  const calSpan = panel.h * (FIXED_LIST_BOTTOM_IN_PANEL - FIXED_LIST_TOP_IN_PANEL)
  const calRowH = calSpan / DEFAULT_ROW_COUNT
  const rowH = calRowH * stride
  const neededBottom = listTop + (n - 1) * rowH + rowH * (yPhaseFrac + 0.26)
  const effRowH = neededBottom <= maxBottom ? rowH : (maxBottom - listTop) / n
  const bandH = Math.min(calRowH * 0.78, effRowH * 0.42)
  return Array.from({ length: n }, (_, i) => ({
    y: listTop + i * effRowH + effRowH * yPhaseFrac,
    h: bandH,
  }))
}

export function bandsFromPeakCenters(centers: number[]): Array<{ y: number; h: number }> {
  if (centers.length === 0) return []
  const sorted = [...centers].sort((a, b) => a - b)
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i]! - sorted[i - 1]!)
  const step = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 46
  const bandH = Math.max(34, Math.min(56, step * 0.62))
  return sorted.map((cy) => ({ y: cy - bandH * 0.45, h: bandH }))
}

export function peaksToRowBands(centers: number[], listH: number): Array<{ y: number; h: number }> {
  if (centers.length === 0) return []
  const spacings: number[] = []
  for (let i = 1; i < centers.length; i++) spacings.push(centers[i]! - centers[i - 1]!)
  const rowH =
    spacings.length > 0 ? spacings.reduce((a, b) => a + b, 0) / spacings.length : listH / centers.length
  const bandH = rowH * 0.78
  return centers.map((cy) => ({ y: cy - bandH * 0.5, h: bandH }))
}

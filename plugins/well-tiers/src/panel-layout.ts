import type { GameCapture } from '@scalpelpoe/plugin-sdk'
import {
  bandsFromPeakCenters,
  DEFAULT_ROW_COUNT,
  FIXED_LIST_BOTTOM_IN_PANEL,
  FIXED_LIST_TOP_IN_PANEL,
  ITEM_TEXT_LEFT_IN_PANEL,
  ITEM_TEXT_RIGHT_IN_PANEL,
  MAX_ROW_COUNT,
  MIN_ROW_COUNT,
  rewardRowBandsForCount,
  SCAN_BOTTOM_IN_PANEL,
  SCAN_TOP_IN_PANEL,
  SKILL_TEXT_LEFT_IN_PANEL,
  SKILL_TEXT_RIGHT_IN_PANEL,
  type PanelRect,
} from './panel-geometry'

export interface RowBandDetectResult {
  bands: Array<{ y: number; h: number }>
  method: 'layout-count' | 'skill-peaks' | 'fixed-fallback'
  peakCount: number
  pageKind: 'items' | 'skills'
}

function isRewardTextPixel(r: number, g: number, b: number): boolean {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  if (lum < 118) return false
  if (r < 95 || g < 85) return false
  return lum - Math.min(r, g, b) > 28
}

export function horizontalTextProjection(
  frame: Pick<GameCapture, 'pixels' | 'width' | 'height'>,
  panel: PanelRect,
  topFrac = SCAN_TOP_IN_PANEL,
  bottomFrac = SCAN_BOTTOM_IN_PANEL,
  textLeftFrac = ITEM_TEXT_LEFT_IN_PANEL,
  textRightFrac = SKILL_TEXT_RIGHT_IN_PANEL,
): { y0: number; y1: number; values: Float32Array } {
  const listTop = panel.y + panel.h * topFrac
  const listBottom = panel.y + panel.h * bottomFrac
  const x0 = Math.round(panel.x + panel.w * textLeftFrac)
  const x1 = Math.round(panel.x + panel.w * textRightFrac)
  const y0 = Math.max(0, Math.round(listTop))
  const y1 = Math.min(frame.height, Math.round(listBottom))
  const h = y1 - y0
  const values = new Float32Array(h)
  const px = frame.pixels
  const w = frame.width

  for (let y = y0; y < y1; y++) {
    let count = 0
    const row = y * w * 4
    for (let x = x0; x < x1; x++) {
      const i = row + x * 4
      if (isRewardTextPixel(px[i]!, px[i + 1]!, px[i + 2]!)) count++
    }
    values[y - y0] = count
  }
  return { y0, y1, values }
}

function smooth(arr: Float32Array, radius: number): Float32Array {
  const out = new Float32Array(arr.length)
  for (let i = 0; i < arr.length; i++) {
    let sum = 0
    let n = 0
    for (let d = -radius; d <= radius; d++) {
      const j = i + d
      if (j < 0 || j >= arr.length) continue
      sum += arr[j]!
      n++
    }
    out[i] = sum / n
  }
  return out
}

function mergePeaks(indices: number[], smoothed: Float32Array, minGap: number): number[] {
  const merged: number[] = []
  for (const p of indices) {
    if (merged.length === 0 || p - merged[merged.length - 1]! > minGap) merged.push(p)
    else if (smoothed[p]! > smoothed[merged[merged.length - 1]!]!) merged[merged.length - 1] = p
  }
  return merged
}

function findPeakIndices(smoothed: Float32Array, threshold: number): number[] {
  const peaks: number[] = []
  for (let i = 2; i < smoothed.length - 2; i++) {
    const v = smoothed[i]!
    if (v < threshold) continue
    if (v >= smoothed[i - 1]! && v >= smoothed[i + 1]!) peaks.push(i)
  }
  return peaks
}

function filterPeakCenters(centers: number[], panel: PanelRect): number[] {
  const listStart = panel.y + panel.h * FIXED_LIST_TOP_IN_PANEL
  const listEnd = panel.y + panel.h * SCAN_BOTTOM_IN_PANEL * 0.96
  return centers.filter((y) => y >= listStart - 8 && y <= listEnd)
}

export function findLayoutPeakYs(
  frame: Pick<GameCapture, 'pixels' | 'width' | 'height'>,
  panel: PanelRect,
  textLeftFrac: number,
  textRightFrac: number,
): number[] {
  const { y0, y1, values } = horizontalTextProjection(frame, panel, SCAN_TOP_IN_PANEL, SCAN_BOTTOM_IN_PANEL, textLeftFrac, textRightFrac)
  const listH = y1 - y0
  if (listH < 40) return []

  const smoothed = smooth(values, 3)
  const avg = [...smoothed].reduce((a, b) => a + b, 0) / smoothed.length
  const calRowH = (panel.h * (FIXED_LIST_BOTTOM_IN_PANEL - FIXED_LIST_TOP_IN_PANEL)) / DEFAULT_ROW_COUNT
  let minGap = Math.min(listH / MAX_ROW_COUNT, calRowH * 0.82)
  let threshold = Math.max(6, avg * 0.28)
  let peakIdx = findPeakIndices(smoothed, threshold)
  let merged = mergePeaks(peakIdx, smoothed, minGap)

  if (merged.length < MIN_ROW_COUNT) {
    threshold = Math.max(4, avg * 0.18)
    peakIdx = findPeakIndices(smoothed, threshold)
    merged = mergePeaks(peakIdx, smoothed, minGap)
  }

  while (merged.length > MAX_ROW_COUNT && minGap < listH * 0.14) {
    minGap *= 1.12
    merged = mergePeaks(peakIdx, smoothed, minGap)
  }

  return filterPeakCenters(
    merged.map((p) => y0 + p),
    panel,
  )
}

function countLayoutPeaks(
  frame: Pick<GameCapture, 'pixels' | 'width' | 'height'>,
  panel: PanelRect,
  textLeftFrac: number,
  textRightFrac: number,
): number {
  return findLayoutPeakYs(frame, panel, textLeftFrac, textRightFrac).length
}

function columnTextMass(
  frame: Pick<GameCapture, 'pixels' | 'width' | 'height'>,
  panel: PanelRect,
  textLeftFrac: number,
  textRightFrac: number,
): number {
  const { values } = horizontalTextProjection(frame, panel, SCAN_TOP_IN_PANEL, SCAN_BOTTOM_IN_PANEL, textLeftFrac, textRightFrac)
  let sum = 0
  for (let i = 0; i < values.length; i++) sum += values[i]!
  return sum
}

function detectSkillPage(
  fullPeaks: number,
  itemPeaks: number,
  skillPeaks: number,
  itemMass: number,
  skillMass: number,
): boolean {
  if (skillPeaks < MIN_ROW_COUNT) return false
  if (fullPeaks >= skillPeaks * 1.45) return true
  if (skillPeaks > itemPeaks && skillMass > itemMass * 1.05) return true
  return false
}

export function detectRewardRowBands(
  frame: Pick<GameCapture, 'pixels' | 'width' | 'height'>,
  panel: PanelRect,
): RowBandDetectResult {
  const fullPeaks = countLayoutPeaks(frame, panel, ITEM_TEXT_LEFT_IN_PANEL, SKILL_TEXT_RIGHT_IN_PANEL)
  const itemPeaks = countLayoutPeaks(frame, panel, ITEM_TEXT_LEFT_IN_PANEL, ITEM_TEXT_RIGHT_IN_PANEL)
  const skillPeaks = countLayoutPeaks(frame, panel, SKILL_TEXT_LEFT_IN_PANEL, SKILL_TEXT_RIGHT_IN_PANEL)
  const itemMass = columnTextMass(frame, panel, ITEM_TEXT_LEFT_IN_PANEL, ITEM_TEXT_RIGHT_IN_PANEL)
  const skillMass = columnTextMass(frame, panel, SKILL_TEXT_LEFT_IN_PANEL, SKILL_TEXT_RIGHT_IN_PANEL)
  const pageKind = detectSkillPage(fullPeaks, itemPeaks, skillPeaks, itemMass, skillMass) ? 'skills' : 'items'

  if (pageKind === 'skills') {
    const skillCenters = findLayoutPeakYs(frame, panel, SKILL_TEXT_LEFT_IN_PANEL, SKILL_TEXT_RIGHT_IN_PANEL)
    if (skillCenters.length >= MIN_ROW_COUNT && skillCenters.length <= MAX_ROW_COUNT) {
      return {
        bands: bandsFromPeakCenters(skillCenters),
        method: 'skill-peaks',
        peakCount: skillCenters.length,
        pageKind,
      }
    }
  }

  const count = Math.max(fullPeaks, itemPeaks, skillPeaks)
  if (count >= MIN_ROW_COUNT && count <= MAX_ROW_COUNT) {
    return {
      bands: rewardRowBandsForCount(panel, count),
      method: 'layout-count',
      peakCount: count,
      pageKind,
    }
  }

  const hint = count >= MIN_ROW_COUNT ? count : DEFAULT_ROW_COUNT
  return {
    bands: rewardRowBandsForCount(panel, Math.min(hint, MAX_ROW_COUNT)),
    method: 'fixed-fallback',
    peakCount: count,
    pageKind,
  }
}

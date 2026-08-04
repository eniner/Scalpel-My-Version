import type { GameCapture } from '@scalpelpoe/plugin-sdk'
import { detectRewardRowBands } from './panel-layout'
import {
  ITEM_TEXT_LEFT_IN_PANEL,
  ITEM_TEXT_RIGHT_IN_PANEL,
  SCAN_BOTTOM_IN_PANEL,
  SCAN_TOP_IN_PANEL,
  SKILL_TEXT_LEFT_IN_PANEL,
  SKILL_TEXT_RIGHT_IN_PANEL,
  type PanelRect,
} from './panel-geometry'
import { isRunicEntryName, pickBestRowDecode, PLUGIN_VERSION } from './decode-row'
import { ocrRegion, stabilizeRewardLines } from './ocr'
import { expandTruncatedRewardName } from './rewards'
import type { Candidate } from './rewards'
import type { Box, Line } from './segment'

export { type PanelRect } from './panel-geometry'
export const PANEL_TOP_FRAC = 0.05
export const PANEL_W_FRAC = 0.56
export const PANEL_H_FRAC = 0.82

const ROW_TARGET_W = 1800
const SKILL_ROW_TARGET_W = 2400
const SKILL_BULK_TARGET_W = 2600

export function panelRect(frame: Pick<GameCapture, 'height'>): PanelRect {
  const y = frame.height * PANEL_TOP_FRAC
  const h = frame.height * PANEL_H_FRAC - y
  return { x: 0, y, w: frame.height * PANEL_W_FRAC, h }
}

function textColumn(
  slot: { y: number; h: number },
  panel: PanelRect,
  leftFrac: number,
  rightFrac: number,
): { x: number; y: number; w: number; h: number } {
  return {
    x: panel.x + panel.w * leftFrac,
    y: slot.y,
    w: panel.w * (rightFrac - leftFrac),
    h: slot.h,
  }
}

function skillColumnStrip(panel: PanelRect): { x: number; y: number; w: number; h: number } {
  return {
    x: panel.x + panel.w * SKILL_TEXT_LEFT_IN_PANEL,
    y: panel.y + panel.h * SCAN_TOP_IN_PANEL,
    w: panel.w * (SKILL_TEXT_RIGHT_IN_PANEL - SKILL_TEXT_LEFT_IN_PANEL),
    h: panel.h * (SCAN_BOTTOM_IN_PANEL - SCAN_TOP_IN_PANEL),
  }
}

function pickRowText(lines: Line[], words: import('./segment').Word[], lineGap: number): string {
  const stable = stabilizeRewardLines(lines, words, lineGap)
  const pool = stable.length > 0 ? stable : lines
  const fromLine = pool
    .map((l) => l.text.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0]
  if (fromLine) return fromLine
  return words
    .map((w) => w.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function collectReads(
  passes: Array<{ lines: Line[]; words: import('./segment').Word[] }>,
  lineGap: number,
): string[] {
  const reads: string[] = []
  for (const pass of passes) {
    const stable = stabilizeRewardLines(pass.lines, pass.words, lineGap)
    for (const l of stable) reads.push(l.text.trim())
    reads.push(pickRowText(pass.lines, pass.words, lineGap))
  }
  return [...new Set(reads.filter((r) => r.length > 2))]
}

function readsNearBand(bulkLines: Line[], band: { y: number; h: number }, margin = 14): string[] {
  return bulkLines
    .filter((l) => {
      const cy = l.box.y + l.box.h / 2
      return cy >= band.y - margin && cy <= band.y + band.h + margin
    })
    .map((l) => l.text.trim())
    .filter((t) => t.length > 2)
}

async function ocrItemRowPasses(
  frame: GameCapture,
  region: { x: number; y: number; w: number; h: number },
): Promise<string[]> {
  const lineGap = Math.max(6, region.h * 0.35)
  const [block, line, column, masked] = await Promise.all([
    ocrRegion(frame, region, ROW_TARGET_W, 'block'),
    ocrRegion(frame, region, ROW_TARGET_W, 'line'),
    ocrRegion(frame, region, ROW_TARGET_W, 'column'),
    ocrRegion(frame, region, ROW_TARGET_W, 'block', 'reward-text'),
  ])
  return collectReads([block, line, column, masked], lineGap)
}

async function ocrSkillRowPasses(
  frame: GameCapture,
  region: { x: number; y: number; w: number; h: number },
): Promise<string[]> {
  const pad = Math.max(4, region.h * 0.15)
  const crop = {
    x: region.x,
    y: Math.max(0, region.y - pad),
    w: region.w,
    h: region.h + pad * 2,
  }
  const lineGap = Math.max(6, crop.h * 0.35)
  const [line, lineMask, blockMask, sparse] = await Promise.all([
    ocrRegion(frame, crop, SKILL_ROW_TARGET_W, 'line'),
    ocrRegion(frame, crop, SKILL_ROW_TARGET_W, 'line', 'reward-text'),
    ocrRegion(frame, crop, SKILL_ROW_TARGET_W, 'block', 'reward-text'),
    ocrRegion(frame, crop, SKILL_ROW_TARGET_W, 'sparse', 'reward-text'),
  ])
  return collectReads([line, lineMask, blockMask, sparse], lineGap)
}

/** One pass over the full skill label column; lines matched to row bands by Y. */
async function ocrSkillColumnBulk(frame: GameCapture, panel: PanelRect): Promise<Line[]> {
  const region = skillColumnStrip(panel)
  const lineGap = Math.max(8, region.h * 0.04)
  const [column, sparse, block] = await Promise.all([
    ocrRegion(frame, region, SKILL_BULK_TARGET_W, 'column', 'reward-text'),
    ocrRegion(frame, region, SKILL_BULK_TARGET_W, 'sparse', 'reward-text'),
    ocrRegion(frame, region, SKILL_BULK_TARGET_W, 'block', 'reward-text'),
  ])
  const pool: Line[] = []
  for (const pass of [column, sparse, block]) {
    pool.push(...stabilizeRewardLines(pass.lines, pass.words, lineGap))
    pool.push(...pass.lines)
  }
  const seen = new Set<string>()
  const out: Line[] = []
  for (const l of pool.sort((a, b) => a.box.y - b.box.y)) {
    const key = `${Math.round(l.box.y / 8)}:${l.text.trim()}`
    if (!l.text.trim() || seen.has(key)) continue
    seen.add(key)
    out.push(l)
  }
  return out
}

export interface RowReadResult {
  lines: Line[]
  candidates: Candidate[]
  method: string
}

export async function readRewardRows(
  frame: GameCapture,
  onRow?: (index: number, total: number) => void,
): Promise<RowReadResult> {
  const panel = panelRect(frame)
  const { bands, method: detectMethod, peakCount, pageKind } = detectRewardRowBands(frame, panel)
  const lines: Line[] = []
  const candidates: Candidate[] = []
  const skillPage = pageKind === 'skills'
  const bulkLines = skillPage ? await ocrSkillColumnBulk(frame, panel) : []

  for (let i = 0; i < bands.length; i++) {
    onRow?.(i + 1, bands.length)
    const band = bands[i]!
    const itemRegion = textColumn(band, panel, ITEM_TEXT_LEFT_IN_PANEL, ITEM_TEXT_RIGHT_IN_PANEL)
    const skillRegion = textColumn(band, panel, SKILL_TEXT_LEFT_IN_PANEL, SKILL_TEXT_RIGHT_IN_PANEL)

    const reads = skillPage
      ? [...(await ocrSkillRowPasses(frame, skillRegion)), ...readsNearBand(bulkLines, band)]
      : [...(await ocrItemRowPasses(frame, itemRegion)), ...(await ocrSkillRowPasses(frame, skillRegion))]

    let decoded = pickBestRowDecode(reads)
    if (skillPage && decoded && !isRunicEntryName(decoded.name)) decoded = null

    const useSkill = skillPage || decoded?.name.match(/^(Skill|Support):/i) != null
    const region = useSkill ? skillRegion : itemRegion
    const box: Box = { x: region.x, y: region.y, w: region.w, h: region.h }

    if (decoded) {
      const name = expandTruncatedRewardName(decoded.name)
      lines.push({ text: decoded.raw, box })
      candidates.push({ qty: decoded.qty, name, box, explicit: decoded.explicit })
    } else if (!skillPage) {
      const fallback = reads.find((r) => r.length > 2) ?? ''
      if (fallback) {
        lines.push({ text: fallback, box })
        candidates.push({ qty: 1, name: fallback, box, explicit: false })
      }
    }
  }

  const detectLabel =
    detectMethod === 'skill-peaks'
      ? `skill-peaks(${peakCount})`
      : detectMethod === 'layout-count'
        ? `layout-count(${peakCount})`
        : `fixed-fallback(${bands.length})`
  const modeLabel = skillPage ? 'skill-ocr' : 'dual-col-ocr'
  return {
    lines,
    candidates,
    method: `v${PLUGIN_VERSION} ${pageKind} ${detectLabel}+${modeLabel} (${bands.length} rows)`,
  }
}

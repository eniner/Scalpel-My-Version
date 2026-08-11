import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, ipcMain } from 'electron'
import { hideOverlay } from './overlay'
import {
  registerSecondaryOverlay,
  setOverlayStayOpenOnPoeBlur,
  type OverlayAnchor,
  type SecondaryOverlay,
} from './windowing'

let overlay: SecondaryOverlay | null = null

function anchorFile(): string {
  return join(app.getPath('userData'), 'filter-section-editor-anchor.json')
}

function loadStoredAnchor(): OverlayAnchor | undefined {
  try {
    const p = anchorFile()
    if (!existsSync(p)) return undefined
    const raw = JSON.parse(readFileSync(p, 'utf-8')) as Partial<OverlayAnchor>
    if (
      typeof raw.fracX === 'number' &&
      typeof raw.fracY === 'number' &&
      typeof raw.fracW === 'number' &&
      typeof raw.fracH === 'number'
    ) {
      return { fracX: raw.fracX, fracY: raw.fracY, fracW: raw.fracW, fracH: raw.fracH }
    }
  } catch {
    /* ignore */
  }
  return undefined
}

function saveStoredAnchor(anchor: OverlayAnchor): void {
  try {
    writeFileSync(anchorFile(), `${JSON.stringify(anchor)}\n`, 'utf-8')
  } catch {
    /* ignore */
  }
}

/** Large sister window for the FilterBlade section editor — ~84×90% of the game. */
export function registerFilterSectionEditorOverlay(): SecondaryOverlay {
  if (overlay) return overlay
  overlay = registerSecondaryOverlay({
    id: 'filter-section-editor',
    htmlEntry: 'filter-section-editor.html',
    defaultAnchor: () => ({ fracX: 0.08, fracY: 0.05, fracW: 0.84, fracH: 0.9 }),
    storedAnchor: loadStoredAnchor,
    onAnchorChanged: saveStoredAnchor,
  })

  ipcMain.on('filter-section-editor:show', () => {
    hideOverlay()
    overlay?.show()
  })

  ipcMain.on('filter-section-editor:request-close', () => {
    setOverlayStayOpenOnPoeBlur('filter-section-editor', false)
    overlay?.hide()
  })

  ipcMain.handle('filter-section-editor:set-pinned', (_e, pinned: boolean) => {
    setOverlayStayOpenOnPoeBlur('filter-section-editor', !!pinned)
    return { ok: true as const, pinned: !!pinned }
  })

  return overlay
}

export function showFilterSectionEditor(): void {
  if (!overlay) return
  hideOverlay()
  overlay.show()
}

export function toggleFilterSectionEditor(): void {
  if (!overlay) return
  if (overlay.isVisible()) overlay.hide()
  else {
    hideOverlay()
    overlay.show()
  }
}

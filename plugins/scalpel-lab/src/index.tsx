import type { ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { App } from './App'
import { ModCheatSheetApp } from './ModCheatSheetApp'

const ICON = renderToStaticMarkup(
  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3">
    <path d="M14 34l20-20M18 14h16v16" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="24" cy="24" r="18" opacity="0.35" />
  </svg>,
)

const CHEAT_SHEET_ICON = renderToStaticMarkup(
  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.5">
    <rect x="8" y="6" width="32" height="36" rx="2" opacity="0.35" />
    <path d="M14 14h20M14 22h20M14 30h12" strokeLinecap="round" />
  </svg>,
)

/** ~90% of a 1920×1080 game window — max size Scalpel allows for plugin overlays. */
const CHEAT_SHEET_WINDOW = { width: 1728, height: 972 }

export default function activate(ctx: ScalpelPluginContext): void {
  ctx.registerTab({
    label: 'Scalpel Lab',
    icon: ICON,
    render(container) {
      const root = createRoot(container)
      root.render(<App ctx={ctx} />)
      return () => root.unmount()
    },
  })

  ctx.registerOverlay(
    {
      title: 'Scalpel Lab',
      icon: CHEAT_SHEET_ICON,
      hotkeyLabel: 'Toggle mod cheat sheet window',
      defaultSize: CHEAT_SHEET_WINDOW,
    },
    (container) => {
      container.style.cssText =
        'box-sizing:border-box;height:100%;display:flex;flex-direction:column;overflow:hidden;background:var(--scalpel-bg,#141418)'
      const root = createRoot(container)
      root.render(<ModCheatSheetApp ctx={ctx} />)
      return () => root.unmount()
    },
  )

  ctx.registerHotkey({ label: 'Import item → Scalpel Lab' }, () => {
    void ctx.copyAndEvaluateItem().then((item) => {
      if (item) void ctx.openTab()
    })
  })
}

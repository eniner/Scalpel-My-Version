import type { ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { createRoot } from 'react-dom/client'
import { HarvestPanel } from './HarvestPanel'
import { HARVEST_ICON } from './icon'

const WINDOW = { width: 1180, height: 720 }

export default function activate(ctx: ScalpelPluginContext): void {
  if (ctx.getPoeVersion() !== 1) return

  ctx.registerOverlay(
    {
      title: 'Scalpel Harvest',
      icon: HARVEST_ICON,
      hotkeyLabel: 'Toggle Scalpel Harvest',
      defaultSize: WINDOW,
    },
    (container) => {
      container.style.cssText =
        'box-sizing:border-box;height:100%;display:flex;flex-direction:column;overflow:hidden;background:#0c0c12'
      const root = createRoot(container)
      root.render(<HarvestPanel ctx={ctx} />)
      return () => root.unmount()
    },
  )

  void (async () => {
    const seen = await ctx.storage.get<boolean>('openedOnce')
    if (!seen) {
      await ctx.storage.set('openedOnce', true)
      ctx.openOverlay()
    }
  })()
}

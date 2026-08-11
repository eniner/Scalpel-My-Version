import type { ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { createRoot } from 'react-dom/client'
import { AdvisorPanel } from './AdvisorPanel'
import { ADVISOR_ICON } from './icon'
import { injectAdvisorStyles, theme } from './shared/theme'

const WINDOW = { width: 1000, height: 720 }

export default function activate(ctx: ScalpelPluginContext): void {
  if (ctx.getPoeVersion() !== 1) return

  ctx.registerOverlay(
    {
      title: 'Scalpel Advisor',
      icon: ADVISOR_ICON,
      hotkeyLabel: 'Toggle Scalpel Advisor',
      defaultSize: WINDOW,
    },
    (container) => {
      injectAdvisorStyles()
      container.style.cssText = `box-sizing:border-box;height:100%;display:flex;flex-direction:column;overflow:hidden;background:${theme.bg}`
      const root = createRoot(container)
      root.render(<AdvisorPanel ctx={ctx} />)
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

import type { ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { App } from './App'

const ICON = renderToStaticMarkup(
  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="4">
    <path d="M10 34 L24 10 L38 34" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 34h16" strokeLinecap="round" />
    <circle cx="24" cy="22" r="3" fill="currentColor" stroke="none" />
  </svg>,
)

export default function activate(ctx: ScalpelPluginContext): void {
  if (ctx.getPoeVersion() !== 2) {
    ctx.log('Skill DPS is PoE2-only')
    return
  }
  ctx.registerTab({
    label: 'Skill DPS',
    icon: ICON,
    render(container) {
      const root = createRoot(container)
      root.render(<App ctx={ctx} />)
      return () => root.unmount()
    },
  })
}

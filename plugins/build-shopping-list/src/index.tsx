import type { ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { App } from './App'

const ICON = renderToStaticMarkup(
  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="4">
    <path d="M8 14h32M8 24h32M8 34h20" strokeLinecap="round" />
    <rect x="32" y="28" width="12" height="12" rx="2" fill="currentColor" fillOpacity="0.25" stroke="currentColor" />
  </svg>,
)

export default function activate(ctx: ScalpelPluginContext): void {
  ctx.registerTab({
    label: 'Build Shop',
    icon: ICON,
    render(container) {
      const root = createRoot(container)
      root.render(<App ctx={ctx} />)
      return () => root.unmount()
    },
  })
}

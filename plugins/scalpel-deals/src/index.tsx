import type { ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { createRoot } from 'react-dom/client'
import { DealsPanel } from './DealsPanel'
import { DEALS_ICON } from './icon'

const WINDOW = { width: 920, height: 760 }

function mount(ctx: ScalpelPluginContext, container: HTMLElement): () => void {
  container.style.cssText = [
    'box-sizing:border-box',
    'height:100%',
    'min-height:0',
    'display:flex',
    'flex-direction:column',
    'overflow:hidden',
    'background:var(--bg, #171821)',
    'color:var(--text, #e0d8cc)',
    'font-family:inherit',
    'font-size:12px',
  ].join(';')
  const root = createRoot(container)
  root.render(<DealsPanel ctx={ctx} />)
  return () => root.unmount()
}

export default function activate(ctx: ScalpelPluginContext): void {
  if (ctx.getPoeVersion() !== 2) return

  ctx.registerTab({
    label: 'Listing watch',
    icon: DEALS_ICON,
    render: (container) => mount(ctx, container),
  })

  ctx.registerOverlay(
    {
      title: 'Listing watch',
      icon: DEALS_ICON,
      hotkeyLabel: 'Toggle listing watch',
      defaultSize: WINDOW,
    },
    (container) => mount(ctx, container),
  )

  ctx.registerHotkey({ label: 'Open listing watch' }, () => {
    ctx.openOverlay()
  })
}

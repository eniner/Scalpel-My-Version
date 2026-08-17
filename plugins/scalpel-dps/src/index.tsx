import type { ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { createRoot } from 'react-dom/client'
import { DpsPanel } from './DpsPanel'
import { DPS_ICON } from './icon'

const WINDOW = { width: 960, height: 780 }

function mount(ctx: ScalpelPluginContext, container: HTMLElement): () => void {
  container.style.cssText = [
    'box-sizing:border-box',
    'height:100%',
    'min-height:0',
    'display:flex',
    'flex-direction:column',
    'overflow:hidden',
    'background:var(--bg, #0c0e12)',
    'color:var(--text, #e8e6e3)',
    'font-family:inherit',
    'font-size:12px',
  ].join(';')
  const root = createRoot(container)
  root.render(<DpsPanel ctx={ctx} />)
  return () => root.unmount()
}

export default function activate(ctx: ScalpelPluginContext): void {
  ctx.registerTab({
    label: 'DPS',
    icon: DPS_ICON,
    render: (container) => mount(ctx, container),
  })

  ctx.registerOverlay(
    {
      title: 'Scalpel DPS',
      icon: DPS_ICON,
      hotkeyLabel: 'Toggle Scalpel DPS',
      defaultSize: WINDOW,
    },
    (container) => mount(ctx, container),
  )

  ctx.registerHotkey({ label: 'Open Scalpel DPS' }, () => {
    ctx.openOverlay()
  })
}

import type { ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { RUNESHAPE_ICON } from './icon'
import { createRuneshapeScanController, EMPTY_DIAG, RS_PRICE_X_FRAC, STATUS_LEFT_FRAC, STATUS_TOP_FRAC } from './run-scan'
import { PLUGIN_VERSION } from './decode-row'
import type { Fire, Label } from './types'

export default function activate(ctx: ScalpelPluginContext): void {
  if (ctx.getPoeVersion() !== 2) return

  const scan = createRuneshapeScanController(ctx)
  if (!location.pathname.includes('annotation')) scan.warm()

  ctx.registerHotkey({ label: 'Price Runeshape rewards' }, () => {
    void scan.runScan()
  })

  ctx.registerTab({
    label: 'Runeshape',
    icon: RUNESHAPE_ICON,
    render(container) {
      const root = createRoot(container)
      root.render(<App ctx={ctx} onScan={() => scan.runScan()} isBusy={scan.isBusy} />)
      return () => root.unmount()
    },
  })

  void (async () => {
    const lastVer = await ctx.storage.get<string>('pluginVersion')
    if (lastVer !== PLUGIN_VERSION) {
      await ctx.storage.set('pluginVersion', PLUGIN_VERSION)
      await ctx.storage.set('lastFire', { token: '', open: false, items: [], diag: EMPTY_DIAG })
      ctx.closeOverlay()
    }
  })()

  void (async () => {
    const seen = await ctx.storage.get<boolean>('setupOpened')
    if (!seen) {
      await ctx.storage.set('setupOpened', true)
      ctx.openTab()
    }
  })()

  ctx.registerOverlay({ mode: 'annotation', title: 'Runeshape Checker' }, (container) => {
    let drawnToken = ''
    let current: { items: Label[]; diag: Fire['diag'] } | null = null

    const clearInteractive = () => ctx.setInteractiveRegion(null)

    const agoText = (ts: number): string => {
      const mins = Math.max(0, Math.round((Date.now() - ts) / 60000))
      if (mins < 1) return 'just now'
      if (mins < 60) return `${mins}m ago`
      return `${Math.round(mins / 60)}h ago`
    }

    const draw = (state: { items: Label[]; diag: Fire['diag'] }) => {
      container.innerHTML = ''
      clearInteractive()
      const d = state.diag
      const colX = Math.round(window.innerHeight * RS_PRICE_X_FRAC)

      for (const it of state.items) {
        const el = document.createElement('div')
        el.textContent = it.text
        el.style.cssText = `position:absolute;left:${colX}px;top:${it.y}px;transform:translateY(-50%);font:bold 14px sans-serif;color:${
          it.top ? '#ffd24a' : '#e2e8f0'
        };background:rgba(0,0,0,0.82);padding:1px 7px;border-radius:3px;white-space:nowrap;pointer-events:none`
        container.appendChild(el)
      }

      const pill = document.createElement('div')
      pill.style.cssText = `position:absolute;left:${(window.innerHeight * STATUS_LEFT_FRAC).toFixed(0)}px;top:${(window.innerHeight * STATUS_TOP_FRAC).toFixed(0)}px;padding:4px 10px;background:rgba(23,24,33,0.96);border:1px solid rgba(56,56,77,0.5);border-radius:8px;color:#9e9480;font:11px system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.5);pointer-events:none;white-space:nowrap`
      if (d.loading) pill.textContent = d.phase ?? 'Scanning...'
      else if (d.note) pill.textContent = d.note.split('\n')[0]
      else {
        const parts = ['poe.ninja']
        if (d.updatedAt) parts.push(agoText(d.updatedAt))
        pill.textContent = parts.join(' · ')
      }
      container.appendChild(pill)

      if (d.debug) {
        const dbg = document.createElement('div')
        dbg.style.cssText =
          'position:absolute;right:12px;bottom:12px;max-width:min(520px,42vw);max-height:45vh;overflow:auto;padding:10px 12px;background:rgba(12,12,18,0.94);border:1px solid rgba(198,169,110,0.35);border-radius:8px;color:#c8d0dc;font:11px/1.4 ui-monospace,Consolas,monospace;white-space:pre-wrap;pointer-events:auto;box-shadow:0 4px 20px rgba(0,0,0,0.6)'
        const title = document.createElement('div')
        title.textContent = `Runeshape debug (v${PLUGIN_VERSION})`
        title.style.cssText =
          'color:#c8a96e;font-weight:700;margin-bottom:6px;font-family:system-ui,sans-serif;font-size:12px'
        const body = document.createElement('div')
        body.textContent = d.debug
        dbg.append(title, body)
        container.appendChild(dbg)
        const r = dbg.getBoundingClientRect()
        ctx.setInteractiveRegion({ x: r.x, y: r.y, width: r.width, height: r.height })
      }
    }

    const tick = async () => {
      let r: Fire | null = null
      try {
        r = await ctx.storage.get<Fire>('lastFire')
      } catch {
        return
      }
      if (!r) return
      if (r.token !== drawnToken) {
        drawnToken = r.token
        if (r.open) {
          current = { items: r.items, diag: r.diag }
          draw(current)
        } else {
          current = null
          clearInteractive()
          container.innerHTML = ''
        }
      } else if (current && container.childElementCount === 0) {
        draw(current)
      }
    }

    const id = setInterval(tick, 250)
    return () => {
      clearInterval(id)
      clearInteractive()
    }
  })
}

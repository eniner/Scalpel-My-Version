import { BrowserWindow, clipboard, ipcMain } from 'electron'

const PLUGIN_ID_PATTERN = /^[\w-]+$/
const ALLOWED_HOSTS = new Set(['www.craftofexile.com', 'craftofexile.com'])

export interface WebPanelOpenOptions {
  url: string
  title?: string
  width?: number
  height?: number
}

const panels = new Map<string, BrowserWindow>()

function assertPluginId(pluginId: string): void {
  if (!PLUGIN_ID_PATTERN.test(pluginId)) throw new Error('invalid plugin id')
}

function assertAllowedUrl(url: string): URL {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('invalid web panel url')
  }
  if (parsed.protocol !== 'https:') throw new Error('web panel URLs must be https')
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error(`web panel host not allowed: ${parsed.hostname}`)
  }
  return parsed
}

function panelKey(pluginId: string): string {
  return pluginId
}

function createPanelWindow(pluginId: string, opts: WebPanelOpenOptions): BrowserWindow {
  const win = new BrowserWindow({
    width: opts.width ?? 1280,
    height: opts.height ?? 900,
    minWidth: 640,
    minHeight: 480,
    title: opts.title ?? 'Scalpel Web Panel',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) win.showInactive()
  })
  win.on('closed', () => {
    panels.delete(panelKey(pluginId))
  })
  void win.loadURL(opts.url)
  return win
}

function openOrNavigatePanel(pluginId: string, opts: WebPanelOpenOptions): void {
  assertPluginId(pluginId)
  assertAllowedUrl(opts.url)
  const key = panelKey(pluginId)
  const existing = panels.get(key)
  if (existing && !existing.isDestroyed()) {
    if (opts.title) existing.setTitle(opts.title)
    void existing.loadURL(opts.url)
    existing.showInactive()
    return
  }
  const win = createPanelWindow(pluginId, opts)
  panels.set(key, win)
}

export function registerPluginWebPanelHandlers(): void {
  ipcMain.handle('plugins:web-panel-open', (_evt, pluginId: string, opts: WebPanelOpenOptions) => {
    openOrNavigatePanel(pluginId, opts)
  })

  ipcMain.handle('plugins:web-panel-navigate', (_evt, pluginId: string, url: string) => {
    openOrNavigatePanel(pluginId, { url })
  })

  ipcMain.handle('plugins:web-panel-close', (_evt, pluginId: string) => {
    assertPluginId(pluginId)
    const win = panels.get(panelKey(pluginId))
    if (win && !win.isDestroyed()) win.close()
  })

  ipcMain.handle('plugins:read-clipboard-text', () => clipboard.readText())
}

export function __resetWebPanelsForTests(): void {
  for (const win of panels.values()) {
    if (!win.isDestroyed()) win.destroy()
  }
  panels.clear()
}

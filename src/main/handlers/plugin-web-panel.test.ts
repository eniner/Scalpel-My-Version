import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockWindows: Array<{ destroyed: boolean; url: string; title: string; loadURL: ReturnType<typeof vi.fn> }> = []

vi.mock('electron', () => ({
  clipboard: { readText: vi.fn(() => 'Item Class: Body Armours') },
  ipcMain: { handle: vi.fn() },
  BrowserWindow: vi.fn(function BrowserWindowMock(this: unknown, _opts: unknown) {
    const self = {
      destroyed: false,
      url: '',
      title: '',
      loadURL: vi.fn(async (url: string) => {
        self.url = url
      }),
      setTitle: vi.fn((t: string) => {
        self.title = t
      }),
      setAlwaysOnTop: vi.fn(),
      once: vi.fn((_ev: string, cb: () => void) => cb()),
      on: vi.fn(),
      showInactive: vi.fn(),
      isDestroyed: () => self.destroyed,
      close: vi.fn(() => {
        self.destroyed = true
      }),
      destroy: vi.fn(() => {
        self.destroyed = true
      }),
    }
    mockWindows.push(self)
    return self
  }),
}))

describe('plugin-web-panel', () => {
  beforeEach(async () => {
    mockWindows.length = 0
    vi.clearAllMocks()
    const mod = await import('./plugin-web-panel')
    mod.__resetWebPanelsForTests()
    mod.registerPluginWebPanelHandlers()
  })

  it('registers ipc handlers', async () => {
    const { ipcMain } = await import('electron')
    expect(ipcMain.handle).toHaveBeenCalledWith('plugins:web-panel-open', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('plugins:read-clipboard-text', expect.any(Function))
  })

  it('rejects non-https urls', async () => {
    const { ipcMain } = await import('electron')
    const openHandler = vi.mocked(ipcMain.handle).mock.calls.find((c) => c[0] === 'plugins:web-panel-open')?.[1] as (
      _evt: unknown,
      pluginId: string,
      opts: { url: string },
    ) => void
    expect(() => openHandler({}, 'scalpel-lab', { url: 'http://www.example.com/' })).toThrow(/https/)
  })

  it('rejects disallowed hosts', async () => {
    const { ipcMain } = await import('electron')
    const openHandler = vi.mocked(ipcMain.handle).mock.calls.find((c) => c[0] === 'plugins:web-panel-open')?.[1] as (
      _evt: unknown,
      pluginId: string,
      opts: { url: string },
    ) => void
    expect(() => openHandler({}, 'scalpel-lab', { url: 'https://evil.example/' })).toThrow(/not allowed/)
  })
})

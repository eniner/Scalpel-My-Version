import koffi from 'koffi'
import { pickRunningGame, type GameVariant } from '@shared/contracts/game-variant'

type User32 = {
  GetForegroundWindow: () => unknown
  GetWindowTextW: (hwnd: unknown, buf: Buffer, max: number) => number
  IsWindowVisible: (hwnd: unknown) => boolean
  EnumWindows: (cb: unknown, lp: unknown) => boolean
}

let user32: User32 | null | undefined
let enumProc: unknown
let registeredEnum: unknown

function loadUser32(): User32 | null {
  if (user32 !== undefined) return user32
  if (process.platform !== 'win32') {
    user32 = null
    return null
  }
  try {
    const lib = koffi.load('user32.dll')
    const EnumWindowsProc = koffi.proto('bool EnumWindowsProc(void *hWnd, void *lParam)')
    enumProc = EnumWindowsProc
    user32 = {
      GetForegroundWindow: lib.func('void *GetForegroundWindow()') as User32['GetForegroundWindow'],
      GetWindowTextW: lib.func(
        'int GetWindowTextW(void *hWnd, uint16 *lpString, int nMaxCount)',
      ) as User32['GetWindowTextW'],
      IsWindowVisible: lib.func('bool IsWindowVisible(void *hWnd)') as User32['IsWindowVisible'],
      EnumWindows: lib.func('bool EnumWindows(EnumWindowsProc *lpEnumFunc, void *lParam)') as User32['EnumWindows'],
    }
    return user32
  } catch {
    user32 = null
    return null
  }
}

function readWindowTitle(hwnd: unknown): string | null {
  const api = loadUser32()
  if (!api || !hwnd) return null
  const buf = Buffer.alloc(1024)
  const n = api.GetWindowTextW(hwnd, buf, 512)
  if (n <= 0) return null
  return buf.toString('utf16le').slice(0, n)
}

export function readForegroundWindowTitle(): string | null {
  const api = loadUser32()
  if (!api) return null
  try {
    return readWindowTitle(api.GetForegroundWindow())
  } catch {
    return null
  }
}

export function listVisibleWindowTitles(): string[] {
  const api = loadUser32()
  if (!api || !enumProc) return []
  const titles: string[] = []
  try {
    const cb = koffi.register(
      (hwnd: unknown) => {
        try {
          if (!api.IsWindowVisible(hwnd)) return true
          const title = readWindowTitle(hwnd)
          if (title) titles.push(title)
        } catch {
          /* skip this hwnd */
        }
        return true
      },
      koffi.pointer(enumProc as never),
    )
    registeredEnum = cb
    api.EnumWindows(cb, null)
    koffi.unregister(cb)
    registeredEnum = null
  } catch {
    if (registeredEnum) {
      try {
        koffi.unregister(registeredEnum)
      } catch {
        /* ignore */
      }
      registeredEnum = null
    }
  }
  return titles
}

/** Which PoE is actually running/focused. Null if neither, or both without focus. */
export function detectRunningPoeGame(): GameVariant | null {
  return pickRunningGame(readForegroundWindowTitle(), listVisibleWindowTitles())
}

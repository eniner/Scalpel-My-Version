import { useCallback, useEffect, useState } from 'react'

const PLUGIN_ACTION = 'plugin:runeshape-checker'

type AppMacro = { action: string; hotkey?: string }

type SettingsSlice = { appMacros?: AppMacro[] }

function readHotkey(settings: SettingsSlice): string {
  return settings.appMacros?.find((m) => m.action === PLUGIN_ACTION)?.hotkey ?? ''
}

type HostApi = {
  getSettings: () => Promise<{ appMacros?: AppMacro[] }>
  setSetting: (key: 'appMacros', value: AppMacro[]) => Promise<void>
  onPluginHotkeysChanged: (cb: () => void) => () => void
}

function hostApi(): HostApi {
  return (window as unknown as { api: HostApi }).api
}

async function persistHotkey(next: string): Promise<void> {
  const settings = await hostApi().getSettings()
  const macros = settings.appMacros ?? []
  const index = macros.findIndex((m) => m.action === PLUGIN_ACTION)
  if (index >= 0) {
    await hostApi().setSetting(
      'appMacros',
      macros.map((m, i) => (i === index ? { ...m, hotkey: next } : m)),
    )
    return
  }
  if (next) {
    await hostApi().setSetting('appMacros', [...macros, { action: PLUGIN_ACTION, hotkey: next }])
  }
}

/** Bind the plugin scan hotkey from inside the tab (same row as Settings → Plugins). */
export function usePluginHotkey(): { hotkey: string; setHotkey: (next: string) => void } {
  const [hotkey, setHotkeyState] = useState('')

  const refresh = useCallback(async () => {
    const settings = await hostApi().getSettings()
    setHotkeyState(readHotkey(settings))
  }, [])

  useEffect(() => {
    void refresh()
    const off = hostApi().onPluginHotkeysChanged(() => {
      void refresh()
    })
    return off
  }, [refresh])

  const setHotkey = useCallback((next: string) => {
    void persistHotkey(next).then(() => setHotkeyState(next))
  }, [])

  return { hotkey, setHotkey }
}

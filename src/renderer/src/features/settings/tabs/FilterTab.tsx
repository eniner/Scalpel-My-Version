import type { AppSettings, ProfileSettingValue, PoeItem, RuntimeSettings } from '@shared/types'
import { getGameFeatures } from '@shared/game-features'
import { getApplyItemFilterToRitual, setApplyItemFilterToRitual } from '@shared/poe-config-ini'
import { FilterPicker } from '@renderer/components/FilterPicker'
import { FilterSectionEditor } from '@renderer/components/FilterSectionEditor'
import { CustomTiersPanel } from '@renderer/components/CustomTiersPanel'
import { LootSimulator } from '@renderer/components/LootSimulator'
import { HistoryPanel } from '@renderer/components/HistoryPanel'
import { HotkeyField } from '@renderer/components/primitives/HotkeyField'
import { SettingToggleBox } from '@renderer/components/primitives/SettingToggleBox'
import { useCallback, useEffect, useState } from 'react'
import { m } from '@shared/paraglide/messages.js'

interface Props {
  settings: RuntimeSettings
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  updateProfile: <K extends 'filterPath' | 'filterDir'>(key: K, value: ProfileSettingValue<K>) => Promise<void>
  isOverlay: boolean
  onOnlineFilterUpdated?: (name: string) => void
  onOnlineImport?: (name: string) => void
  onSettingsChange: (s: RuntimeSettings) => void
  tryHotkey: (hotkey: string, slot: { kind: 'filter' }) => boolean
  currentItem?: PoeItem
}

export function FilterTab({
  settings,
  update,
  updateProfile: _updateProfile,
  isOverlay,
  onOnlineFilterUpdated,
  onOnlineImport,
  onSettingsChange,
  tryHotkey,
  currentItem,
}: Props): JSX.Element {
  const features = getGameFeatures(settings.poeVersion)
  const filterPath = settings.activeProfile?.filterPath
  const isPoe2 = settings.poeVersion === 2
  const [ritualFilter, setRitualFilter] = useState<boolean | null>(null)
  const [ritualBusy, setRitualBusy] = useState(false)
  const [ritualError, setRitualError] = useState<string | null>(null)

  const refreshRitualFilter = useCallback(async () => {
    if (!isPoe2) {
      setRitualFilter(null)
      return
    }
    try {
      const { content } = await window.api.gameConfigRead()
      setRitualFilter(getApplyItemFilterToRitual(content))
      setRitualError(null)
    } catch (e) {
      setRitualFilter(null)
      setRitualError(e instanceof Error ? e.message : String(e))
    }
  }, [isPoe2])

  useEffect(() => {
    void refreshRitualFilter()
    if (!isPoe2) return
    return window.api.onGameConfigChange(() => {
      void refreshRitualFilter()
    })
  }, [isPoe2, refreshRitualFilter])

  const onRitualFilterChange = useCallback(
    async (next: boolean) => {
      if (ritualBusy) return
      setRitualBusy(true)
      setRitualError(null)
      try {
        const { content } = await window.api.gameConfigRead()
        const updated = setApplyItemFilterToRitual(content, next)
        await window.api.gameConfigWrite(updated)
        setRitualFilter(next)
      } catch (e) {
        setRitualError(e instanceof Error ? e.message : String(e))
        void refreshRitualFilter()
      } finally {
        setRitualBusy(false)
      }
    },
    [ritualBusy, refreshRitualFilter],
  )

  if (isOverlay && !filterPath) {
    return (
      <>
        <div className="settings-section-title mt-3">{m.settings_filter_setup_title()}</div>
        <p className="text-[12px] text-text-dim mb-2">{m.settings_filter_setup_body()}</p>

        <section>
          <label>{m.settings_filter_folder()}</label>
          <div className="mt-[6px]">
            <FilterPicker
              settings={settings}
              onSettingsChange={onSettingsChange}
              autoSwitchInGame={true}
              onOnlineFilterUpdated={onOnlineFilterUpdated}
              onOnlineImport={onOnlineImport}
              mode={undefined}
            />
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <div className="settings-section-title mt-3">{m.settings_filter_heading()}</div>

      <section>
        <label>Edit filter sections</label>
        <div className="mt-[6px] mb-2 flex flex-wrap gap-2 items-center">
          <button
            type="button"
            className="px-2.5 py-1 text-[11px]"
            disabled={!filterPath}
            title={filterPath ? 'Open a large sister window for easier editing' : 'Select a local filter first'}
            onClick={() => window.api.filterSectionEditor.show()}
          >
            Open large editor
          </button>
          <span className="text-[11px] text-text-dim">Sister window · bigger workspace</span>
        </div>
        <div className="mt-[6px]">
          <FilterSectionEditor filterPath={filterPath} />
        </div>
      </section>

      <CustomTiersPanel filterPath={filterPath} />

      <section>
        <label>Loot simulator</label>
        <div className="mt-[6px]">
          <LootSimulator filterPath={filterPath} />
        </div>
      </section>

      <section>
        <label>{m.settings_filter_folder()}</label>
        <div className="mt-[6px]">
          <FilterPicker
            settings={settings}
            onSettingsChange={onSettingsChange}
            autoSwitchInGame={isOverlay || undefined}
            onOnlineFilterUpdated={onOnlineFilterUpdated}
            onOnlineImport={onOnlineImport}
            maxListHeight={140}
          />
        </div>
        {isOverlay && !filterPath && (
          <p className="text-[11px] text-text-dim mt-1">
            {m.settings_filter_folder_typically()} <code>{features.filterFolderHint}</code>
          </p>
        )}
      </section>

      <section>
        <label>{m.settings_filter_hotkey()}</label>
        <div className="mt-[6px]">
          <HotkeyField
            value={settings.hotkey}
            onChange={(acc) => {
              if (!tryHotkey(acc, { kind: 'filter' })) return
              update('hotkey', acc)
            }}
          />
        </div>
      </section>

      <SettingToggleBox
        label={m.settings_reload_on_save()}
        checked={settings.reloadOnSave}
        onChange={(val) => update('reloadOnSave', val)}
      />

      {isPoe2 && ritualFilter != null ? (
        <>
          <SettingToggleBox
            label={m.settings_apply_filter_to_ritual()}
            checked={ritualFilter}
            onChange={(val) => {
              void onRitualFilterChange(val)
            }}
          />
          <p className="text-[11px] text-text-dim -mt-1 mb-2">{m.settings_apply_filter_to_ritual_hint()}</p>
        </>
      ) : null}
      {ritualError ? (
        <p className="text-[11px] text-red-400 mb-2">
          {m.settings_apply_filter_to_ritual_error({ error: ritualError })}
        </p>
      ) : null}

      <HistoryPanel item={currentItem} />
    </>
  )
}

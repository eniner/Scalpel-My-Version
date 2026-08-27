import { useEffect, useMemo, useState } from 'react'
import type { AppSettings } from '@shared/types'
import type { ThemePalette, ThemePreset } from '@shared/theme/palette'
import { PRESETS, PRESET_GROUPS, CUSTOM_THEME_ID } from '@shared/theme/presets'
import { FONT_PACKAGES } from '@shared/theme/fonts'
import { resolveActivePalette } from '@shared/theme/active'
import { contrastRatio } from '@shared/color'
import { applyPalette, applyVars, applyFontPackage } from '@renderer/shared/apply-theme'
import { CollapsibleSection } from '@renderer/shared/CollapsibleSection'

interface EyeDropperResult {
  sRGBHex: string
}
interface EyeDropperCtor {
  new (): { open: () => Promise<EyeDropperResult> }
}

function DropperIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15.5359 2.80684C16.2889 2.07063 17.3019 1.66107 18.355 1.66706C19.4081 1.67304 20.4163 2.09409 21.1609 2.83882C21.9055 3.58354 22.3264 4.59187 22.3322 5.64496C22.338 6.69806 21.9283 7.71096 21.1919 8.46384L18.3639 11.2928L18.7179 11.6468C18.9054 11.8345 19.0107 12.0889 19.0106 12.3542C19.0105 12.6195 18.9051 12.8738 18.7174 13.0613C18.5298 13.2489 18.2753 13.3541 18.0101 13.354C17.7448 13.354 17.4904 13.2485 17.3029 13.0608L16.9499 12.7068L10.7349 18.9218C10.1765 19.4803 9.46531 19.8609 8.69092 20.0158L6.93692 20.3658C6.54961 20.4436 6.19399 20.6343 5.91492 20.9138L4.92892 21.8998C4.74139 22.0873 4.48708 22.1926 4.22192 22.1926C3.95675 22.1926 3.70244 22.0873 3.51492 21.8998L2.09992 20.4848C1.91244 20.2973 1.80713 20.043 1.80713 19.7778C1.80713 19.5127 1.91244 19.2584 2.09992 19.0708L3.08592 18.0848C3.36477 17.8055 3.55475 17.4499 3.63192 17.0628L3.98292 15.3088C4.13781 14.5345 4.51847 13.8232 5.07692 13.2648L11.2919 7.04984L10.9379 6.69684C10.7504 6.5092 10.6451 6.25476 10.6452 5.98949C10.6453 5.85814 10.6712 5.72809 10.7215 5.60676C10.7718 5.48542 10.8455 5.37519 10.9384 5.28234C11.0313 5.1895 11.1416 5.11586 11.263 5.06564C11.3843 5.01542 11.5144 4.98959 11.6458 4.98964C11.911 4.98973 12.1654 5.0952 12.3529 5.28284L12.7059 5.63584L15.5359 2.80684ZM12.7069 8.46484L6.49192 14.6788C6.21269 14.958 6.02236 15.3136 5.94492 15.7008L5.59492 17.4558C5.43974 18.2303 5.05873 18.9416 4.49992 19.4998C5.05831 18.9414 5.76953 18.5607 6.54392 18.4058L8.29792 18.0548C8.68511 17.9774 9.04072 17.7871 9.31991 17.5078L15.5349 11.2928L12.7069 8.46484Z"
        fill="currentColor"
      />
    </svg>
  )
}

interface Props {
  settings: AppSettings
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  updateMany: (patch: Partial<AppSettings>) => void
}

const HEX = /^#[0-9a-fA-F]{6}$/

const FIELD_GROUPS: Array<{ label: string; fields: Array<{ key: keyof ThemePalette; label: string }> }> = [
  {
    label: 'Surfaces',
    fields: [
      { key: 'bgSolid', label: 'Background' },
      { key: 'bgCard', label: 'Card' },
      { key: 'border', label: 'Border' },
    ],
  },
  {
    label: 'Type',
    fields: [
      { key: 'text', label: 'Text' },
      { key: 'textDim', label: 'Dim text' },
      { key: 'accent', label: 'Accent' },
    ],
  },
  {
    label: 'Highlights',
    fields: [
      { key: 'match', label: 'Match' },
      { key: 'secondaryMatch', label: 'Secondary match' },
    ],
  },
  {
    label: 'Alerts',
    fields: [
      { key: 'danger', label: 'Danger' },
      { key: 'warn', label: 'Warning' },
      { key: 'dangerBg', label: 'Danger background' },
    ],
  },
  {
    label: 'Filter',
    fields: [
      { key: 'hideColor', label: 'Filter: Hide' },
      { key: 'showColor', label: 'Filter: Show' },
      { key: 'minimalColor', label: 'Filter: Minimal' },
    ],
  },
]

function PresetChip({
  preset,
  selected,
  dirty,
  onSelect,
}: {
  preset: ThemePreset
  selected: boolean
  dirty: boolean
  onSelect: () => void
}): JSX.Element {
  const { bgSolid, bgCard, accent, match } = preset.palette
  return (
    <button
      type="button"
      onClick={onSelect}
      title={preset.name}
      className={`text-[11px] px-2 py-1.5 min-w-[7.5rem] flex flex-col gap-1.5 items-stretch rounded-md border ${
        selected ? 'border-accent bg-bg-card text-text' : 'border-transparent text-text-dim hover:border-border'
      }`}
    >
      <span className="flex h-3.5 overflow-hidden rounded-sm" aria-hidden="true">
        {[bgSolid, bgCard, accent, match].map((c, i) => (
          <span key={i} className="flex-1" style={{ background: c }} />
        ))}
      </span>
      <span className="flex items-center justify-between gap-1 leading-none">
        <span>{preset.name}</span>
        {selected && dirty && <span className="text-[9px] text-accent">edited</span>}
      </span>
    </button>
  )
}

export function ThemeSettings({ settings, update, updateMany }: Props): JSX.Element {
  const EyeDropperApi = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper

  const [working, setWorking] = useState<ThemePalette>(() =>
    resolveActivePalette(settings.themeId, settings.customThemePalette ?? null),
  )
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!dirty) setWorking(resolveActivePalette(settings.themeId, settings.customThemePalette ?? null))
  }, [settings.themeId, settings.customThemePalette, dirty])

  const selectPreset = (id: string): void => {
    const palette = resolveActivePalette(id, settings.customThemePalette ?? null)
    setWorking(palette)
    setDirty(false)
    applyPalette(palette)
    update('themeId', id)
  }

  const editColor = (key: keyof ThemePalette, value: string): void => {
    const next = { ...working, [key]: value.toLowerCase() }
    setWorking(next)
    setDirty(true)
    applyVars(next)
  }

  const saveCustom = (): void => {
    updateMany({ customThemePalette: working, themeId: CUSTOM_THEME_ID })
    setDirty(false)
    applyPalette(working)
  }

  const reset = (): void => {
    const base = resolveActivePalette(settings.themeId, settings.customThemePalette ?? null)
    setWorking(base)
    setDirty(false)
    applyPalette(base)
  }

  const pickFromScreen = async (key: keyof ThemePalette): Promise<void> => {
    if (!EyeDropperApi) return
    await window.api.suspendInputHook()
    try {
      const { sRGBHex } = await new EyeDropperApi().open()
      editColor(key, sRGBHex)
    } catch {
      // cancelled
    } finally {
      await window.api.resumeInputHook()
    }
  }

  const presetList: ThemePreset[] = useMemo(
    () =>
      settings.customThemePalette
        ? [...PRESETS, { id: CUSTOM_THEME_ID, name: 'Custom', group: 'core', palette: settings.customThemePalette }]
        : PRESETS,
    [settings.customThemePalette],
  )

  const textContrast = contrastRatio(working.text, working.bgSolid)
  const dimContrast = contrastRatio(working.textDim, working.bgSolid)

  return (
    <>
      <div className="settings-section-title mt-3">Theme</div>

      <section>
        <label>Presets</label>
        <p className="text-[10px] text-text-dim mt-1 mb-0">
          Click a theme to apply it. Use Customize to tweak colors, then save as Custom.
        </p>
        {PRESET_GROUPS.map((group) => {
          const items = presetList.filter((p) => p.group === group.id)
          if (items.length === 0) return null
          return (
            <div key={group.id} className="mt-2">
              <div className="text-[10px] uppercase tracking-wide text-text-dim mb-1">{group.label}</div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((p) => (
                  <PresetChip
                    key={p.id}
                    preset={p}
                    selected={settings.themeId === p.id}
                    dirty={dirty && settings.themeId === p.id}
                    onSelect={() => selectPreset(p.id)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </section>

      <section>
        <label>Font package</label>
        <p className="text-[10px] text-text-dim mt-1 mb-0">
          Uses Windows system fonts plus bundled Fontin. Path of Exile keeps loot labels in Fontin.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {FONT_PACKAGES.map((pack) => {
            const selected = (settings.fontPackageId ?? 'fontin') === pack.id
            return (
              <button
                key={pack.id}
                type="button"
                title={pack.blurb}
                onClick={() => {
                  applyFontPackage(pack.id)
                  update('fontPackageId', pack.id)
                }}
                className={`text-left text-[11px] px-2.5 py-1.5 min-w-[7.5rem] rounded-md border ${
                  selected
                    ? 'border-accent bg-bg-card text-text'
                    : 'border-transparent text-text-dim hover:border-border'
                }`}
              >
                <span className="block leading-tight" style={{ fontFamily: pack.ui }}>
                  {pack.name}
                </span>
                <span className="block text-[9px] text-text-dim mt-0.5 leading-tight">{pack.blurb}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <CollapsibleSection title={<label className="cursor-pointer">Customize</label>}>
          <>
            {FIELD_GROUPS.map((group) => (
              <div key={group.label} className="mt-2">
                <div className="text-[10px] uppercase tracking-wide text-text-dim mb-1">{group.label}</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {group.fields.map((f) => (
                    <label key={f.key} className="flex items-center justify-between gap-2 text-[11px] text-text-dim">
                      <span>{f.label}</span>
                      <span className="flex items-center gap-1.5">
                        {EyeDropperApi && (
                          <button
                            type="button"
                            title="Pick color from screen"
                            onClick={(e) => {
                              e.preventDefault()
                              void pickFromScreen(f.key)
                            }}
                            className="text-text-dim cursor-pointer flex items-center px-1"
                          >
                            <DropperIcon />
                          </button>
                        )}
                        <input
                          type="color"
                          value={working[f.key]}
                          onChange={(e) => editColor(f.key, e.target.value)}
                          className="w-8 h-6 bg-transparent cursor-pointer"
                        />
                        <input
                          type="text"
                          spellCheck={false}
                          aria-label={`${f.label} hex`}
                          value={working[f.key]}
                          onChange={(e) => {
                            const v = e.target.value
                            if (HEX.test(v)) editColor(f.key, v)
                          }}
                          className="w-[4.6rem] h-6 px-1 text-[10px] font-mono bg-bg-solid text-text border border-border rounded-sm"
                        />
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {(textContrast < 4.5 || dimContrast < 3) && (
              <p className="text-[10px] text-warn mt-2 mb-0">
                {textContrast < 4.5
                  ? `Body text contrast is ${textContrast.toFixed(1)}:1 against the background (aim for 4.5:1).`
                  : `Dim text contrast is ${dimContrast.toFixed(1)}:1 (aim for 3:1).`}
              </p>
            )}
            <div className="flex gap-1.5 mt-3">
              <button
                onClick={saveCustom}
                disabled={!dirty}
                className={`text-[11px] px-3 py-1.5 ${dirty ? 'bg-accent text-bg-solid' : 'text-text-dim opacity-50'}`}
              >
                Save custom theme
              </button>
              <button
                onClick={reset}
                disabled={!dirty}
                className={`text-[11px] px-3 py-1.5 text-text-dim ${dirty ? '' : 'opacity-50'}`}
              >
                Reset
              </button>
            </div>
          </>
        </CollapsibleSection>
      </section>
    </>
  )
}

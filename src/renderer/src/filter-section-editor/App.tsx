import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FilterListEntry, PoeProfileSummary, RuntimeSettings } from '@shared/types'
import { FilterSectionEditor } from '@renderer/components/FilterSectionEditor'
import { Chrome } from '@renderer/secondary-overlay/Chrome'

/** Large sister window — pick profile + any local .filter in the PoE loot folder. */
export function FilterSectionEditorApp(): JSX.Element {
  const [settings, setSettings] = useState<RuntimeSettings | null>(null)
  const [profiles, setProfiles] = useState<PoeProfileSummary[]>([])
  const [filters, setFilters] = useState<FilterListEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filterPath = settings?.activeProfile?.filterPath ?? null
  const filterDir = settings?.activeProfile?.filterDir ?? ''
  const activeProfileId = settings?.activeProfileId ?? profiles.find((p) => p.active)?.id ?? ''
  const poeVersion = settings?.poeVersion === 2 ? 2 : 1

  const reloadMeta = useCallback(async (): Promise<RuntimeSettings | null> => {
    try {
      const [nextSettings, nextProfiles] = await Promise.all([window.api.getSettings(), window.api.listProfiles()])
      setSettings(nextSettings)
      setProfiles(nextProfiles)
      setError(null)
      return nextSettings
    } catch (err) {
      setError(String(err))
      return null
    }
  }, [])

  const reloadFilters = useCallback(async (dir: string): Promise<FilterListEntry[]> => {
    if (!dir) {
      setFilters([])
      return []
    }
    try {
      // Local .filter files only (same list PoE shows for custom filters on disk).
      // OnlineFilters (GGG downloads / NeverSink online) are excluded so we never
      // auto-import or push those into the editor.
      const entries = await window.api.scanFilterDir(dir)
      const local = entries.filter((e) => !e.online).sort((a, b) => a.name.localeCompare(b.name))
      setFilters(local)
      return local
    } catch {
      setFilters([])
      return []
    }
  }, [])

  /** Point Scalpel at the game's filter folder without importing OnlineFilters. */
  const ensureFilterDir = useCallback(async (current: RuntimeSettings | null): Promise<RuntimeSettings | null> => {
    const variant = (current?.poeVersion === 2 ? 2 : 1) as 1 | 2
    let next = current
    let dir = next?.activeProfile?.filterDir ?? ''

    // If we already have a filterPath, derive the folder from it.
    const path = next?.activeProfile?.filterPath ?? ''
    if (!dir && path) {
      const sep = path.includes('/') ? '/' : '\\'
      const idx = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'))
      if (idx > 0) {
        dir = path.slice(0, idx)
        next = await window.api.setProfileSettingForGame(variant, 'filterDir', dir)
        setSettings(next)
      }
    }

    if (dir) return next

    // Empty folder — detect from PoE config / Documents.
    setDetecting(true)
    try {
      const result = await window.api.detectActiveGameFilter()
      if (!result.ok) {
        setError(result.error || 'Could not find PoE filter folder — use Browse.')
        return next
      }
      const { detected } = result
      next = await window.api.setProfileSettingForGame(variant, 'filterDir', detected.filterDir)
      setSettings(next)

      // Only auto-select a filter if the game is already on a local .filter file.
      // Never auto-select OnlineFilters / NeverSink downloads.
      if (!detected.online && detected.filterPath.toLowerCase().endsWith('.filter')) {
        next = await window.api.setProfileSettingForGame(variant, 'filterPath', detected.filterPath)
        setSettings(next)
      }
      setError(null)
      return next
    } catch (err) {
      setError(String(err))
      return next
    } finally {
      setDetecting(false)
    }
  }, [])

  useEffect(() => {
    let alive = true
    void (async () => {
      const meta = await reloadMeta()
      if (!alive || !meta) return
      const ensured = await ensureFilterDir(meta)
      if (!alive) return
      const dir = ensured?.activeProfile?.filterDir ?? ''
      await reloadFilters(dir)
    })()
    return () => {
      alive = false
    }
  }, [reloadMeta, ensureFilterDir, reloadFilters])

  useEffect(() => {
    return window.api.onSettingUpdated((key) => {
      if (key === 'filterPath' || key === 'filterDir' || key === 'activeProfileId' || key === 'activeProfile') {
        void (async () => {
          const meta = await reloadMeta()
          await reloadFilters(meta?.activeProfile?.filterDir ?? '')
        })()
      }
    })
  }, [reloadMeta, reloadFilters])

  const sameGameProfiles = useMemo(() => profiles.filter((p) => p.gameVariant === poeVersion), [profiles, poeVersion])

  const selectProfile = async (id: string): Promise<void> => {
    if (!id || id === activeProfileId) return
    setBusy(true)
    setError(null)
    try {
      const result = await window.api.setActiveProfile(id, false)
      if (!result.ok) {
        if ('requiresRestart' in result && result.requiresRestart) {
          setError('That profile is for the other game — switch game in Scalpel first.')
        } else {
          setError('error' in result ? result.error : 'Failed to switch profile')
        }
        return
      }
      const next = 'settings' in result && result.settings ? result.settings : await reloadMeta()
      if (next) {
        setSettings(next)
        const ensured = await ensureFilterDir(next)
        await reloadFilters(ensured?.activeProfile?.filterDir ?? '')
      }
    } finally {
      setBusy(false)
    }
  }

  const selectFilter = async (path: string): Promise<void> => {
    if (!path || path === filterPath) return
    setBusy(true)
    setError(null)
    try {
      const updated = await window.api.setProfileSettingForGame(poeVersion, 'filterPath', path)
      setSettings(updated)
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }

  const browseFolder = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const dir = await window.api.pickFilterDir()
      if (!dir) return
      const updated = await window.api.setProfileSettingForGame(poeVersion, 'filterDir', dir)
      setSettings(updated)
      await reloadFilters(dir)
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }

  const detectFolder = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const ensured = await ensureFilterDir(settings)
      await reloadFilters(ensured?.activeProfile?.filterDir ?? '')
    } finally {
      setBusy(false)
    }
  }

  const filterSelectValue =
    filterPath && filters.some((f) => f.path === filterPath) ? filterPath : filterPath ? filterPath : ''

  return (
    <Chrome
      headerContent={
        <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
          <span className="text-[12px] font-semibold text-accent shrink-0">Filter section editor</span>
          <label className="flex items-center gap-1 min-w-0 text-[11px] text-text-dim">
            <span className="shrink-0">Profile</span>
            <select
              value={activeProfileId}
              disabled={busy || sameGameProfiles.length === 0}
              onChange={(e) => void selectProfile(e.target.value)}
              aria-label="Loot profile"
              className="max-w-[140px] truncate bg-black/40 border border-border rounded px-1.5 py-0.5 text-[11px] text-text"
            >
              {sameGameProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 min-w-0 flex-1 text-[11px] text-text-dim">
            <span className="shrink-0">Filter</span>
            <select
              value={filterSelectValue}
              disabled={busy || (filters.length === 0 && !filterPath)}
              onChange={(e) => void selectFilter(e.target.value)}
              aria-label="Local filter file"
              className="min-w-0 flex-1 truncate bg-black/40 border border-border rounded px-1.5 py-0.5 text-[11px] text-text"
              title={filterPath ?? filterDir ?? undefined}
            >
              {filters.length === 0 && !filterPath && (
                <option value="">{detecting ? 'Detecting folder…' : 'No local filters — Detect or Browse'}</option>
              )}
              {filterPath && !filters.some((f) => f.path === filterPath) && (
                <option value={filterPath}>
                  {filterPath.replace(/^.*[\\/]/, '').replace(/\.filter$/i, '')} (current)
                </option>
              )}
              {filters.map((f) => (
                <option key={f.path} value={f.path}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busy || detecting}
            onClick={() => void detectFolder()}
            title="Find PoE filter folder from game config"
            className="shrink-0 text-[10px] px-1.5 py-0.5"
          >
            {detecting ? '…' : 'Detect'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void browseFolder()}
            title="Browse to Documents\\My Games\\Path of Exile"
            className="shrink-0 text-[10px] px-1.5 py-0.5"
          >
            Browse
          </button>
        </div>
      }
      onClose={() => window.api.filterSectionEditor.requestClose()}
    >
      <div className="flex-1 min-h-0 overflow-hidden p-3 flex flex-col gap-2">
        {error && <div className="text-[12px] text-red-400 shrink-0">{error}</div>}
        {!filterDir && (
          <p className="text-[12px] text-text-dim m-0">
            No filter folder on this profile. Click <strong>Detect</strong> (reads PoE config) or{' '}
            <strong>Browse</strong> to your Path of Exile filters folder — then pick e.g. “3.29 RF Campaign…” from the
            Filter list.
          </p>
        )}
        {filterDir && filters.length === 0 && (
          <p className="text-[12px] text-text-dim m-0">
            Folder set, but no <code>.filter</code> files found: {filterDir}
          </p>
        )}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <FilterSectionEditor filterPath={filterPath} variant="window" />
        </div>
      </div>
    </Chrome>
  )
}

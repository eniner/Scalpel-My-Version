import type { ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import {
  Button,
  ErrorBanner,
  HotkeyRecorder,
  Label,
  prettyHotkey,
} from '@scalpelpoe/plugin-sdk'
import { useCallback, useEffect, useState } from 'react'
import type { Fire, ScanOutcome } from './types'
import { usePluginHotkey } from './use-plugin-hotkey'

interface AppProps {
  ctx: ScalpelPluginContext
  onScan: () => Promise<ScanOutcome>
  isBusy: () => boolean
}

function statusFromOutcome(outcome: ScanOutcome): { message: string; tone: 'error' | 'warn' } | null {
  if (outcome === 'no-focus') {
    return {
      message:
        'Could not capture PoE. Click the game window first, or run Scalpel as administrator if PoE is elevated.',
      tone: 'error',
    }
  }
  if (outcome === 'busy') {
    return { message: 'Scan already in progress.', tone: 'warn' }
  }
  return null
}

function summaryFromFire(fire: Fire | null): string | null {
  if (!fire?.open) return null
  if (fire.diag.loading) return fire.diag.phase ?? 'Scanning...'
  if (fire.diag.note) return fire.diag.note.split('\n')[0]
  if (fire.items.length > 0) return `${fire.items.length} reward prices on screen`
  return null
}

export function App({ ctx, onScan, isBusy }: AppProps): JSX.Element {
  const { hotkey, setHotkey } = usePluginHotkey()
  const [scanning, setScanning] = useState(false)
  const [banner, setBanner] = useState<{ message: string; tone: 'error' | 'warn' } | null>(null)
  const [lastSummary, setLastSummary] = useState<string | null>(null)

  const refreshSummary = useCallback(async () => {
    const fire = await ctx.storage.get<Fire>('lastFire')
    setLastSummary(summaryFromFire(fire))
  }, [ctx])

  useEffect(() => {
    void refreshSummary()
    const id = setInterval(() => {
      void refreshSummary()
    }, 500)
    return () => clearInterval(id)
  }, [refreshSummary])

  const run = useCallback(async () => {
    if (scanning || isBusy()) return
    setBanner(null)
    setScanning(true)
    try {
      const outcome = await onScan()
      const err = statusFromOutcome(outcome)
      if (err) setBanner(err)
      await refreshSummary()
    } finally {
      setScanning(false)
    }
  }, [isBusy, onScan, refreshSummary, scanning])

  const busy = scanning || isBusy()

  return (
    <div className="flex flex-col gap-4 p-4 text-text">
      <div>
        <h2 className="text-[15px] font-semibold text-text m-0">Runeshape Checker</h2>
        <p className="text-[12px] text-text-dim mt-1.5 mb-0 leading-relaxed">
          Testing plugin for Runeshape OCR only — not bundled with Scalpel OCR / production.
        </p>
      </div>

      <ErrorBanner message={banner?.message ?? null} tone={banner?.tone ?? 'error'} inline />

      <div className="flex flex-col gap-2">
        <Button variant="primary" disabled={busy} onClick={() => void run()}>
          {busy ? 'Scanning…' : 'Scan now'}
        </Button>
        {lastSummary && <p className="text-[11px] text-text-dim m-0">{lastSummary}</p>}
      </div>

      <div className="border-t border-white/10 pt-4 flex flex-col gap-2">
        <Label>Scan hotkey</Label>
        <p className="text-[11px] text-text-dim m-0 -mt-1">
          Click the box, press a key combo. Same binding as Settings → Plugins → Runeshape Checker.
        </p>
        <HotkeyRecorder
          value={hotkey}
          onChange={setHotkey}
          className="w-full max-w-[280px]"
          placeholder="Click to set hotkey"
          clearable
        />
        {hotkey ? (
          <p className="text-[11px] text-text-dim m-0">
            Bound to <span className="font-mono text-text">{prettyHotkey(hotkey)}</span>
          </p>
        ) : (
          <p className="text-[11px] text-amber-200/80 m-0">No hotkey yet — use Scan now above, or bind one here.</p>
        )}
      </div>

      <div className="text-[11px] text-text-dim leading-relaxed border-t border-white/10 pt-3">
        <strong className="text-text font-medium">Tips</strong>
        <ul className="mt-1.5 mb-0 pl-4 space-y-1">
          <li>Row count is detected from the page layout (typically 8–12 rows per rune page).</li>
          <li>Every row gets a label — priced or skill name — even when OCR is weak.</li>
          <li>If capture fails, run Scalpel as admin when PoE is elevated.</li>
        </ul>
      </div>
    </div>
  )
}

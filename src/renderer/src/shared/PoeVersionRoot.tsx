import { useEffect, useState, type ReactNode } from 'react'
import { PoeVersionProvider } from './poe-version-context'
import { CurrencyLabelsProvider } from './currency-labels-context'

/** Loads current PoE version + a11y settings from the main process on mount
 *  and exposes them via PoeVersionProvider + CurrencyLabelsProvider. Used by
 *  secondary-overlay entry points whose renderers need version context (for
 *  hooks like useStickyZone, usePoeVersion). Renders children with version=1
 *  and labels-as-text=false until the first settings response lands, matching
 *  both contexts' defaults - safe since game-version switches trigger
 *  app.relaunch, so the first read is also the final read. The a11y toggle
 *  could change at runtime, but secondary overlays do not re-subscribe to
 *  settings changes; full coverage of live toggling lives in the main overlay
 *  App.tsx wiring. */
export function PoeVersionRoot({ children }: { children: ReactNode }): JSX.Element {
  const [version, setVersion] = useState<1 | 2>(1)
  const [currencyLabelsAsText, setCurrencyLabelsAsText] = useState(false)
  useEffect(() => {
    void window.api.getSettings().then((s) => {
      setVersion(s.poeVersion ?? 1)
      setCurrencyLabelsAsText(Boolean(s.currencyLabelsAsText))
    })
  }, [])
  return (
    <PoeVersionProvider version={version}>
      <CurrencyLabelsProvider value={currencyLabelsAsText}>{children}</CurrencyLabelsProvider>
    </PoeVersionProvider>
  )
}

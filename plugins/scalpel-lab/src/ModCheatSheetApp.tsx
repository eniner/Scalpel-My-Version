import type { ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { ErrorBanner } from '@scalpelpoe/plugin-sdk'
import { ModCheatSheet } from './ModCheatSheet'
import { useCraftSession } from './use-craft-session'

/** Full-size mod cheat sheet — used in the pop-out overlay window. */
export function ModCheatSheetApp({ ctx }: { ctx: ScalpelPluginContext }): JSX.Element {
  const { craft, craftHostRequired, item, setItem, sessionState, setSessionState, tabProps } = useCraftSession(ctx)

  if (!craft) {
    return (
      <div style={{ padding: 16 }}>
        <ErrorBanner message={craftHostRequired} tone="warn" inline />
      </div>
    )
  }

  return (
    <div
      style={{
        boxSizing: 'border-box',
        padding: 16,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <ModCheatSheet
        craft={craft}
        ctx={ctx}
        item={item}
        sessionState={sessionState}
        onItemChange={setItem}
        onSessionChange={setSessionState}
        {...tabProps}
      />
    </div>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CraftApi, CraftItemStateResult, ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import type { PoeItem } from '@scalpelpoe/plugin-sdk'
import {
  type CraftBuildContext,
  type CraftTabProps,
  EMPTY_BUILD_CONTEXT,
  processHoveredImport,
  withMarksmanContext,
} from './craft-build-context'
import { CRAFT_HOST_REQUIRED, resolveCraft } from './craft-api'

export function useCraftSession(ctx: ScalpelPluginContext): {
  craft: CraftApi | null
  craftHostRequired: string
  item: PoeItem | null
  setItem: (i: PoeItem | null) => void
  sessionState: CraftItemStateResult | null
  setSessionState: (s: CraftItemStateResult | null) => void
  buildContext: CraftBuildContext
  tabProps: CraftTabProps
} {
  const craft = useMemo(() => resolveCraft(ctx), [ctx])
  const [item, setItem] = useState<PoeItem | null>(ctx.getCurrentItem())
  const [sessionState, setSessionState] = useState<CraftItemStateResult | null>(null)
  const [buildContext, setBuildContext] = useState<CraftBuildContext>(EMPTY_BUILD_CONTEXT)

  useEffect(() => {
    return ctx.onCurrentItem((i) => setItem(i))
  }, [ctx])

  useEffect(() => {
    setSessionState((s) => (s ? withMarksmanContext(s, buildContext, item) : s))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync marksman when worn gear changes
  }, [buildContext.marksmanSource])

  const handleSmartImport = useCallback(async (): Promise<string | null> => {
    const parsed = await ctx.copyAndEvaluateItem()
    if (!parsed) return null
    const result = processHoveredImport(parsed, buildContext)
    setBuildContext(result.buildContext)
    if (result.craftItem && result.sessionState) {
      setItem(result.craftItem)
      setSessionState(result.sessionState)
    } else if (sessionState) {
      setSessionState(withMarksmanContext(sessionState, result.buildContext, item))
    }
    return result.message
  }, [ctx, buildContext, sessionState, item])

  const tabProps: CraftTabProps = useMemo(
    () => ({ buildContext, onSmartImport: handleSmartImport }),
    [buildContext, handleSmartImport],
  )

  return {
    craft,
    craftHostRequired: CRAFT_HOST_REQUIRED,
    item,
    setItem,
    sessionState,
    setSessionState,
    buildContext,
    tabProps,
  }
}

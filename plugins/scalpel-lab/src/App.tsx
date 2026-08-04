import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CraftApi, CraftItemStateResult, ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { Button, ErrorBanner, ItemChip } from '@scalpelpoe/plugin-sdk'
import type { PoeItem } from '@scalpelpoe/plugin-sdk'
import { inputStyle, matchesSearch, pct, selectStyle, tabStyle } from './craft-utils'
import { craftStateToPoeItem } from './craft-session'
import {
  type CraftBuildContext,
  type CraftTabProps,
  resolveMarksmanEnabled,
} from './craft-build-context'
import { CraftEmulator } from './CraftEmulator'
import { CraftPath } from './CraftPath'
import { TargetOdds } from './TargetOdds'
import { CRAFT_HOST_REQUIRED } from './craft-api'
import { useCraftSession } from './use-craft-session'

type CraftActionResult = Awaited<ReturnType<CraftApi['listActions']>>[number]
type CraftSimulationResult = Awaited<ReturnType<CraftApi['simulate']>>

interface AppProps {
  ctx: ScalpelPluginContext
}

type View = 'simulator' | 'cheatsheet' | 'emulator' | 'target' | 'path'

export type { CraftTabProps } from './craft-build-context'

function TabPanel({ active, children }: { active: boolean; children: ReactNode }): JSX.Element | null {
  if (!active) return null
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
}

function BuildContextBar({ buildContext }: { buildContext: CraftBuildContext }): JSX.Element | null {
  if (!buildContext.marksmanSource) return null
  const src = buildContext.marksmanSource
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <ItemChip
        name={`Worn: ${src.name || src.baseType}`}
        itemClass={src.itemClass}
        title="Belt/quiver with marksman implicit — marksman pool enabled for gloves, boots, etc."
      />
      <span style={{ fontSize: 11, opacity: 0.65 }}>Marksman pool auto-enabled on all tabs</span>
    </div>
  )
}

function CraftSimulator({
  craft,
  buildContext,
  onSmartImport,
  item,
  sessionState,
  setItem,
  onSessionChange,
}: {
  craft: CraftApi
  buildContext: CraftBuildContext
  onSmartImport: () => Promise<string | null>
  item: PoeItem | null
  sessionState: CraftItemStateResult | null
  setItem: (i: PoeItem | null) => void
  onSessionChange: (s: CraftItemStateResult | null) => void
}): JSX.Element {
  const [actions, setActions] = useState<CraftActionResult[]>([])
  const [selected, setSelected] = useState<string>('pool:all')
  const [result, setResult] = useState<CraftSimulationResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const activeItem = useMemo(
    () => (sessionState ? craftStateToPoeItem(sessionState) : item),
    [sessionState, item],
  )

  const craftOpts = useMemo(
    () =>
      activeItem
        ? { marksmanEnabled: resolveMarksmanEnabled(activeItem, buildContext) || sessionState?.marksmanEnabled }
        : undefined,
    [activeItem, buildContext, sessionState?.marksmanEnabled],
  )

  const runSim = useCallback(
    async (target: PoeItem, actionId: string) => {
      setBusy(true)
      setError(null)
      try {
        const marksman = resolveMarksmanEnabled(target, buildContext)
        setResult(await craft.simulate(target, actionId, marksman ? { marksmanEnabled: true } : undefined))
      } catch (err) {
        setResult(null)
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setBusy(false)
      }
    },
    [craft, buildContext],
  )

  const loadItem = useCallback(
    async (target: PoeItem, preferActionId?: string) => {
      setError(null)
      try {
        const marksman = resolveMarksmanEnabled(target, buildContext)
        const opts = marksman ? { marksmanEnabled: true } : undefined
        const list = await craft.listActions(target, opts)
        setActions(list)
        const pick =
          (preferActionId && list.some((a) => a.id === preferActionId) && preferActionId) ||
          list.find((a) => a.applies)?.id ||
          list.find((a) => a.id.startsWith('pool:'))?.id ||
          list[0]?.id ||
          'pool:all'
        setSelected(pick)
        await runSim(target, pick)
      } catch (err) {
        setActions([])
        setResult(null)
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [craft, buildContext, runSim],
  )

  useEffect(() => {
    if (activeItem) void loadItem(activeItem, selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when working item changes
  }, [activeItem?.baseType, activeItem?.itemLevel, activeItem?.rarity, activeItem?.explicits?.length, buildContext.marksmanSource])

  const importItem = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const msg = await onSmartImport()
      if (!msg) {
        setError('No PoE item on cursor — hover an item in-game and try again.')
        return
      }
      if (sessionState || item) {
        const target = sessionState ? craftStateToPoeItem(sessionState) : item!
        await loadItem(target, selected)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [onSmartImport, loadItem, selected, sessionState, item])

  const groupedOptions = useMemo(() => {
    const pools = actions.filter((a) => a.id.startsWith('pool:'))
    const byCat = new Map<string, CraftActionResult[]>()
    for (const a of actions) {
      if (a.id.startsWith('pool:')) continue
      const cat = a.category ?? 'other'
      if (!byCat.has(cat)) byCat.set(cat, [])
      byCat.get(cat)!.push(a)
    }
    return { pools, byCat }
  }, [actions])

  const selectedAction = actions.find((a) => a.id === selected)

  const filteredOutcomes = useMemo(() => {
    if (!result?.outcomes) return []
    return result.outcomes.filter((o) =>
      matchesSearch(search, o.text, o.group, o.kind === 'p' ? 'prefix' : 'suffix'),
    )
  }, [result, search])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button disabled={busy} onClick={() => void importItem()}>
          Import hovered item
        </Button>
        {activeItem ? (
          <ItemChip
            name={`${activeItem.rarity} ${activeItem.name || activeItem.baseType}`}
            itemClass={activeItem.itemClass}
            title={`${activeItem.rarity} · iLvl ${activeItem.itemLevel}${sessionState ? ' · from emulator' : ''}${
              craftOpts?.marksmanEnabled ? ' · marksman' : ''
            }`}
          />
        ) : null}
      </div>

      {error ? <ErrorBanner message={error} tone="warn" inline /> : null}

      {!activeItem ? (
        <p style={{ margin: 0, opacity: 0.75, fontSize: 13, lineHeight: 1.5 }}>
          Hover an item in PoE 2 and import it. Import a belt or quiver first to auto-enable the marksman pool when
          crafting other gear.
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, opacity: 0.85 }}>Currency / action</label>
            <select
              value={selected}
              disabled={busy}
              onChange={(e) => {
                const id = e.target.value
                setSelected(id)
                if (activeItem) void runSim(activeItem, id)
              }}
              style={{ ...selectStyle, width: '100%' }}
            >
              <optgroup label="Mod pools (search weights)">
                {groupedOptions.pools.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                    {!a.applies ? ' — N/A' : ''}
                  </option>
                ))}
              </optgroup>
              {[...groupedOptions.byCat.entries()].map(([cat, items]) => (
                <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                  {items.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                      {!a.applies ? ' — N/A' : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {selectedAction ? (
              <p style={{ margin: 0, fontSize: 11, opacity: 0.7, lineHeight: 1.45 }}>
                {selectedAction.applies ? selectedAction.description : (selectedAction.reason ?? selectedAction.description)}
              </p>
            ) : null}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, opacity: 0.85 }}>Search mods</label>
            <input
              type="search"
              placeholder="e.g. lightning resistance, life, prefix…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={inputStyle}
            />
          </div>

          {result ? (
            <section style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                {result.label}
                {result.samples > 0
                  ? ` — ${result.outcomes.some((o) => o.weight != null) ? `${result.outcomes.length} mods` : `${result.samples.toLocaleString()} rolls`}`
                  : ''}
              </h3>
              {result.modCountChances?.length ? (
                <p style={{ margin: 0, fontSize: 12, opacity: 0.85 }}>
                  Mod count:{' '}
                  {result.modCountChances.map((m) => `${m.count} mods ${pct(m.probability)}`).join(' · ')}
                </p>
              ) : null}
              {result.note ? (
                <p style={{ margin: 0, fontSize: 11, opacity: 0.65, lineHeight: 1.45 }}>{result.note}</p>
              ) : null}
              <p style={{ margin: 0, fontSize: 11, opacity: 0.55 }}>
                Showing {filteredOutcomes.length} of {result.outcomes.length} mods
                {search.trim() ? ` matching “${search.trim()}”` : ''}
              </p>
              <div style={{ flex: 1, overflow: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', opacity: 0.7, position: 'sticky', top: 0, background: 'rgba(20,20,24,0.95)' }}>
                      <th style={{ padding: '6px 8px' }}>Chance</th>
                      {result.outcomes.some((o) => o.weight != null) ? <th style={{ padding: '6px 8px' }}>Weight</th> : null}
                      <th style={{ padding: '6px 8px' }}>Mod</th>
                      <th style={{ padding: '6px 8px' }}>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOutcomes.map((o) => (
                      <tr key={`${o.group}-${o.text}-${o.kind}`} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{pct(o.probability)}</td>
                        {o.weight != null ? (
                          <td style={{ padding: '6px 8px', opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}>{o.weight}</td>
                        ) : null}
                        <td style={{ padding: '6px 8px' }}>{o.text || o.group}</td>
                        <td style={{ padding: '6px 8px', opacity: 0.7 }}>{o.kind === 'p' ? 'Prefix' : 'Suffix'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}

export function App({ ctx }: AppProps): JSX.Element {
  const { craft, item, setItem, sessionState, setSessionState, tabProps, buildContext } = useCraftSession(ctx)
  const [view, setView] = useState<View>('simulator')

  const openCheatSheetWindow = useCallback(() => {
    setView('cheatsheet')
    ctx.openOverlay()
  }, [ctx])

  if (!craft) {
    return (
      <div style={{ padding: 12 }}>
        <ErrorBanner message={CRAFT_HOST_REQUIRED} tone="warn" inline />
      </div>
    )
  }

  const tabPropsWithImport = tabProps

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, height: '100%', minHeight: 0 }}>
      <p style={{ margin: 0, fontSize: 11, opacity: 0.55, lineHeight: 1.45 }}>
        Scalpel Lab per-base weights · 131 currencies · essences &amp; orbs in-game
      </p>
      <BuildContextBar buildContext={buildContext} />
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" onClick={() => setView('simulator')} style={tabStyle(view === 'simulator')}>
          Craft odds
        </button>
        <button type="button" onClick={() => setView('emulator')} style={tabStyle(view === 'emulator')}>
          Emulator
        </button>
        <button type="button" onClick={() => setView('target')} style={tabStyle(view === 'target')}>
          Target odds
        </button>
        <button type="button" onClick={() => setView('path')} style={tabStyle(view === 'path')}>
          Craft path
        </button>
        <button type="button" onClick={() => void openCheatSheetWindow()} style={tabStyle(view === 'cheatsheet')}>
          Mod cheat sheet
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <TabPanel active={view === 'simulator'}>
          <CraftSimulator
            craft={craft}
            buildContext={buildContext}
            onSmartImport={tabPropsWithImport.onSmartImport}
            item={item}
            sessionState={sessionState}
            setItem={setItem}
            onSessionChange={setSessionState}
          />
        </TabPanel>
        <TabPanel active={view === 'emulator'}>
          <CraftEmulator
            craft={craft}
            ctx={ctx}
            item={item}
            virt={sessionState}
            onVirtChange={setSessionState}
            onItemChange={setItem}
            {...tabPropsWithImport}
          />
        </TabPanel>
        <TabPanel active={view === 'target'}>
          <TargetOdds
            craft={craft}
            ctx={ctx}
            item={item}
            sessionState={sessionState}
            onItemChange={setItem}
            onSessionChange={setSessionState}
            {...tabPropsWithImport}
          />
        </TabPanel>
        <TabPanel active={view === 'path'}>
          <CraftPath
            craft={craft}
            ctx={ctx}
            item={item}
            sessionState={sessionState}
            onItemChange={setItem}
            onSessionChange={setSessionState}
            {...tabPropsWithImport}
          />
        </TabPanel>
        <TabPanel active={view === 'cheatsheet'}>
          <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, opacity: 0.85 }}>
              Mod weights open in a <strong>large pop-out window</strong> (~90% of your screen) so you can see
              prefixes and suffixes side-by-side without scrolling the small tab.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button onClick={() => ctx.openOverlay()}>Open large cheat sheet</Button>
            </div>
            <p style={{ margin: 0, fontSize: 11, opacity: 0.55, lineHeight: 1.45 }}>
              Also: <strong>Pop out</strong> button above the tab · bind{' '}
              <em>Toggle mod cheat sheet window</em> in Settings → Macros
            </p>
          </div>
        </TabPanel>
      </div>
    </div>
  )
}

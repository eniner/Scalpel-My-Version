import type { ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { useEffect, useState } from 'react'
import catalogJson from './data/tools-catalog.json'
import { divineRate, indexPrices, mirrorRateDiv } from './shared/prices'
import { BrandMark, LeagueStamp, Shell, ToolTile } from './shared/ui'
import { theme } from './shared/theme'
import { BetrayalTool } from './tools/BetrayalTool'
import { BeastsTool } from './tools/BeastsTool'
import { BossProfitTool } from './tools/BossProfitTool'
import { CurrencyTrendsTool } from './tools/CurrencyTrendsTool'
import { EssencesTool } from './tools/EssencesTool'
import { GemLevelingTool } from './tools/GemLevelingTool'
import { HarvestTool } from './tools/HarvestTool'
import { NightmareTool } from './tools/NightmareTool'
import { ScarabTool } from './tools/ScarabTool'
import { ScryingTool } from './tools/ScryingTool'
import { TransfigTool } from './tools/TransfigTool'

type ToolEntry = {
  id: string
  title: string
  actions: string[]
  status: 'ready' | 'stub'
}

const CATALOG = catalogJson as ToolEntry[]

type Route =
  | { kind: 'hub' }
  | { kind: 'tool'; toolId: string; action: string }

export function AdvisorPanel({ ctx }: { ctx: ScalpelPluginContext }): JSX.Element {
  const [route, setRoute] = useState<Route>({ kind: 'hub' })
  const [rates, setRates] = useState({ cpd: 180, mirrorDiv: 380 })
  const [status, setStatus] = useState('')

  const back = () => setRoute({ kind: 'hub' })

  const refreshRates = async () => {
    try {
      await ctx.prices.refresh()
      const { prices } = await ctx.prices.getPrices()
      const byName = indexPrices(prices)
      setRates({ cpd: divineRate(byName), mirrorDiv: mirrorRateDiv(byName) })
      setStatus(ctx.getLeague())
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    void refreshRates()
  }, [])

  if (route.kind === 'tool') {
    const tool = CATALOG.find((t) => t.id === route.toolId)
    if (!tool) {
      return (
        <Shell>
          <button type="button" onClick={back}>
            Back
          </button>
        </Shell>
      )
    }

    switch (tool.id) {
      case 'gem-leveling':
        return <GemLevelingTool ctx={ctx} onBack={back} />
      case 'gem-transfig':
        return <TransfigTool ctx={ctx} onBack={back} />
      case 'beasts':
        return <BeastsTool ctx={ctx} onBack={back} />
      case 'scarab-atlas':
        return (
          <ScarabTool
            ctx={ctx}
            onBack={back}
            view={route.action === 'Vendor Guide' ? 'vendor' : 'farming'}
          />
        )
      case 'essences':
        return <EssencesTool ctx={ctx} onBack={back} />
      case 'harvest':
        return (
          <HarvestTool
            ctx={ctx}
            onBack={back}
            initialMode={route.action === 'Crop Rotation' ? 'crop' : 'farming'}
          />
        )
      case 'currency-trends':
        return <CurrencyTrendsTool ctx={ctx} onBack={back} />
      case 'boss-profit':
        return <BossProfitTool ctx={ctx} onBack={back} />
      case 'nightmare':
        return <NightmareTool ctx={ctx} onBack={back} />
      case 'betrayal':
        return <BetrayalTool ctx={ctx} onBack={back} />
      case 'scrying':
        return <ScryingTool ctx={ctx} onBack={back} />
      default:
        return (
          <Shell>
            <button type="button" onClick={back}>
              Back
            </button>
          </Shell>
        )
    }
  }

  return (
    <Shell className="sa-enter">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <BrandMark subtitle="Scalpel · Atlas drafts for PoE1 farms" />
        <LeagueStamp
          league={status || ctx.getLeague()}
          divine={rates.cpd}
          mirror={rates.mirrorDiv}
          onRefresh={() => void refreshRates()}
        />
      </div>

      <p
        style={{
          margin: '4px 0 0',
          maxWidth: 520,
          color: theme.dim,
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        Pick a calculator. Same EV logic as the public farm tools — redrawn for the overlay, priced live from
        poe.ninja.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 10,
          overflow: 'auto',
          paddingBottom: 4,
          marginTop: 4,
        }}
      >
        {CATALOG.map((tool) => (
          <ToolTile
            key={tool.id}
            toolId={tool.id}
            title={tool.title}
            actions={tool.actions}
            onAction={(action) => setRoute({ kind: 'tool', toolId: tool.id, action })}
          />
        ))}
      </div>
    </Shell>
  )
}

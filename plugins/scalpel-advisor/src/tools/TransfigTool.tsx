import type { ScalpelPluginContext } from '@scalpelpoe/plugin-sdk'
import { useCallback, useEffect, useMemo, useState } from 'react'
import transfigRefJson from '../data/transfig-ref.json'
import {
  computeDivineFont,
  DEFAULT_FONTS_PER_LAB,
  DEFAULT_TIME_PER_LAB_SEC,
  type GemColor,
  type TransfigData,
} from '../engines/transfig'
import { indexPriceIcons } from '../shared/icons'
import { ItemName } from '../shared/ItemName'
import { applyNinjaToTransfig } from '../shared/ninjaOverlay'
import { chaosForName, fmtChaos, fmtSignedChaos, indexPrices } from '../shared/prices'
import { ToolHeader } from '../shared/ToolChrome'
import { accentBtnStyle, btnStyle, inputStyle } from '../shared/theme'
import {
  Blurb,
  FieldLabel,
  HeroMetric,
  HeroRow,
  SetupGroup,
  SplitBody,
  Workbench,
} from '../shared/ui'

const REF = transfigRefJson as unknown as TransfigData

const COLOR_LABEL: Record<GemColor, string> = { red: 'Red (Str)', green: 'Green (Dex)', blue: 'Blue (Int)' }

export function TransfigTool({
  ctx,
  onBack,
}: {
  ctx: ScalpelPluginContext
  onBack: () => void
}): JSX.Element {
  const [data, setData] = useState<TransfigData>(REF)
  const [cpd, setCpd] = useState(180)
  const [status, setStatus] = useState('')
  const [priceIcons, setPriceIcons] = useState<Map<string, string>>(() => new Map())

  const [l20, setL20] = useState(false)
  const [minVolume, setMinVolume] = useState(0)
  const [fontsPerLab, setFontsPerLab] = useState(DEFAULT_FONTS_PER_LAB)
  const [timePerLabSec, setTimePerLabSec] = useState(DEFAULT_TIME_PER_LAB_SEC)

  const league = ctx.getLeague()

  const refresh = useCallback(async () => {
    setStatus('Fetching prices…')
    try {
      await ctx.prices.refresh()
      const { prices: list } = await ctx.prices.getPrices()
      const byName = indexPrices(list)
      setPriceIcons(indexPriceIcons(list))
      setCpd(chaosForName(byName, 'Divine Orb') ?? 180)
      setData(applyNinjaToTransfig(REF, list))
      setStatus(`poe.ninja · ${league} · ${REF.bases.length} bases (bundled catalog)`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    }
  }, [ctx, league])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const result = useMemo(
    () => computeDivineFont(data, { l20, cpd, minVolume, fontsPerLab, timePerLabSec }),
    [data, l20, cpd, minVolume, fontsPerLab, timePerLabSec],
  )

  return (
    <Workbench>
      <ToolHeader
        toolId="gem-transfig"
        title="Gem Transfig — Divine Font EV"
        onBack={onBack}
        status={status}
        onRefresh={() => void refresh()}
        refreshLabel="Refresh"
      />

      <SplitBody
        rail={
          <>
            <SetupGroup title="Level">
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  style={!l20 ? accentBtnStyle : btnStyle}
                  onClick={() => setL20(false)}
                >
                  L1
                </button>
                <button type="button" style={l20 ? accentBtnStyle : btnStyle} onClick={() => setL20(true)}>
                  L20
                </button>
              </div>
            </SetupGroup>
            <SetupGroup title="Filters">
              <FieldLabel label="Min Volume">
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="number"
                  value={minVolume}
                  onChange={(e) => setMinVolume(Number(e.target.value) || 0)}
                />
              </FieldLabel>
            </SetupGroup>
            <SetupGroup title="Lab pacing">
              <FieldLabel label="Fonts / Lab">
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="number"
                  step="0.1"
                  value={fontsPerLab}
                  onChange={(e) => setFontsPerLab(Number(e.target.value) || 0)}
                />
              </FieldLabel>
              <FieldLabel label="Time / Lab (sec)">
                <input
                  style={{ ...inputStyle, width: '100%' }}
                  type="number"
                  value={timePerLabSec}
                  onChange={(e) => setTimePerLabSec(Number(e.target.value) || 0)}
                />
              </FieldLabel>
            </SetupGroup>
            <SetupGroup title="About" defaultOpen={false}>
              <Blurb>
                Divine Font blends a 2.5% chance at a random exceptional gem, 6% at your best base+variant combo,
                and 91.5% at a random gem of the best color — each color/exceptional draw is the expected max of 3
                random picks.
              </Blurb>
            </SetupGroup>
          </>
        }
        stage={
          <>
            <HeroRow>
              <HeroMetric label="Exceptional EV" value={fmtChaos(result.exceptionalEv, cpd)} tone="accent" />
              <HeroMetric
                label="Best Base Net"
                value={fmtSignedChaos(result.best?.netEv ?? 0, cpd)}
                tone="ink"
              />
              <HeroMetric label="Font EV" value={fmtChaos(result.fontEv, cpd)} tone="good" />
              <HeroMetric label="EV / Hour" value={fmtSignedChaos(result.evPerHour, cpd)} tone="good" />
            </HeroRow>

            <HeroRow>
              {(Object.keys(result.colorEV) as GemColor[]).map((color) => (
                <HeroMetric
                  key={color}
                  label={COLOR_LABEL[color]}
                  value={fmtChaos(result.colorEV[color], cpd)}
                  tone={color === result.bestColor ? 'good' : 'accent'}
                  sub={color === result.bestColor ? 'Best color' : undefined}
                />
              ))}
            </HeroRow>

            {result.best ? (
              <Blurb>
                Best base combo:{' '}
                <ItemName name={result.best.baseName} opts={{ priceIcons }}>
                  {result.best.baseName}
                </ItemName>{' '}
                →{' '}
                <ItemName name={result.best.variantName} opts={{ priceIcons }}>
                  {result.best.variantName}
                </ItemName>{' '}
                ({fmtChaos(result.best.grossPrice, cpd)} sell − {fmtChaos(result.best.baseCost, cpd)} base cost)
              </Blurb>
            ) : null}

            <HeroRow>
              <HeroMetric label="Fonts / Lab" value={fontsPerLab.toFixed(1)} tone="accent" />
              <HeroMetric label="EV / Lab" value={fmtSignedChaos(result.evPerLab, cpd)} tone="accent" />
            </HeroRow>
          </>
        }
      />
    </Workbench>
  )
}

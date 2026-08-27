import { Buy, PreviewOpen, PreviewClose } from '@icon-park/react'
import dustIcon from '../../assets/currency/thaumaturgic-dust.png'
import { IconGlow } from '../../shared/IconGlow'
import { CurrencyChip } from '../../shared/CurrencyChip'
import { zebraRowBg } from '../../shared/utils'
import type { UniqueTierEntry } from './types'
import { COL_DUST, COL_PRICE, COL_TIER, TIER_COLORS } from './constants'
import { formatDust } from './utils'

interface UniqueTierEntryRowProps {
  entry: UniqueTierEntry
  index: number
  divineRate: number
  mirrorRate: number
  onSelectItem?: () => void
  onPriceCheckItem?: () => void
  visibility?: 'Show' | 'Hide'
}

export function UniqueTierEntryRow({
  entry,
  index,
  divineRate,
  mirrorRate,
  onSelectItem,
  onPriceCheckItem,
  visibility,
}: UniqueTierEntryRowProps): JSX.Element {
  const loadItem = (): void => {
    window.api.lookupBaseType(entry.baseType, entry.itemClass || '', 'Unique', entry.name)
  }
  const openPriceCheck = (): void => {
    window.api.sisterOpenPriceCheck({ name: entry.name, baseType: entry.baseType, category: 'unique' })
  }

  return (
    <div
      className="flex items-center gap-[6px] px-3 py-1"
      style={{ background: zebraRowBg(index, 'rgba(255,255,255,0.03)') }}
    >
      {entry.iconUrl ? (
        <IconGlow src={entry.iconUrl} size={22} blur={10} saturate={2.5} opacity={0.35} />
      ) : (
        <div className="w-[22px] h-[22px] shrink-0" />
      )}

      {visibility && (
        <span
          title={visibility === 'Show' ? 'Shown by your filter' : 'Hidden by your filter'}
          className="shrink-0 flex items-center"
          style={{
            color: visibility === 'Show' ? 'var(--text-dim)' : 'var(--hide-color)',
            opacity: visibility === 'Show' ? 0.5 : 0.9,
          }}
        >
          {visibility === 'Show' ? (
            <PreviewOpen size={12} theme="outline" fill="currentColor" />
          ) : (
            <PreviewClose size={12} theme="outline" fill="currentColor" />
          )}
        </span>
      )}

      <span
        onClick={() => {
          loadItem()
          onSelectItem?.()
        }}
        className="flex-1 text-[11px] text-text overflow-hidden text-ellipsis whitespace-nowrap cursor-pointer hover:text-accent"
      >
        {entry.name}
      </span>

      <button
        onClick={() => {
          openPriceCheck()
          onPriceCheckItem?.()
        }}
        title={`Price check ${entry.name}`}
        className="inline-flex items-center justify-center rounded bg-white/[0.06] hover:bg-white/[0.12] h-[20px] px-[6px] text-[10px] shrink-0 cursor-pointer box-border"
      >
        <Buy size={12} theme="outline" fill="currentColor" />
      </button>

      <span
        className="inline-flex items-center justify-center rounded bg-white/[0.06] text-[11px] font-bold shrink-0 box-border"
        style={{
          width: COL_TIER,
          color: entry.tier ? TIER_COLORS[entry.tier] : 'var(--text-dim)',
        }}
        title={entry.tier ? `Drop-weight ${entry.tier} (wiki / Prohibited Library — not price)` : 'No drop-tier data'}
      >
        {entry.tier ?? '–'}
      </span>

      {entry.chaosValue !== null ? (
        (() => {
          const chipClass =
            'inline-flex items-center gap-[3px] rounded bg-white/[0.06] px-[6px] py-[2px] text-[10px] shrink-0 justify-end whitespace-nowrap box-border'
          const inMir = mirrorRate > 0 ? entry.chaosValue / mirrorRate : 0
          const inDiv = divineRate > 0 ? entry.chaosValue / divineRate : 0
          if (inMir >= 1)
            return (
              <CurrencyChip
                value={inMir >= 10 ? String(Math.round(inMir)) : inMir.toFixed(1)}
                currencyName="mirror"
                iconPosition="after"
                className={chipClass}
                style={{ width: COL_PRICE }}
              />
            )
          if (inDiv >= 1)
            return (
              <CurrencyChip
                value={inDiv >= 10 ? String(Math.round(inDiv)) : inDiv.toFixed(1)}
                currencyName="divine"
                iconSize={12}
                iconPosition="after"
                className={chipClass}
                style={{ width: COL_PRICE }}
              />
            )
          return (
            <CurrencyChip
              value={
                entry.chaosValue >= 1000
                  ? `${(entry.chaosValue / 1000).toFixed(1)}k`
                  : String(Math.round(entry.chaosValue))
              }
              currencyName="chaos"
              iconSize={12}
              iconPosition="after"
              className={chipClass}
              style={{ width: COL_PRICE }}
            />
          )
        })()
      ) : (
        <span
          className="inline-flex items-center justify-end rounded bg-white/[0.06] px-[6px] py-[2px] text-[9px] text-text-dim shrink-0 box-border"
          style={{ width: COL_PRICE }}
        >
          --
        </span>
      )}

      {entry.dustIlvl84 != null ? (
        <CurrencyChip
          value={formatDust(entry.dustIlvl84)}
          icon={dustIcon}
          className="inline-flex items-center gap-[3px] rounded bg-white/[0.06] px-[6px] py-[2px] text-[10px] shrink-0 justify-end whitespace-nowrap box-border"
          style={{ width: COL_DUST }}
        />
      ) : (
        <span
          className="inline-flex items-center justify-end rounded bg-white/[0.06] px-[6px] py-[2px] text-[9px] text-text-dim shrink-0 box-border"
          style={{ width: COL_DUST }}
        >
          --
        </span>
      )}
    </div>
  )
}

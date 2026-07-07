import type { CSSProperties } from 'react'
import { CurrencyIcon } from './CurrencyIcon'
import { formatPrice } from './utils'
import { formatPriceTooltip } from './currency-short-labels'
import { HoverTooltip } from './HoverTooltip'

interface CurrencyChipProps {
  value: number | string
  /** Currency trade-API key (e.g. "chaos", "divine", "exalted"). When set, the
   *  chip renders via <CurrencyIcon> and honors the "show currency names" a11y
   *  setting. Takes precedence over `icon`. */
  currencyName?: string
  /** Direct icon URL. Use only for non-currency icons (e.g. the mirror art
   *  that isn't in the trade-API icon map). At least one of `currencyName` or
   *  `icon` must be provided. */
  icon?: string
  iconSize?: number
  className?: string
  style?: CSSProperties
  fallback?: string
  iconPosition?: 'before' | 'after'
}

export function CurrencyChip({
  value,
  currencyName,
  icon,
  iconSize = 12,
  className = 'inline-flex items-center gap-[3px] bg-black/25 rounded-full px-2 py-[3px] text-[11px]',
  style,
  fallback,
  iconPosition = 'before',
}: CurrencyChipProps): JSX.Element {
  if (value === 0 && fallback) {
    return (
      <span className={className} style={style}>
        <span className="text-text-dim text-[10px]">{fallback}</span>
      </span>
    )
  }

  const displayValue = typeof value === 'number' ? formatPrice(value) : value

  // currencyName takes precedence; both can be falsy only if the caller forgot
  // (TypeScript can't enforce "at least one" cleanly here, so accept either).
  const iconEl = currencyName ? (
    <CurrencyIcon name={currencyName} style={{ width: iconSize, height: iconSize }} />
  ) : (
    <img src={icon} alt="" style={{ width: iconSize, height: iconSize }} />
  )
  const valueEl = <span className="text-white font-semibold">{displayValue}</span>

  return (
    <HoverTooltip text={formatPriceTooltip(displayValue, currencyName)}>
      <span className={className} style={style}>
        {iconPosition === 'before' ? (
          <>
            {iconEl}
            {valueEl}
          </>
        ) : (
          <>
            {valueEl}
            {iconEl}
          </>
        )}
      </span>
    </HoverTooltip>
  )
}

import { useWhiteboardStore } from '../state/store'

/** Label font size scales with the picker value so the chip itself previews
 *  the size you're picking. Capped so XL still fits comfortably in the 36px
 *  slot. */
const SIZES: Array<{ label: 'S' | 'M' | 'L' | 'XL'; value: number; px: number }> = [
  { label: 'S', value: 0.018, px: 11 },
  { label: 'M', value: 0.025, px: 14 },
  { label: 'L', value: 0.035, px: 17 },
  { label: 'XL', value: 0.05, px: 20 },
]

export function FontSizePicker(): JSX.Element {
  const fontSize = useWhiteboardStore((s) => s.textFontSize)
  const setFontSize = useWhiteboardStore((s) => s.setTextFontSize)
  return (
    <div className="flex gap-1 items-center px-1">
      {SIZES.map((s) => {
        const active = Math.abs(s.value - fontSize) < 1e-6
        return (
          <button
            key={s.label}
            type="button"
            className={[
              'btn-ghost btn-bounce w-9 h-9 flex items-center justify-center font-semibold leading-none',
              active ? 'text-text' : 'text-text-dim',
            ].join(' ')}
            style={{ fontSize: s.px }}
            onClick={() => setFontSize(s.value)}
            title={`Font size ${s.label}`}
            aria-pressed={active}
          >
            {s.label}
          </button>
        )
      })}
    </div>
  )
}

import { useWhiteboardStore } from '../state/store'

const SWATCHES = ['#1c1c22', '#ef5350', '#ff9f4d', '#ffd24d', '#5edd8a', '#5ec8ff', '#7d8cff', '#c89dff', '#ffffff']

export function ColorPalette(): JSX.Element {
  const color = useWhiteboardStore((s) => s.color)
  const setColor = useWhiteboardStore((s) => s.setColor)
  return (
    <div className="flex gap-2 items-center px-2">
      {SWATCHES.map((c) => {
        const active = c.toLowerCase() === color.toLowerCase()
        const isWhite = c === '#ffffff'
        return (
          <button
            key={c}
            type="button"
            className={[
              'rounded-full p-0',
              isWhite ? 'border border-white/20' : 'border border-transparent',
              active ? '' : 'hover:scale-[1.18]',
            ].join(' ')}
            style={{
              width: 18,
              height: 18,
              background: c,
              boxShadow: active ? '0 0 0 2px var(--bg-card), 0 0 0 4px var(--accent)' : undefined,
              transition: 'transform 120ms cubic-bezier(0.2, 1.4, 0.4, 1)',
            }}
            onClick={() => setColor(c)}
            title={c}
          />
        )
      })}
    </div>
  )
}

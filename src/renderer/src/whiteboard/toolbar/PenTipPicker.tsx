import { useWhiteboardStore } from '../state/store'
import { TipSquiggle } from './tool-icons'

const TIPS: Array<{ label: 'Small' | 'Large'; width: number }> = [
  { label: 'Small', width: 0.003 },
  { label: 'Large', width: 0.009 },
]

export function PenTipPicker(): JSX.Element {
  const width = useWhiteboardStore((s) => s.width)
  const setWidth = useWhiteboardStore((s) => s.setWidth)
  return (
    <div className="flex gap-1 items-center px-1">
      {TIPS.map((t) => {
        const active = Math.abs(t.width - width) < 1e-6
        return (
          <button
            key={t.label}
            type="button"
            className={[
              'btn-ghost btn-bounce w-10 h-10 flex items-center justify-center',
              active ? 'text-text' : 'text-text-dim',
            ].join(' ')}
            onClick={() => setWidth(t.width)}
            title={t.label}
            aria-pressed={active}
          >
            <TipSquiggle thick={t.label === 'Large'} />
          </button>
        )
      })}
    </div>
  )
}

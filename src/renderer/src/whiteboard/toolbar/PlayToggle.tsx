import { useWhiteboardStore } from '../state/store'
import { IconPlay, IconPen } from './icons'

export function PlayToggle(): JSX.Element {
  const mode = useWhiteboardStore((s) => s.mode)
  const setMode = useWhiteboardStore((s) => s.setMode)
  const playing = mode === 'play'
  return (
    <button
      type="button"
      className={[
        'h-9 px-3 flex items-center justify-center gap-1.5 text-xs font-semibold tracking-wide whitespace-nowrap transition-colors text-bg-solid',
        playing ? 'bg-match' : 'bg-accent',
      ].join(' ')}
      onClick={() => setMode(playing ? 'edit' : 'play')}
      title={playing ? 'Click to edit (mouse drawing instead of passing through)' : 'Click to pass clicks to game'}
    >
      {playing ? <IconPlay size={14} /> : <IconPen size={14} />}
      {playing ? 'Passthrough Mode' : 'Edit Mode'}
    </button>
  )
}

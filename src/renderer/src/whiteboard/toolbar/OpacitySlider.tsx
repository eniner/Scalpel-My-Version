import { useWhiteboardStore } from '../state/store'

export function OpacitySlider(): JSX.Element {
  const opacity = useWhiteboardStore((s) => s.drawingsOpacity)
  const setOpacity = useWhiteboardStore((s) => s.setDrawingsOpacity)
  const pct = Math.round(opacity * 100)
  return (
    <input
      type="range"
      min={20}
      max={100}
      step={5}
      value={pct}
      onChange={(e) => setOpacity(Number(e.currentTarget.value) / 100)}
      className="accent-accent w-32"
      aria-label={`Opacity ${pct}%`}
      title={`${pct}%`}
    />
  )
}

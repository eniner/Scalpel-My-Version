import { useLayoutEffect, useRef, useState } from 'react'
import { PANEL_CHROME } from '../toolbar/panel-chrome'
import { useDismissOnOutside } from '../state/use-dismiss-on-outside'

/** A single row in the context menu. */
export interface ContextMenuItem {
  label: string
  onClick: () => void
  /** Grays out the row and blocks clicks. Useful for Paste when the clipboard
   *  is empty - the row stays visible so the menu's geometry doesn't jump
   *  between right-clicks. */
  disabled?: boolean
}

/** A horizontal divider between menu sections. Use `{ divider: true }` to
 *  insert one anywhere in the `items` array. */
export interface ContextMenuDivider {
  divider: true
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuDivider

function isDivider(e: ContextMenuEntry): e is ContextMenuDivider {
  return 'divider' in e
}

interface Props {
  /** Cursor position in stage-container pixels (matches the CSS coordinate
   *  space the menu's absolute positioning lives in). */
  x: number
  y: number
  items: ContextMenuEntry[]
  onClose: () => void
  /** Outer corner radius in px. Overrides `PANEL_CHROME`'s 22px so the small
   *  menu doesn't read as a bubble. Defaults to one px under the inner row
   *  hover (4px Tailwind `rounded`) so the nested rounding follows the
   *  decreasing-radius rule. */
  radius?: number
}

const GAP_PX = 8
const DEFAULT_RADIUS_PX = 14

export function ContextMenu({ x, y, items, onClose, radius = DEFAULT_RADIUS_PX }: Props): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  // Render off-screen on first paint so we can measure the actual size,
  // then snap to the right (or left, on the right edge).
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: -9999, top: -9999 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    let left = x + GAP_PX
    let top = y
    // Right-edge flip: if menu would overflow right, place it to the left of the cursor.
    if (left + r.width > window.innerWidth - GAP_PX) {
      left = x - r.width - GAP_PX
    }
    // Bottom-edge clamp: keep the menu fully on screen vertically.
    if (top + r.height > window.innerHeight - GAP_PX) {
      top = window.innerHeight - r.height - GAP_PX
    }
    if (top < GAP_PX) top = GAP_PX
    if (left < GAP_PX) left = GAP_PX
    setPos({ left, top })
  }, [x, y])

  useDismissOnOutside(ref, onClose)

  return (
    <div
      ref={ref}
      className={`absolute ${PANEL_CHROME} p-1 flex flex-col gap-px text-text z-[200] min-w-[140px]`}
      // Inline borderRadius wins over the Tailwind class in PANEL_CHROME so
      // we don't need a hard-coded override class.
      style={{ left: pos.left, top: pos.top, borderRadius: radius }}
    >
      {items.map((entry, i) =>
        isDivider(entry) ? (
          <div key={`d${i}`} className="my-1 h-px bg-border" aria-hidden />
        ) : (
          <button
            key={entry.label}
            type="button"
            className={[
              '!bg-transparent text-left text-xs px-2 py-1.5 rounded w-full',
              entry.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:!bg-bg-hover cursor-pointer',
            ].join(' ')}
            disabled={entry.disabled}
            onClick={() => {
              if (entry.disabled) return
              entry.onClick()
              onClose()
            }}
          >
            {entry.label}
          </button>
        ),
      )}
    </div>
  )
}

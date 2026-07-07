import { forwardRef } from 'react'

interface Props {
  icon: JSX.Element
  active?: boolean
  disabled?: boolean
  title: string
  onClick?: () => void
  /** Big slot for the 3D marker icon. Renders 64px wide and clips children at
   *  the bottom edge so the marker reads as emerging from the toolbar. */
  big?: boolean
  /** Marks this button as the trigger for a popover that uses
   *  `useDismissOnOutside`. The hook sees `[data-dismiss-anchor]` and skips
   *  closing the popover for this click, so the trigger's own onClick can
   *  toggle it cleanly. */
  dismissAnchor?: boolean
}

const SPRING = 'cubic-bezier(0.2, 1.4, 0.4, 1)'

export const ToolButton = forwardRef<HTMLButtonElement, Props>(function ToolButton(
  { icon, active, disabled, title, onClick, big, dismissAnchor },
  ref,
): JSX.Element {
  if (big) {
    /* Mounting math, with two knobs that have to move together:
     *
     *   1. `clipPath` - clips the SVG at the toolbar's actual bottom edge.
     *      The toolbar pill has `p-2` (8px) padding, so the slot's bottom is
     *      8px above the toolbar's outer bottom. Setting the clip's bottom
     *      inset to `-8px` extends the clip down through that padding so the
     *      pen body can reach the toolbar's true bottom edge.
     *
     *   2. `bottom` - positions the SVG's bottom edge relative to the slot.
     *      The SVG's viewBox includes a ~6-7px (size=56) shadow row below
     *      the visible body, so to land the body bottom flush at the
     *      toolbar's bottom we push the SVG ~8px (toolbar padding) + ~7px
     *      (shadow) ≈ 15px below the slot's bottom.
     *
     *  Inactive: SVG is sitting ~22px below the slot, so the body bottom
     *  lands inside the clip area but most of the body is below the
     *  toolbar's bottom edge - only the tip pokes up. Hover transform
     *  lifts the inner span to expose more.
     *
     *  All transitions use the design's spring overshoot. */
    return (
      <button
        ref={ref}
        type="button"
        className={[
          'btn-ghost group relative flex items-center justify-center w-16 h-9',
          disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer',
        ].join(' ')}
        style={{
          clipPath: 'inset(-200px -200px -8px -200px)',
          background: 'transparent',
          // z-index has to be on the BUTTON (not the inner span) to lift the
          // marker icon above the unified arrow when it rises on hover. With
          // z-index on the inner span, the transform-extended visual portion
          // (the lifted tip area) renders behind the arrow despite the inner
          // span's z. Putting z here creates a stacking context around the
          // whole icon subtree so the lifted tip paints on top.
          zIndex: 20,
        }}
        title={title}
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        data-dismiss-anchor={dismissAnchor ? '' : undefined}
      >
        <span
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            bottom: active ? -50 : -62,
            transition: `bottom 220ms ${SPRING}, transform 220ms ${SPRING}`,
            filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.35))',
          }}
        >
          <span
            className={[
              'block transition-transform duration-200',
              active ? 'group-hover:-translate-y-2' : 'group-hover:-translate-y-3',
            ].join(' ')}
            style={{ transitionTimingFunction: SPRING }}
          >
            {icon}
          </span>
        </span>
      </button>
    )
  }
  return (
    <button
      ref={ref}
      type="button"
      className={[
        'btn-ghost btn-bounce relative w-9 h-9 flex items-center justify-center',
        active ? 'text-text' : 'text-text-dim',
        disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
      title={title}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-pressed={active ? true : undefined}
      data-dismiss-anchor={dismissAnchor ? '' : undefined}
    >
      {icon}
      {active && (
        <span
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 rounded-full bg-accent"
          style={{ bottom: 3, width: 4, height: 4 }}
        />
      )}
    </button>
  )
})

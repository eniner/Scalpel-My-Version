import { useLayoutEffect, useState, type RefObject } from 'react'

const SPRING = 'cubic-bezier(0.2, 1.4, 0.4, 1)'

/** A single arrow positioned absolutely in the toolbar wrapper that points
 *  at whichever trigger button currently owns the contextual pill / popover.
 *  When the target changes the arrow slides smoothly to the new position via
 *  a CSS `left` transition. Replaces what would otherwise be one arrow per
 *  pill (which can't animate across mount/unmount boundaries). */
export function UnifiedPillArrow({
  wrapperRef,
  targetRef,
  /** Vertical offset from the wrapper's bottom in px. Lands the arrow's
   *  rotated tip just above the main toolbar's top edge:
   *    toolbar height (52 content + 2 border) = 54
   *    + 1px breathing room
   *    + arrow overlap into the pill (10/2 + 2.07 from rotation) ≈ 7
   *  → bottom: 57. The upper half of the rotated square sits inside the
   *  pill region and is hidden because UnifiedPillArrow is rendered before
   *  the pills (lower z-stack), so the pill's bg paints over it. */
  bottomFromWrapper = 57,
}: {
  wrapperRef: RefObject<HTMLElement | null>
  targetRef: RefObject<HTMLElement | null> | null
  bottomFromWrapper?: number
}): JSX.Element | null {
  const [left, setLeft] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (!targetRef) {
      setLeft(null)
      return
    }
    function update(): void {
      // Re-resolve the refs each time. wrapperRef in particular may not be
      // populated on the very first run (parent's ref attaches after the
      // child's effect schedules), so falling back to a `requestAnimationFrame`
      // pass gives it a chance to land before we give up.
      const wrapper = wrapperRef.current
      const target = targetRef?.current
      if (!wrapper || !target) return
      const wr = wrapper.getBoundingClientRect()
      const tr = target.getBoundingClientRect()
      setLeft(tr.left + tr.width / 2 - wr.left)
    }
    update()
    const raf = requestAnimationFrame(update)
    const wrapperEl = wrapperRef.current
    const targetEl = targetRef.current
    const ro = new ResizeObserver(update)
    if (wrapperEl) ro.observe(wrapperEl)
    if (targetEl) ro.observe(targetEl)
    window.addEventListener('resize', update)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [wrapperRef, targetRef])

  if (left === null) return null
  return (
    <span
      aria-hidden
      className="absolute pointer-events-none w-[10px] h-[10px] rotate-45 bg-bg-card-translucent border-r border-b border-border"
      style={{
        left: left - 5,
        bottom: bottomFromWrapper,
        transition: `left 220ms ${SPRING}`,
      }}
    />
  )
}

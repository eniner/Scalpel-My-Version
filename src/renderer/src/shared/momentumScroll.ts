/** Build an onMouseDown handler that adds momentum-based drag-to-scroll to a
 *  horizontally-scrolling container. Not a React hook -- no hooks are called -- so
 *  it's a plain factory; name doesn't start with `use`. Pass selectors of child
 *  elements that shouldn't initiate a drag (e.g. buttons inside the scroller). */
export function createMomentumScrollHandler(
  ignoreSelectors: string[] = [],
): (e: React.MouseEvent<HTMLDivElement>) => void {
  return (e) => {
    if (ignoreSelectors.some((s) => (e.target as HTMLElement).closest(s))) return
    const el = e.currentTarget
    const startX = e.pageX
    const scrollLeft = el.scrollLeft
    let moved = false
    let velocity = 0
    let lastX = startX
    let lastTime = Date.now()
    const onMove = (ev: MouseEvent): void => {
      const dx = ev.pageX - startX
      if (Math.abs(dx) > 3) moved = true
      const now = Date.now()
      const dt = now - lastTime
      if (dt > 0) velocity = (ev.pageX - lastX) / dt
      lastX = ev.pageX
      lastTime = now
      el.scrollLeft = scrollLeft - dx
    }
    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (!moved) return
      // Suppress the synthetic click that follows the drag-release so dragging the
      // scroller doesn't accidentally activate whatever card the cursor was over.
      const suppress = (clickEv: MouseEvent): void => {
        clickEv.preventDefault()
        clickEv.stopPropagation()
        window.removeEventListener('click', suppress, true)
      }
      window.addEventListener('click', suppress, true)
      let v = velocity * 15
      const decay = (): void => {
        if (Math.abs(v) < 0.5) return
        el.scrollLeft -= v
        v *= 0.92
        requestAnimationFrame(decay)
      }
      requestAnimationFrame(decay)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
}

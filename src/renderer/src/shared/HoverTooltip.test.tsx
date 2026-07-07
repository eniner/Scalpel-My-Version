// @vitest-environment jsdom

import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HoverTooltip } from './HoverTooltip'

afterEach(() => {
  vi.useRealTimers()
})

describe('HoverTooltip', () => {
  it('shows the tooltip text after the hover delay and hides on leave', () => {
    vi.useFakeTimers()
    render(
      <HoverTooltip text="20 div">
        <span>price</span>
      </HoverTooltip>,
    )
    const anchor = screen.getByText('price')

    // Not shown immediately on enter (delayed).
    fireEvent.mouseEnter(anchor)
    expect(screen.queryByTestId('hover-tooltip')).toBeNull()

    // Appears once the delay elapses.
    act(() => {
      vi.advanceTimersByTime(120)
    })
    expect(screen.getByTestId('hover-tooltip')).toHaveTextContent('20 div')

    // Gone on mouse leave.
    fireEvent.mouseLeave(anchor)
    expect(screen.queryByTestId('hover-tooltip')).toBeNull()
  })

  it('forwards className onto the wrapper so flex sizing (e.g. shrink-0) is preserved', () => {
    render(
      <HoverTooltip text="20 div" className="shrink-0">
        <span>price</span>
      </HoverTooltip>,
    )
    const wrapper = screen.getByText('price').parentElement!
    expect(wrapper.className).toContain('shrink-0')
    expect(wrapper.className).toContain('inline-flex')
  })

  it('does not show if the cursor leaves before the delay elapses', () => {
    vi.useFakeTimers()
    render(
      <HoverTooltip text="5 c">
        <span>price</span>
      </HoverTooltip>,
    )
    const anchor = screen.getByText('price')

    fireEvent.mouseEnter(anchor)
    fireEvent.mouseLeave(anchor)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(screen.queryByTestId('hover-tooltip')).toBeNull()
  })
})

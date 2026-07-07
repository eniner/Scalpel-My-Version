import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createDebouncedSaver } from './persistence'

describe('debounced saver', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not fire when never triggered', () => {
    const sink = vi.fn()
    createDebouncedSaver(sink, 500)
    vi.advanceTimersByTime(10_000)
    expect(sink).not.toHaveBeenCalled()
  })

  it('fires once after the debounce window with the latest payload', () => {
    const sink = vi.fn<(p: number) => void>()
    const saver = createDebouncedSaver(sink, 500)
    saver.schedule(1)
    saver.schedule(2)
    saver.schedule(3)
    vi.advanceTimersByTime(499)
    expect(sink).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(sink).toHaveBeenCalledTimes(1)
    expect(sink).toHaveBeenLastCalledWith(3)
  })

  it('resets the timer on each schedule', () => {
    const sink = vi.fn<(p: number) => void>()
    const saver = createDebouncedSaver(sink, 500)
    saver.schedule(1)
    vi.advanceTimersByTime(400)
    saver.schedule(2)
    vi.advanceTimersByTime(400)
    expect(sink).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(sink).toHaveBeenCalledTimes(1)
    expect(sink).toHaveBeenLastCalledWith(2)
  })

  it('flushNow fires immediately if pending', () => {
    const sink = vi.fn<(p: number) => void>()
    const saver = createDebouncedSaver(sink, 500)
    saver.schedule(7)
    saver.flushNow()
    expect(sink).toHaveBeenCalledWith(7)
  })

  it('flushNow is a no-op when nothing is pending', () => {
    const sink = vi.fn<(p: number) => void>()
    const saver = createDebouncedSaver(sink, 500)
    saver.flushNow()
    expect(sink).not.toHaveBeenCalled()
  })
})

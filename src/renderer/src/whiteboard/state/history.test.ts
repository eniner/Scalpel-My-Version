import { describe, it, expect, beforeEach } from 'vitest'
import { createHistory } from './history'

type Snap = { value: number }

describe('history stack', () => {
  let h: ReturnType<typeof createHistory<Snap>>

  beforeEach(() => {
    h = createHistory<Snap>({ max: 5 })
  })

  it('starts empty (no undo, no redo)', () => {
    expect(h.canUndo()).toBe(false)
    expect(h.canRedo()).toBe(false)
  })

  it('commit + undo restores prior state', () => {
    h.commit({ value: 1 })
    h.commit({ value: 2 })
    expect(h.undo({ value: 2 })).toEqual({ value: 1 })
    expect(h.canRedo()).toBe(true)
  })

  it('redo replays the undone state', () => {
    h.commit({ value: 1 })
    h.commit({ value: 2 })
    h.undo({ value: 2 })
    expect(h.redo({ value: 1 })).toEqual({ value: 2 })
  })

  it('new commit wipes the redo branch', () => {
    h.commit({ value: 1 })
    h.commit({ value: 2 })
    h.undo({ value: 2 })
    h.commit({ value: 3 })
    expect(h.canRedo()).toBe(false)
  })

  it('respects the max-entries cap (drops oldest)', () => {
    for (let i = 1; i <= 10; i++) h.commit({ value: i })
    // 5-entry cap means we can undo up to 5 times. After 5 undos, canUndo=false.
    let cur: Snap = { value: 10 }
    for (let i = 0; i < 5; i++) cur = h.undo(cur) ?? cur
    expect(h.canUndo()).toBe(false)
  })

  it('undo returns null when stack is empty', () => {
    expect(h.undo({ value: 0 })).toBeNull()
  })
})

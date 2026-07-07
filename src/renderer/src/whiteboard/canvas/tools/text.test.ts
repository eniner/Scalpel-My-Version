import { describe, it, expect } from 'vitest'
import { createTextAt, measureTextBbox } from './text'

const SIZE = { w: 1000, h: 1000 }

describe('createTextAt', () => {
  it('returns a TextElement at the given normalized position', () => {
    const el = createTextAt({
      pointPx: { x: 200, y: 400 },
      color: '#ff0000',
      fontSize: 0.025,
      size: SIZE,
    })
    expect(el.type).toBe('text')
    expect(el.text).toBe('')
    expect(el.color).toBe('#ff0000')
    expect(el.fontSize).toBe(0.025)
    expect(el.bbox.x).toBeCloseTo(0.2)
    expect(el.bbox.y).toBeCloseTo(0.4)
  })

  it('uses a sensible default bbox size', () => {
    const el = createTextAt({
      pointPx: { x: 0, y: 0 },
      color: '#fff',
      fontSize: 0.025,
      size: SIZE,
    })
    expect(el.bbox.w).toBeGreaterThan(0)
    expect(el.bbox.h).toBeGreaterThan(0)
  })
})

describe('measureTextBbox', () => {
  it('empty string returns minimum-height bbox', () => {
    const r = measureTextBbox('', 0.025, SIZE)
    expect(r.w).toBeGreaterThan(0)
    expect(r.h).toBeGreaterThan(0)
  })

  it('multiline text returns proportionally taller bbox', () => {
    const single = measureTextBbox('hello', 0.025, SIZE)
    const multi = measureTextBbox('hello\nworld\n!', 0.025, SIZE)
    expect(multi.h).toBeGreaterThan(single.h)
  })

  it('larger font produces larger bbox', () => {
    const small = measureTextBbox('hello', 0.025, SIZE)
    const big = measureTextBbox('hello', 0.05, SIZE)
    expect(big.h).toBeGreaterThan(small.h)
  })
})

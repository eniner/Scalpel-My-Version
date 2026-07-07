import { describe, it, expect } from 'vitest'
import { bboxFromAnchorAndCursor, commitShape, shapeDefaultFill, startShape, updateShapeEnd } from './shape'

const SIZE = { w: 1000, h: 1000 }

describe('bboxFromAnchorAndCursor', () => {
  it('positive drag: anchor TL, cursor BR', () => {
    const r = bboxFromAnchorAndCursor({ x: 100, y: 200 }, { x: 400, y: 600 }, false, 'bbox')
    expect(r).toEqual({ x: 100, y: 200, w: 300, h: 400 })
  })

  it('negative drag normalizes so x/y is the smaller corner', () => {
    const r = bboxFromAnchorAndCursor({ x: 400, y: 600 }, { x: 100, y: 200 }, false, 'bbox')
    expect(r).toEqual({ x: 100, y: 200, w: 300, h: 400 })
  })

  it('shift constrains bbox to a square (max of dx/dy wins)', () => {
    const r = bboxFromAnchorAndCursor({ x: 0, y: 0 }, { x: 200, y: 50 }, true, 'bbox')
    expect(r).toEqual({ x: 0, y: 0, w: 200, h: 200 })
  })

  it("endpoints mode preserves the cursor's actual sign so line/arrow direction is correct", () => {
    const r = bboxFromAnchorAndCursor({ x: 100, y: 100 }, { x: 50, y: 200 }, false, 'endpoints')
    // anchor (100, 100), cursor (50, 200) -> w/h are signed
    expect(r).toEqual({ x: 100, y: 100, w: -50, h: 100 })
  })

  it('shift in endpoints mode constrains to 0/45/90 degrees', () => {
    // 30 degrees-ish should snap to 45
    const r = bboxFromAnchorAndCursor({ x: 0, y: 0 }, { x: 100, y: 60 }, true, 'endpoints')
    // 45 degrees from origin: dx = dy in magnitude. Use the larger axis as basis.
    // sign(dy) = +, sign(dx) = +; mag = max(|100|, |60|) = 100
    expect(r).toEqual({ x: 0, y: 0, w: 100, h: 100 })
  })
})

describe('startShape / updateShapeEnd / commitShape round-trip', () => {
  it('preserves anchor and final cursor in normalized coords', () => {
    const s = startShape({
      shape: 'rect',
      color: '#ff0000',
      strokeWidth: 0.0035,
      anchorPx: { x: 100, y: 100 },
      size: SIZE,
    })
    updateShapeEnd(s, { x: 400, y: 300 }, SIZE, false)
    const el = commitShape(s, SIZE)
    expect(el).not.toBeNull()
    expect(el!.shape).toBe('rect')
    expect(el!.bbox).toEqual({ x: 0.1, y: 0.1, w: 0.3, h: 0.2 })
    expect(el!.stroke).toBe('#ff0000')
  })
})

describe('commitShape threshold', () => {
  it('returns null when bbox is below 4px in both axes', () => {
    const s = startShape({
      shape: 'rect',
      color: '#000',
      strokeWidth: 0.001,
      anchorPx: { x: 100, y: 100 },
      size: SIZE,
    })
    updateShapeEnd(s, { x: 102, y: 102 }, SIZE, false)
    expect(commitShape(s, SIZE)).toBeNull()
  })

  it('allows slim shapes when at least one axis exceeds the threshold', () => {
    const s = startShape({
      shape: 'line',
      color: '#000',
      strokeWidth: 0.001,
      anchorPx: { x: 0, y: 0 },
      size: SIZE,
    })
    updateShapeEnd(s, { x: 100, y: 0 }, SIZE, false)
    expect(commitShape(s, SIZE)).not.toBeNull()
  })
})

describe('shapeDefaultFill', () => {
  it('returns translucent stroke color for closed shapes', () => {
    expect(shapeDefaultFill('rect', '#ef5350')).toBe('#ef5350bf')
    expect(shapeDefaultFill('ellipse', '#7fb8ff')).toBe('#7fb8ffbf')
    expect(shapeDefaultFill('triangle', '#ffffff')).toBe('#ffffffbf')
  })

  it('returns null for line and arrow', () => {
    expect(shapeDefaultFill('line', '#ef5350')).toBeNull()
    expect(shapeDefaultFill('arrow', '#ef5350')).toBeNull()
  })

  it('passes through non-hex colors unchanged', () => {
    expect(shapeDefaultFill('rect', 'rgb(255, 0, 0)')).toBe('rgb(255, 0, 0)')
  })
})

describe('commitShape fill defaults', () => {
  it('rect/ellipse/triangle commit with translucent fill', () => {
    for (const shape of ['rect', 'ellipse', 'triangle'] as const) {
      const s = startShape({
        shape,
        color: '#ef5350',
        strokeWidth: 0.0035,
        anchorPx: { x: 100, y: 100 },
        size: SIZE,
      })
      updateShapeEnd(s, { x: 400, y: 300 }, SIZE, false)
      const el = commitShape(s, SIZE)
      expect(el).not.toBeNull()
      expect(el!.fill).toBe('#ef5350bf')
    }
  })

  it('line/arrow commit with no fill', () => {
    for (const shape of ['line', 'arrow'] as const) {
      const s = startShape({
        shape,
        color: '#ef5350',
        strokeWidth: 0.0035,
        anchorPx: { x: 0, y: 0 },
        size: SIZE,
      })
      updateShapeEnd(s, { x: 100, y: 0 }, SIZE, false)
      const el = commitShape(s, SIZE)
      expect(el).not.toBeNull()
      expect(el!.fill).toBeNull()
    }
  })
})

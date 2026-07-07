import { expect, test } from 'vitest'
import { panelRect } from './row-read'

test('panel rect scales with game height', () => {
  const panel = panelRect({ height: 1080 })
  expect(panel.y).toBeCloseTo(1080 * 0.05)
  expect(panel.w).toBeCloseTo(1080 * 0.56)
})

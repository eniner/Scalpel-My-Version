import { expect, test } from 'vitest'
import { bandsFromPeakCenters, rewardRowBandsForCount } from './panel-geometry'
import { panelRect } from './row-read'

test('rewardRowBandsForCount keeps calibrated y for 8 rows', () => {
  const panel = panelRect({ height: 1080 })
  const bands = rewardRowBandsForCount(panel, 8)
  expect(bands).toHaveLength(8)
  expect(bands[0]!.y).toBeGreaterThan(150)
  expect(bands[0]!.y).toBeLessThan(170)
  expect(bands[7]!.y).toBeGreaterThan(472)
  expect(bands[7]!.y).toBeLessThan(492)
})

test('rewardRowBandsForCount extends ninth row below calibrated 8-row bottom', () => {
  const panel = panelRect({ height: 1080 })
  const eight = rewardRowBandsForCount(panel, 8)
  const nine = rewardRowBandsForCount(panel, 9)
  expect(nine).toHaveLength(9)
  expect(nine[0]!.y).toBeCloseTo(eight[0]!.y, 0)
  expect(nine[8]!.y).toBeGreaterThan(eight[7]!.y + 30)
  expect(nine[8]!.y).toBeLessThan(540)
})

test('bandsFromPeakCenters centers on detected text lines', () => {
  const centers = [200, 280, 360]
  const bands = bandsFromPeakCenters(centers)
  expect(bands).toHaveLength(3)
  expect(bands[1]!.y + bands[1]!.h * 0.45).toBeCloseTo(280, 0)
})

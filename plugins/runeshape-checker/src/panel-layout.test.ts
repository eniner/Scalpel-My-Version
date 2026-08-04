import { expect, test } from 'vitest'
import { detectRewardRowBands } from './panel-layout'
import { panelRect } from './row-read'

function syntheticListFrame(rowCount: number, rowStepFrac: number) {
  const panel = panelRect({ height: 1080 })
  const w = 1920
  const h = 1080
  const pixels = new Uint8ClampedArray(w * h * 4)
  for (let row = 0; row < rowCount; row++) {
    const y = Math.round(panel.y + panel.h * 0.12 + row * (panel.h * rowStepFrac))
    for (let x = Math.round(panel.w * 0.35); x < Math.round(panel.w * 0.57); x++) {
      for (let dy = -2; dy <= 2; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= h) continue
        const i = (yy * w + x) * 4
        pixels[i] = 220
        pixels[i + 1] = 210
        pixels[i + 2] = 180
        pixels[i + 3] = 255
      }
    }
  }
  return { pixels, width: w, height: h, panel }
}

test('detectRewardRowBands finds eight layout peaks', () => {
  const { pixels, width, height, panel } = syntheticListFrame(8, 0.075)
  const { bands, method } = detectRewardRowBands({ pixels, width, height }, panel)
  expect(method).toBe('layout-count')
  expect(bands.length).toBe(8)
})

test('detectRewardRowBands finds twelve layout peaks on dense page', () => {
  const { pixels, width, height, panel } = syntheticListFrame(12, 0.052)
  const { bands, method } = detectRewardRowBands({ pixels, width, height }, panel)
  expect(method).toBe('layout-count')
  expect(bands.length).toBe(12)
})

function syntheticSkillPageFrame(entryCount: number) {
  const panel = panelRect({ height: 1080 })
  const w = 1920
  const h = 1080
  const pixels = new Uint8ClampedArray(w * h * 4)
  const entryStep = panel.h * 0.104
  const listTop = panel.y + panel.h * 0.12
  for (let entry = 0; entry < entryCount; entry++) {
    const iconY = Math.round(listTop + entry * entryStep)
    const labelY = Math.round(iconY + entryStep * 0.52)
    for (const y of [iconY, labelY]) {
      const x0 = y === iconY ? Math.round(panel.w * 0.34) : Math.round(panel.w * 0.62)
      const x1 = y === iconY ? Math.round(panel.w * 0.56) : Math.round(panel.w * 0.94)
      for (let x = x0; x < x1; x++) {
        for (let dy = -2; dy <= 2; dy++) {
          const yy = y + dy
          if (yy < 0 || yy >= h) continue
          const i = (yy * w + x) * 4
          pixels[i] = 220
          pixels[i + 1] = 210
          pixels[i + 2] = 180
          pixels[i + 3] = 255
        }
      }
    }
  }
  return { pixels, width: w, height: h, panel }
}

test('detectRewardRowBands places skill bands on label peaks', () => {
  const { pixels, width, height, panel } = syntheticSkillPageFrame(7)
  const entryStep = panel.h * 0.104
  const listTop = panel.y + panel.h * 0.12
  const label0 = Math.round(listTop + entryStep * 0.52)

  const { bands, pageKind, method, peakCount } = detectRewardRowBands({ pixels, width, height }, panel)
  expect(pageKind).toBe('skills')
  expect(method).toBe('skill-peaks')
  expect(peakCount).toBeGreaterThanOrEqual(6)
  expect(bands.length).toBe(peakCount)
  expect(Math.abs(bands[0]!.y + bands[0]!.h * 0.45 - label0)).toBeLessThan(18)
})

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildModPoolReport } from './mod-pool'
import type { CraftDataset } from './types'

const data = JSON.parse(
  readFileSync(join(__dirname, '../data/crafting/crafting-coe-poe2.json'), 'utf8'),
) as CraftDataset

describe('cheat sheet coverage', () => {
  it('shows projectile skill levels on Iron Ring not quiver (no id collision)', () => {
    const ring = buildModPoolReport(data, { baseType: 'Iron Ring', itemLevel: 86, poolSource: 'craft' })
    const hits = ring.outcomes.filter((o) => /Level of all Projectile/i.test(o.text))
    expect(hits.some((o) => /\+2/.test(o.text))).toBe(true)
    const quiver = buildModPoolReport(data, { baseType: 'Broadhead Quiver', itemLevel: 86, poolSource: 'craft' })
    const qHits = quiver.outcomes.filter((o) => /Level of all Projectile/i.test(o.text))
    expect(qHits.length).toBe(0)
  })

  it('marksman pool is a dedicated table', () => {
    const marksman = buildModPoolReport(data, { baseType: 'Secured Wraps', itemLevel: 82, poolSource: 'marksman' })
    expect(marksman.poolSource).toBe('marksman')
    expect(marksman.modCount).toBeGreaterThan(50)
    expect(marksman.outcomes.some((o) => /Projectile Damage/i.test(o.text))).toBe(true)
  })

  it('desecrated pool includes bone mods for base', () => {
    const desec = buildModPoolReport(data, { baseType: 'Secured Wraps', itemLevel: 82, poolSource: 'desecrated' })
    expect(desec.modCount).toBeGreaterThan(0)
    expect(desec.poolSource).toBe('desecrated')
  })

  it('all pool combines craft marksman and desecrated', () => {
    const all = buildModPoolReport(data, { baseType: 'Secured Wraps', itemLevel: 82, poolSource: 'all' })
    const craft = buildModPoolReport(data, { baseType: 'Secured Wraps', itemLevel: 82, poolSource: 'craft' })
    expect(all.modCount).toBeGreaterThan(craft.modCount)
  })
})


import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyCraftAction, createFreshItemState } from './apply'
import { pickRevealIndex, shouldRerollReveal } from './desecration'
import { estimateChaosCost } from './economy'
import { simulateCraftSequence } from './sequence'
import type { CraftDataset } from './types'

const data = JSON.parse(
  readFileSync(join(__dirname, '../data/crafting/crafting-coe-poe2.json'), 'utf8'),
) as CraftDataset

describe('sequence desecration auto-reveal', () => {
  it(
    'bone apply leaves revealChoices; reveal clears them',
    () => {
      let state = createFreshItemState(data, 'Gold Ring', 82)!
      expect(state).toBeTruthy()
      for (const id of [
        'currency:Orb of Alchemy',
        'desecration:preserved_collarbone',
      ] as const) {
        const r = applyCraftAction(data, state, id, 42)
        expect(r.ok, r.message).toBe(true)
        state = r.state
      }
      expect(state.revealChoices?.mods.length).toBeGreaterThanOrEqual(1)
      const pick = pickRevealIndex(state.revealChoices!, {
        match: (m) => /life|resist|rarity/i.test(m.text),
      })
      const revealed = applyCraftAction(data, state, 'desecration:reveal', 43, { pickIndex: pick })
      expect(revealed.ok, revealed.message).toBe(true)
      expect(revealed.state.revealChoices).toBeUndefined()
      expect(revealed.state.mods.some((m) => m.veiled)).toBe(false)
    },
    30_000,
  )

  it(
    'sequence resolves bone → reveal without counting reveal as currency',
    async () => {
      // Warm spawn index once (same as host async path).
      createFreshItemState(data, 'Gold Ring', 82)
      const result = await simulateCraftSequence(data, {
        baseType: 'Gold Ring',
        itemLevel: 82,
        rarity: 'Normal',
        steps: [
          {
            id: '1',
            actionId: 'currency:Orb of Alchemy',
            requireConditions: false,
            conditions: [],
            onSuccess: 'continue',
            onFailure: 'stop',
          },
          {
            id: '2',
            actionId: 'desecration:preserved_collarbone',
            requireConditions: false,
            conditions: [],
            onSuccess: 'stop',
            onFailure: 'stop',
          },
        ],
        samples: 2,
        maxTrials: 10,
      })
      expect(result.avgApplies).toBeGreaterThan(0)
      expect(result.appliesByAction?.['desecration:reveal']).toBeUndefined()
      expect(result.hitRate).toBeGreaterThan(0)
    },
    90_000,
  )

  it('shouldRerollReveal only when match missing and rerolls left', () => {
    const choices = {
      mods: [
        { id: 'a', text: 'foo', kind: 'p' as const, group: 'g', ilvl: 1, tier: 1 },
        { id: 'b', text: 'bar', kind: 's' as const, group: 'g', ilvl: 1, tier: 1 },
      ],
      veiledKind: 'p' as const,
      rerollsLeft: 1,
    }
    expect(shouldRerollReveal(choices, (m) => m.text === 'zzz')).toBe(true)
    expect(shouldRerollReveal(choices, (m) => m.text === 'foo')).toBe(false)
    expect(shouldRerollReveal({ ...choices, rerollsLeft: 0 }, (m) => m.text === 'zzz')).toBe(false)
  })
})

describe('socketable apply', () => {
  it('Artificer then socketable fills socketed[]', () => {
    const armourBase =
      Object.entries(data.bases).find(([, b]) => b.c === 'Body Armours')?.[0] ?? 'Expert Explorer Armour'
    let state = createFreshItemState(data, armourBase, 80)!
    expect(state).toBeTruthy()
    const art = applyCraftAction(data, state, "currency:Artificer's Orb", 1)
    expect(art.ok, art.message).toBe(true)
    state = art.state
    expect(state.sockets).toBeGreaterThan(0)

    const sock = data.socketables?.find((s) => (s.mods.armour ?? s.mods.all) != null)
    expect(sock).toBeTruthy()
    const applied = applyCraftAction(data, state, `socketable:${sock!.id}`, 2)
    expect(applied.ok, applied.message).toBe(true)
    expect(applied.state.socketed).toContain(sock!.name)
  })
})

describe('economy CoE prices', () => {
  it('uses baked chaosPrices when present', () => {
    const withPrices = {
      ...data,
      chaosPrices: { 'Chaos Orb': 1, 'Exalted Orb': 0.1, 'Divine Orb': 12 },
    }
    const est = estimateChaosCost(
      { 'currency:Exalted Orb': 10, 'currency:Divine Orb': 1 },
      undefined,
      withPrices,
    )
    expect(est.totalChaos).toBeCloseTo(10 * 0.1 + 12, 5)
  })
})

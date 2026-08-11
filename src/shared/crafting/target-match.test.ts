import { describe, expect, it } from 'vitest'
import { extractModNumbers, modMatchesTargetQuery, parseTargetQuery } from './target-match'

describe('modMatchesTargetQuery', () => {
  it('matches projectile level aliases', () => {
    const mod = {
      text: '+2 to Level of all Projectile Skills',
      group: 'IncreaseSocketedGemLevel',
      kind: 's' as const,
    }
    expect(modMatchesTargetQuery(mod, 'project levels', 'all')).toBe(true)
    expect(modMatchesTargetQuery(mod, 'projectile level', 'all')).toBe(true)
  })

  it('requires minValue on first roll for T1 ES%', () => {
    const low = {
      text: '15% increased Energy Shield',
      group: 'DefencesPercent',
      kind: 'p' as const,
    }
    const hybridLow = {
      text: '33% increased Energy Shield, +38 to Stun Threshold',
      group: 'DefencesPercentAndStunThreshold',
      kind: 'p' as const,
    }
    const t1 = {
      text: '92% increased Energy Shield',
      group: 'DefencesPercent',
      kind: 'p' as const,
    }
    const q = '% increased Energy Shield'
    expect(modMatchesTargetQuery(low, q, 'all')).toBe(true)
    expect(modMatchesTargetQuery(low, q, 'all', { minValue: 92 })).toBe(false)
    expect(modMatchesTargetQuery(hybridLow, '>=92% increased Energy Shield', 'all')).toBe(false)
    expect(modMatchesTargetQuery(t1, '>=92% increased Energy Shield', 'all')).toBe(true)
    expect(modMatchesTargetQuery(t1, q, 'all', { minValue: 92 })).toBe(true)
  })

  it('parseTargetQuery reads >=N', () => {
    expect(parseTargetQuery('>=92% increased Energy Shield')).toEqual({
      needle: '% increased energy shield',
      minValue: 92,
    })
    expect(extractModNumbers('33% increased Energy Shield, +38 to Stun Threshold')).toEqual([33, 38])
  })

  it('matches ranged T1 needle from UI (#-# placeholders)', () => {
    const t1 = {
      text: '(92-100)% increased Energy Shield',
      group: 'DefencesPercent',
      kind: 'p' as const,
    }
    const low = {
      text: '(15-26)% increased Energy Shield',
      group: 'DefencesPercent',
      kind: 'p' as const,
    }
    expect(parseTargetQuery('>=92 (#-#)% increased Energy Shield')).toEqual({
      needle: '% increased energy shield',
      minValue: 92,
    })
    expect(modMatchesTargetQuery(t1, '>=92 (#-#)% increased Energy Shield', 'all')).toBe(true)
    expect(modMatchesTargetQuery(low, '>=92 (#-#)% increased Energy Shield', 'all')).toBe(false)
    expect(modMatchesTargetQuery(t1, '(>=92 (#-#)% increased Energy Shield)', 'all')).toBe(true)
  })

  it('matches hybrid ES+Stun T1 from UI needle with mid-line (#-#)', () => {
    const hybrid = {
      text: '(39-42)% increased Energy Shield, +(95-136) to Stun Threshold',
      group: 'DefencesPercentAndStunThreshold',
      kind: 'p' as const,
    }
    const q = '>=39 % increased Energy Shield, +(#-#) to Stun Threshold'
    expect(parseTargetQuery(q)).toEqual({
      needle: '% increased energy shield',
      minValue: 39,
    })
    expect(modMatchesTargetQuery(hybrid, q, 'all')).toBe(true)
    expect(modMatchesTargetQuery(hybrid, q, 'all', { minValue: 40 })).toBe(false)
  })
})


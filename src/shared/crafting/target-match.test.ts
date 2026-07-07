import { describe, expect, it } from 'vitest'
import { modMatchesTargetQuery } from './target-match'

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
})

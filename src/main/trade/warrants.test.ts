import { describe, expect, it } from 'vitest'
import { fingerprintSkills, skillKey, type WarrantSkill } from '@shared/warrants'

const sampleSkills: WarrantSkill[] = [
  {
    hash: 1,
    name: 'Determination',
    supports: [
      { hash: 2, name: 'Increased Area of Effect', tier: 2 },
      { hash: 3, name: 'More Duration', tier: 2 },
    ],
  },
  {
    hash: 4,
    name: 'Pride',
    supports: [{ hash: 5, name: 'Greater Area of Effect', tier: 3 }],
  },
]

describe('warrant skill fingerprints', () => {
  it('preserves skill and support link order', () => {
    expect(fingerprintSkills(sampleSkills)).toBe(
      'Determination[Increased Area of Effect:t2+More Duration:t2] | Pride[Greater Area of Effect:t3]',
    )
  })

  it('changes fingerprint when support order changes', () => {
    const swapped: WarrantSkill[] = [
      {
        ...sampleSkills[0],
        supports: [...sampleSkills[0].supports].reverse(),
      },
      sampleSkills[1],
    ]
    expect(fingerprintSkills(swapped)).not.toBe(fingerprintSkills(sampleSkills))
  })

  it('builds a sorted skill-only key for coarse filtering', () => {
    expect(skillKey(sampleSkills)).toBe('Determination, Pride')
  })
})

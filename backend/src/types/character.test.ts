import { describe, it, expect } from 'vitest'
import { musubiBoostMultiplier, GIFT_ELIGIBLE_CHARACTERS } from './character'

describe('ムスビの隠し効果（他の占い師の親密度が上がりやすくなる）', () => {
  it('ムスビの親密度が0なら、倍率は1倍', () => {
    expect(musubiBoostMultiplier(0)).toBe(1)
  })
  it('2レベルごとに、段階的に上がる（最大1.5倍）', () => {
    expect(musubiBoostMultiplier(1)).toBeCloseTo(1.1)
    expect(musubiBoostMultiplier(2)).toBeCloseTo(1.1)
    expect(musubiBoostMultiplier(3)).toBeCloseTo(1.2)
    expect(musubiBoostMultiplier(5)).toBeCloseTo(1.3)
    expect(musubiBoostMultiplier(7)).toBeCloseTo(1.4)
    expect(musubiBoostMultiplier(9)).toBeCloseTo(1.5)
    expect(musubiBoostMultiplier(10)).toBeCloseTo(1.5)
  })
  it('ムスビも、ちょっとした挨拶ができる', () => {
    expect(GIFT_ELIGIBLE_CHARACTERS).toContain(0)
  })
})

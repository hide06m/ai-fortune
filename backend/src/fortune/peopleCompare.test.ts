import { describe, it, expect } from 'vitest'
import { compareLoveTypes, knownAxes } from './peopleCompare.js'

describe('縁帳の比較', () => {
  it('同じタイプは、すべて一致', () => {
    const c = compareLoveTypes('LCPO-VI', 'LCPO-VI', ['LF', 'CA', 'PR', 'OE', 'VN', 'DI'])
    expect(c.sameCount).toBe(6)
    expect(c.summary).toContain('同じ')
  })
  it('分かっている軸だけ比べる', () => {
    const c = compareLoveTypes('LCPO-VI', 'FCPO-ND', ['LF', 'CA'])
    expect(c.total).toBe(2)
    expect(c.sameCount).toBe(1)
    expect(c.axes[0].same).toBe(false)
  })
  it('回答のある軸だけ、分かっている軸になる', () => {
    expect(knownAxes([{ id: 1, val: 0 }, { id: 7, val: 5 }])).toEqual(['LF', 'VN'])
  })
})

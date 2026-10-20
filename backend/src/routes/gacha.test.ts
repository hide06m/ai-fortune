import { describe, it, expect } from 'vitest'
import { pickWeighted } from './gacha.js'

const entries = [
  { kind: 'mbti' as const, code: 'A' },
  { kind: 'mbti' as const, code: 'B' },
  { kind: 'mbti' as const, code: 'C' },
]

describe('pickWeighted（出会いのガチャの選び方）', () => {
  it('乱数が0なら、最初のものを選ぶ', () => {
    expect(pickWeighted(entries, new Set(), () => 0).code).toBe('A')
  })
  it('乱数が1に近いと、最後のものを選ぶ', () => {
    expect(pickWeighted(entries, new Set(), () => 0.999999).code).toBe('C')
  })
  it('まだ出会っていないタイプの方が、出やすい', () => {
    const owned = new Set(['mbti:A', 'mbti:B']) // 出会っていないのは C だけ（重み 4 対 1 対 1）
    let c = 0
    let seed = 1
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 6000; i++) if (pickWeighted(entries, owned, rand).code === 'C') c++
    expect(c / 6000).toBeGreaterThan(0.6) // 理論値は 4/6 ≒ 0.67
  })
})

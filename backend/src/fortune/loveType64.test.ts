import { describe, it, expect } from 'vitest'
import { calculateLoveType64, LOVE_TYPE64_QUESTIONS, type LoveAnswer } from './loveType64.js'

describe('恋愛タイプ診断64 計算', () => {
  it('質問データは18問、idは1-18が重複なく揃っている', () => {
    expect(LOVE_TYPE64_QUESTIONS).toHaveLength(18)
    const ids = new Set(LOVE_TYPE64_QUESTIONS.map((q) => q.id))
    expect(ids.size).toBe(18)
    for (let i = 1; i <= 18; i++) {
      expect(ids.has(i)).toBe(true)
    }
  })

  it('fullTypeは「XXXX-YY」形式で、6軸すべてがA/B側いずれかの文字になる', () => {
    const answers: LoveAnswer[] = LOVE_TYPE64_QUESTIONS.map((q) => ({ id: q.id, val: 5 }))
    const result = calculateLoveType64(answers)
    expect(result.fullType).toMatch(/^[A-Z]{4}-[A-Z]{2}$/)
    expect(result.fullType).toBe(`${result.type1}-${result.type2}`)
  })

  it('全問同じ極端な回答(val=0)と逆側(val=5)で、少なくとも一部の軸が反転する', () => {
    const low: LoveAnswer[] = LOVE_TYPE64_QUESTIONS.map((q) => ({ id: q.id, val: 0 }))
    const high: LoveAnswer[] = LOVE_TYPE64_QUESTIONS.map((q) => ({ id: q.id, val: 5 }))
    const resultLow = calculateLoveType64(low)
    const resultHigh = calculateLoveType64(high)
    expect(resultLow.fullType).not.toBe(resultHigh.fullType)
  })

  it('無効な質問IDは無視される', () => {
    const answers: LoveAnswer[] = [{ id: 999, val: 5 }]
    const result = calculateLoveType64(answers)
    // 何も加点されないため、全軸0点→starred設問の方向で決定される（例外を投げないことを確認）
    expect(result.fullType).toMatch(/^[A-Z]{4}-[A-Z]{2}$/)
  })
})

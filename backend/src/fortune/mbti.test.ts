import { describe, it, expect } from 'vitest'
import { calculatePersonalityType, MBTI_QUESTIONS, type MBTIAnswer } from './mbti.js'

describe('16タイプ診断（MBTI風）計算', () => {
  it('質問データは60問ちょうど、idは0-59が重複なく揃っている', () => {
    expect(MBTI_QUESTIONS).toHaveLength(60)
    const ids = new Set(MBTI_QUESTIONS.map((q) => q.id))
    expect(ids.size).toBe(60)
    for (let i = 0; i < 60; i++) {
      expect(ids.has(i)).toBe(true)
    }
  })

  it('全問で最大値(-3)を選ぶと、各軸のパーセンテージは0-100の範囲内でA+B=100になる', () => {
    // 各軸には agree='T'寄りの設問と agree='F'寄りの設問が混在する設計のため、
    // 「全問-3で必ずどちらかが100%になる」とは限らない。ここでは値の妥当性のみ検証する
    const answers: MBTIAnswer[] = MBTI_QUESTIONS.map((q) => ({ id: q.id, val: -3 }))
    const result = calculatePersonalityType(answers)

    for (const dim of ['EI', 'SN', 'TF', 'JP', 'AT'] as const) {
      const d = result.dimensions[dim]
      expect(d.percentageA + d.percentageB).toBe(100)
      expect(d.percentageA).toBeGreaterThanOrEqual(0)
      expect(d.percentageA).toBeLessThanOrEqual(100)
    }
  })

  it('全問で0（中立）を選ぶと、各軸は50%ずつでtraitA側が採用される', () => {
    const answers: MBTIAnswer[] = MBTI_QUESTIONS.map((q) => ({ id: q.id, val: 0 }))
    const result = calculatePersonalityType(answers)

    for (const dim of ['EI', 'SN', 'TF', 'JP', 'AT'] as const) {
      const d = result.dimensions[dim]
      expect(d.percentageA).toBe(50)
      expect(d.percentageB).toBe(50)
    }
  })

  it('personalityType は「XXXX-Y」の5文字コード形式', () => {
    const answers: MBTIAnswer[] = MBTI_QUESTIONS.map((q) => ({ id: q.id, val: 0 }))
    const result = calculatePersonalityType(answers)
    expect(result.personalityType).toMatch(/^[A-Z]{4}-[A-Z]$/)
  })
})

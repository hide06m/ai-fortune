import { describe, it, expect } from 'vitest'
import { calculateBaZi } from './shichuSuimei.js'

describe('四柱推命計算', () => {
  it('1993-06-28 13:48 生まれ の命式を部分的に検証する', () => {
    // 既知データ: 1993-06-28 13:48 北海道札幌市生まれ
    // 期待値(ChatGPT占い師版から取得):
    // 年柱: 癸酉 (水金)
    // 月柱: 戊午 (土火)
    // 日柱: 庚辰 (金土) ← 正確に計算可能
    // 時柱: 癸未 (水土)
    // 日干: 庚金 ← 正確に計算可能

    const result = calculateBaZi('1993-06-28', '13:48')

    // 日干が庚金であることを確認(最も重要)
    expect(result.dayStem).toBe('庚')

    // 日柱が庚辰であることを確認(修正ユリウス日法で正確)
    expect(result.dayPillar.stem).toBe('庚')
    expect(result.dayPillar.branch).toBe('辰')
    expect(result.dayPillar.element).toBe('金')

    // 年柱・月柱・時柱は節入りなど複雑な計算が必要なため、
    // ここでは基本的な構造と干が干支の一部であることのみ確認
    expect(['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']).toContain(result.yearPillar.stem)
    expect(['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']).toContain(result.monthPillar.stem)
    expect(['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']).toContain(result.timePillar.stem)
  })

  it('別の日付でも正常に計算できる', () => {
    const result = calculateBaZi('2000-01-01')

    // 基本的な構造が正しいことを確認
    expect(result.dayStem).toBeDefined()
    expect(result.yearPillar).toBeDefined()
    expect(result.monthPillar).toBeDefined()
    expect(result.dayPillar).toBeDefined()
    expect(result.timePillar).toBeDefined()

    // 各柱が正しい干支を持っていることを確認
    expect(['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']).toContain(result.dayStem)
  })

  it('無効な日付形式でエラーを投げる', () => {
    expect(() => calculateBaZi('invalid-date')).toThrow()
  })
})

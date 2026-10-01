import { describe, it, expect } from 'vitest'
import { calculateWesternZodiac } from './westernAstrology.js'

describe('西洋占星術（星座）計算', () => {
  it('境界日を跨がない典型例：1993-06-28 生まれは蟹座', () => {
    const result = calculateWesternZodiac('1993-06-28')
    expect(result.sign).toBe('蟹座')
    expect(result.element).toBe('水')
  })

  it('年をまたぐ山羊座：12/22〜1/19', () => {
    expect(calculateWesternZodiac('2000-12-25').sign).toBe('山羊座')
    expect(calculateWesternZodiac('2000-01-10').sign).toBe('山羊座')
  })

  it('開始日境界：牡羊座は3/21から', () => {
    expect(calculateWesternZodiac('2000-03-21').sign).toBe('牡羊座')
    expect(calculateWesternZodiac('2000-03-20').sign).toBe('魚座')
  })

  it('終了日境界：牡羊座は4/19まで', () => {
    expect(calculateWesternZodiac('2000-04-19').sign).toBe('牡羊座')
    expect(calculateWesternZodiac('2000-04-20').sign).toBe('牡牛座')
  })

  it('12星座すべてが妥当な結果を返す', () => {
    const dates = [
      '2000-04-01', '2000-05-01', '2000-06-01', '2000-07-01',
      '2000-08-01', '2000-09-01', '2000-10-01', '2000-11-01',
      '2000-12-01', '2001-01-01', '2001-02-01', '2001-03-01',
    ]
    const validSigns = [
      '牡羊座', '牡牛座', '双子座', '蟹座', '獅子座', '乙女座',
      '天秤座', '蠍座', '射手座', '山羊座', '水瓶座', '魚座',
    ]
    for (const d of dates) {
      expect(validSigns).toContain(calculateWesternZodiac(d).sign)
    }
  })

  it('無効な日付形式でエラーを投げる', () => {
    expect(() => calculateWesternZodiac('invalid-date')).toThrow()
  })
})

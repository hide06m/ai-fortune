import { describe, it, expect } from 'vitest'
import { computeDailyFortune, todayInJapan } from './dailyFortune'

describe('今日の運勢', () => {
  it('同じ人・同じ日は、何度でも同じ結果', () => {
    const a = computeDailyFortune('1990-05-15', '2026-10-18')
    const b = computeDailyFortune('1990-05-15', '2026-10-18')
    expect(a).toEqual(b)
  })

  it('パーソナルデー：ライフパス＋月＋日を、1桁にしたもの', () => {
    // 1990-05-15：1+9+9+0=19→10→1、0+5=5、1+5=6 → ライフパス 1+5+6=12→3。2026-10-18：3+1+0+1+8=13→4
    const r = computeDailyFortune('1990-05-15', '2026-10-18')!
    expect(r.personalDay).toBe(4)
    expect(r.title).toBe('土台を整える日')
  })

  it('★は、1〜5の範囲。パーソナルデーは、1〜9', () => {
    for (let m = 1; m <= 12; m++) {
      for (let day = 1; day <= 28; day++) {
        const r = computeDailyFortune('1985-03-20', `2026-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`)!
        expect(r.personalDay).toBeGreaterThanOrEqual(1)
        expect(r.personalDay).toBeLessThanOrEqual(9)
        for (const v of Object.values(r.stars)) {
          expect(v).toBeGreaterThanOrEqual(1)
          expect(v).toBeLessThanOrEqual(5)
        }
      }
    }
  })

  it('日付が、正しくなければ、結果なし', () => {
    expect(computeDailyFortune('abc', '2026-10-18')).toBeNull()
    expect(computeDailyFortune('1990-05-15', '18/10/2026')).toBeNull()
  })

  it('日本時間の今日（UTCの夕方は、翌日）', () => {
    expect(todayInJapan(new Date('2026-10-17T15:30:00Z'))).toBe('2026-10-18')
    expect(todayInJapan(new Date('2026-10-17T14:59:00Z'))).toBe('2026-10-17')
  })
})

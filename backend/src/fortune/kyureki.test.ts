import { describe, it, expect } from 'vitest'
import { toKyureki, jdn, fromJdn } from './kyureki'

const k = (y: number, m: number, d: number) => {
  const r = toKyureki(y, m, d)
  return `${r.isLeap ? '閏' : ''}${r.month}/${r.day}`
}

describe('旧暦への変換（日本の暦の、既知の日付で確かめる）', () => {
  it('旧正月（旧暦1月1日）', () => {
    expect(k(2020, 1, 25)).toBe('1/1')
    expect(k(2021, 2, 12)).toBe('1/1')
    expect(k(2022, 2, 1)).toBe('1/1')
    expect(k(2023, 1, 22)).toBe('1/1')
    expect(k(2024, 2, 10)).toBe('1/1')
    expect(k(2025, 1, 29)).toBe('1/1')
    expect(k(2026, 2, 17)).toBe('1/1')
  })

  it('旧正月の前日は、前の年の12月の最後の日（29日または30日）', () => {
    expect(['12/29', '12/30']).toContain(k(2024, 2, 9))
    expect(['12/29', '12/30']).toContain(k(2025, 1, 28))
  })

  it('閏月の始まり', () => {
    expect(k(2017, 6, 24)).toBe('閏5/1')
    expect(k(2020, 5, 23)).toBe('閏4/1')
    expect(k(2023, 3, 22)).toBe('閏2/1')
    expect(k(2025, 7, 25)).toBe('閏6/1')
  })

  it('そのほかの既知の日付', () => {
    expect(k(2000, 1, 1)).toBe('11/25')
    expect(k(2019, 5, 1)).toBe('3/27')
    expect(k(2024, 1, 1)).toBe('11/20')
  })

  it('日付は連続して進み、月の長さは29日または30日、1年は12か月（閏年は13か月）', () => {
    let prev = toKyureki(2024, 1, 1)
    let monthStarts = 0
    for (let n = jdn(2024, 1, 2); n <= jdn(2025, 12, 31); n++) {
      const g = fromJdn(n)
      const cur = toKyureki(g.y, g.m, g.d)
      if (cur.day === 1) {
        monthStarts++
        expect([29, 30]).toContain(prev.day)
      } else {
        expect(cur.day).toBe(prev.day + 1)
      }
      prev = cur
    }
    // 2024-01-02〜2025-12-31 の、約2年間で、月の始まりは 24〜26 回
    expect(monthStarts).toBeGreaterThanOrEqual(24)
    expect(monthStarts).toBeLessThanOrEqual(26)
  })
})

describe('ユリウス日番号の往復', () => {
  it('日付に戻る', () => {
    expect(fromJdn(jdn(2000, 1, 1))).toEqual({ y: 2000, m: 1, d: 1 })
    expect(fromJdn(jdn(1990, 6, 28))).toEqual({ y: 1990, m: 6, d: 28 })
  })
})

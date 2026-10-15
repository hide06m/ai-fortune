import { describe, it, expect } from 'vitest'
import { isValidPastDate } from './dateCheck'

describe('生年月日の確認', () => {
  const now = new Date('2026-10-15T03:00:00Z')
  it('正しい過去の日付は通る', () => {
    expect(isValidPastDate('1990-05-15', now)).toBe(true)
    expect(isValidPastDate('2026-10-15', now)).toBe(true)
  })
  it('未来・存在しない日・形式違い・1900年より前は通らない', () => {
    expect(isValidPastDate('2026-10-16', now)).toBe(false)
    expect(isValidPastDate('2999-01-01', now)).toBe(false)
    expect(isValidPastDate('2023-02-30', now)).toBe(false)
    expect(isValidPastDate('1899-12-31', now)).toBe(false)
    expect(isValidPastDate('1990/05/15', now)).toBe(false)
    expect(isValidPastDate(undefined, now)).toBe(false)
  })
})

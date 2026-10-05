import { describe, it, expect, vi } from 'vitest'

// client.ts は import 時に GEMINI_API_KEY を要求する（未設定だと process.exit）。テストではダミーを入れる
vi.stubEnv('GEMINI_API_KEY', 'test-key')

const { isTransientError } = await import('./client.js')

describe('isTransientError', () => {
  it('Gemini の 503 エラー文を一時エラーと判定する', () => {
    const error = new Error(
      '[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent: [503 Service Unavailable] This model is currently experiencing high demand.'
    )
    expect(isTransientError(error)).toBe(true)
  })

  it('status プロパティが 429 / 503 のとき一時エラーと判定する', () => {
    expect(isTransientError(Object.assign(new Error('x'), { status: 429 }))).toBe(true)
    expect(isTransientError(Object.assign(new Error('x'), { status: 503 }))).toBe(true)
  })

  it('ネットワーク断は一時エラーと判定する', () => {
    expect(isTransientError(new TypeError('fetch failed'))).toBe(true)
  })

  it('400 や 404 など再試行しても直らないエラーは対象外', () => {
    expect(isTransientError(new Error('Error fetching from https://x: [400 Bad Request] invalid argument'))).toBe(false)
    expect(isTransientError(Object.assign(new Error('x'), { status: 404 }))).toBe(false)
  })
})

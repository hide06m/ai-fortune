import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { LOVE_BASE_CHARACTERS } from './loveType64'

const dir = join(__dirname, '../../../frontend/public/assets/results')

describe('診断結果のキャラクター画像', () => {
  it('恋愛タイプの16キャラすべてに、同じコードの画像がある', () => {
    expect(Object.keys(LOVE_BASE_CHARACTERS)).toHaveLength(16)
    for (const code of Object.keys(LOVE_BASE_CHARACTERS)) {
      expect(existsSync(join(dir, 'lovetype', `${code}.webp`)), code).toBe(true)
    }
  })

  it('性格タイプ診断の16タイプすべてに、同じコードの画像がある', () => {
    const codes = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP']
    for (const code of codes) {
      expect(existsSync(join(dir, 'mbti', `${code}.webp`)), code).toBe(true)
    }
  })
})

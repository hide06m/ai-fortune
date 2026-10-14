import { describe, it, expect } from 'vitest'
import { buildMusubiPrompt, hasAnyProfile } from './musubiPrompt'
import type { UserProfileSources } from '../db/musubi'

const empty: UserProfileSources = { birth: null, mbti: null, loveType: null, palmAnalysis: null, seimeiAnalysis: null }

describe('ムスビの総合相談のプロンプト', () => {
  it('情報が1つも無いときは、診断できない', () => {
    expect(hasAnyProfile(empty)).toBe(false)
  })

  it('ある情報の節だけを載せ、無い情報の節は載せない', () => {
    const p: UserProfileSources = {
      ...empty,
      mbti: { personalityType: 'INTJ-A', dimensions: {} },
      seimeiAnalysis: '【姓名判断】山田 太郎\n天格 8画',
    }
    expect(hasAnyProfile(p)).toBe(true)
    const prompt = buildMusubiPrompt(p, '転職で迷っている')
    expect(prompt).toContain('INTJ-A')
    expect(prompt).toContain('姓名判断')
    expect(prompt).toContain('転職で迷っている')
    expect(prompt).not.toContain('## ラブタイプ診断64')
    expect(prompt).not.toContain('## 手相')
    expect(prompt).not.toContain('## 生年月日の占い')
  })

  it('悩みが空のときは、総合的に診断する旨になる', () => {
    const prompt = buildMusubiPrompt({ ...empty, mbti: { personalityType: 'ENFP-T', dimensions: {} } }, '')
    expect(prompt).toContain('特定の悩みの入力はなし')
  })
})

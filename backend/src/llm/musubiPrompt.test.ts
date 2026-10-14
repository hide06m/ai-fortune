import { describe, it, expect } from 'vitest'
import { buildMusubiPrompt, buildMusubiProfilePrompt, hasAnyProfile } from './musubiPrompt'
import type { UserProfileSources } from '../db/musubi'

const empty: UserProfileSources = {
  birth: null,
  mbti: null,
  loveType: null,
  palmAnalysis: null,
  seimeiAnalysis: null,
  sukuyouAnalysis: null,
  pastConcerns: [],
  diagnosisCounts: {},
  previousMusubi: [],
}

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

  it('1段階目の人物像の解析を、2段階目に引き継ぐ。無いときは、その節を作らない', () => {
    const p = { ...empty, mbti: { personalityType: 'INTJ-A', dimensions: {} } }
    expect(buildMusubiPrompt(p, '相談', '核になる性格は慎重')).toContain('核になる性格は慎重')
    expect(buildMusubiPrompt(p, '相談')).not.toContain('先に行った、この人の「人となり」の解析')
  })

  it('これまでの悩み・診断回数・前回の相談があれば、手がかりとして載せる', () => {
    const p: UserProfileSources = {
      ...empty,
      mbti: { personalityType: 'ENFP-T', dimensions: {} },
      pastConcerns: [{ concern: '転職を考えている', characterId: 1, date: '2026-10-01' }],
      diagnosisCounts: { 1: 3, 4: 2 },
      previousMusubi: [{ date: '2026-10-05', analysis: '前回は、慎重さが課題だった' }],
    }
    const text = buildMusubiProfilePrompt(p)
    expect(text).toContain('転職を考えている')
    expect(text).toContain('ナツメ：3回')
    expect(text).toContain('前回は、慎重さが課題だった')
  })

  it('悩みが空のときは、総合的に診断する旨になる', () => {
    const prompt = buildMusubiPrompt({ ...empty, mbti: { personalityType: 'ENFP-T', dimensions: {} } }, '')
    expect(prompt).toContain('特定の悩みの入力はなし')
  })
})

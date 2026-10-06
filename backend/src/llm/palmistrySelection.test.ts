import { describe, it, expect } from 'vitest'
import { sanitizeCandidates, parseSelectionOutput, buildSelectionPrompt } from './palmistrySelection.js'
import { describeFeatures } from './palmistryCriteria.js'

const features = {
  lengthRatio: 0.7,
  straightness: 0.8,
  depth: 0.5,
  continuity: 0.9,
  start: { a: -0.6, d: 0.2 },
  end: { a: 0.3, d: 0.12 },
}
const goodCandidate = (id: string, zone = 'heart') => ({
  id,
  zone,
  points: [{ x: 10, y: 20 }, { x: 300, y: 400 }],
  features,
})

describe('sanitizeCandidates', () => {
  it('正しい候補を通し、不正な形のものを捨てる', () => {
    const out = sanitizeCandidates([
      goodCandidate('C1'),
      { ...goodCandidate('bad-id') },
      { ...goodCandidate('C2'), zone: 'unknown' },
      { ...goodCandidate('C3'), points: [{ x: 1, y: 1 }] },
      { ...goodCandidate('C4'), features: { ...features, depth: 'x' } },
      goodCandidate('C1'),
    ])
    expect(out.map((c) => c.id)).toEqual(['C1'])
  })

  it('座標を0-1000に丸める', () => {
    const out = sanitizeCandidates([{ ...goodCandidate('C1'), points: [{ x: -5, y: 5000 }, { x: 10, y: 20 }] }])
    expect(out[0].points[0]).toEqual({ x: 0, y: 1000 })
  })

  it('配列でない入力は空配列', () => {
    expect(sanitizeCandidates(null)).toEqual([])
    expect(sanitizeCandidates('x')).toEqual([])
  })
})

describe('parseSelectionOutput', () => {
  const candidates = sanitizeCandidates([goodCandidate('C1', 'heart'), goodCandidate('C2', 'head')])

  it('選ばれた候補の形と根拠を付けて返す', () => {
    const raw = JSON.stringify({
      analysis: '総合結論',
      lines: [
        { id: 'heart', candidateId: 'C1', reading: '感情線の読み' },
        { id: 'head', candidateId: 'none', reading: '見えません' },
      ],
    })
    const out = parseSelectionOutput(raw, candidates)
    const heart = out.lines.find((l) => l.id === 'heart')!
    expect(heart.candidateId).toBe('C1')
    expect(heart.points).toHaveLength(2)
    expect(heart.evidence.length).toBeGreaterThan(0)
    const head = out.lines.find((l) => l.id === 'head')!
    expect(head.candidateId).toBeNull()
    expect(head.points).toEqual([])
  })

  it('存在しない候補番号や、同じ候補の重複選択は無視する', () => {
    const raw = JSON.stringify({
      analysis: 'a',
      lines: [
        { id: 'heart', candidateId: 'C9', reading: 'r1' },
        { id: 'head', candidateId: 'C1', reading: 'r2' },
        { id: 'life', candidateId: 'C1', reading: 'r3' },
      ],
    })
    const out = parseSelectionOutput(raw, candidates)
    expect(out.lines.find((l) => l.id === 'heart')!.candidateId).toBeNull()
    expect(out.lines.find((l) => l.id === 'head')!.candidateId).toBe('C1')
    expect(out.lines.find((l) => l.id === 'life')!.candidateId).toBeNull()
  })

  it('JSONでない出力は全文を診断文にして線は空', () => {
    expect(parseSelectionOutput('ただの文章', candidates)).toEqual({ analysis: 'ただの文章', lines: [] })
  })
})

describe('describeFeatures', () => {
  it('測定値を判断基準の言葉と傾向に直す', () => {
    const r = describeFeatures('heart', { ...features, lengthRatio: 0.95, straightness: 0.6, depth: 0.8, continuity: 0.5 })
    expect(r.evidence.join(' ')).toContain('長め')
    expect(r.evidence.join(' ')).toContain('大きく曲がっている')
    expect(r.evidence.join(' ')).toContain('濃い')
    expect(r.evidence.join(' ')).toContain('途切れ')
    expect(r.tendencies.length).toBeGreaterThanOrEqual(4)
  })

  it('感情線の終点が人差し指側のとき、その位置を根拠に含める', () => {
    const r = describeFeatures('heart', { ...features, end: { a: 0.4, d: 0.1 } })
    expect(r.evidence.join(' ')).toContain('人差し指')
  })
})

describe('buildSelectionPrompt', () => {
  it('候補の番号と判断基準を含む', () => {
    const p = buildSelectionPrompt('', sanitizeCandidates([goodCandidate('C1')]))
    expect(p).toContain('C1')
    expect(p).toContain('感情線')
    expect(p).toContain('candidateId')
  })
})

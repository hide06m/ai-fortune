import { describe, it, expect } from 'vitest'
import { sanitizeDetectedLines, parseReadingOutput, buildReadingPrompt } from './palmistryReading.js'
import { describeFeatures } from './palmistryCriteria.js'

const features = {
  lengthRatio: 0.7,
  straightness: 0.8,
  depth: 0.5,
  continuity: 0.9,
  start: { a: -0.6, d: 0.2 },
  end: { a: 0.3, d: 0.12 },
}
const goodLine = (id: string) => ({
  id,
  points: [{ x: 10, y: 20 }, { x: 300, y: 400 }],
  features,
})

describe('sanitizeDetectedLines', () => {
  it('正しい線を通し、不正な形・未知のid・重複を捨てる', () => {
    const out = sanitizeDetectedLines([
      goodLine('heart'),
      goodLine('unknown'),
      { ...goodLine('head'), points: [{ x: 1, y: 1 }] },
      { ...goodLine('life'), features: { ...features, depth: 'x' } },
      goodLine('heart'),
      goodLine('sun'),
    ])
    expect(out.map((l) => l.id)).toEqual(['heart', 'sun'])
  })

  it('座標を0-1000に丸める', () => {
    const out = sanitizeDetectedLines([{ ...goodLine('heart'), points: [{ x: -5, y: 5000 }, { x: 10, y: 20 }] }])
    expect(out[0].points[0]).toEqual({ x: 0, y: 1000 })
  })

  it('配列でない入力は空配列', () => {
    expect(sanitizeDetectedLines(null)).toEqual([])
    expect(sanitizeDetectedLines('x')).toEqual([])
  })
})

describe('parseReadingOutput', () => {
  const detected = sanitizeDetectedLines([goodLine('heart'), goodLine('head')])

  it('検出された線の形と根拠を付けて返す', () => {
    const raw = JSON.stringify({
      analysis: '総合結論',
      lines: [
        { id: 'heart', reading: '感情線の読み' },
        { id: 'head', reading: '頭脳線の読み' },
      ],
    })
    const out = parseReadingOutput(raw, detected)
    expect(out.lines.map((l) => l.id)).toEqual(['heart', 'head'])
    expect(out.lines[0].points).toHaveLength(2)
    expect(out.lines[0].evidence.length).toBeGreaterThan(0)
  })

  it('検出されていない線の読みは捨てる（検出できなかった線は結果に出さない）', () => {
    const raw = JSON.stringify({
      analysis: 'a',
      lines: [
        { id: 'life', reading: '勝手に書かれた読み' },
        { id: 'heart', reading: 'r' },
      ],
    })
    const out = parseReadingOutput(raw, detected)
    expect(out.lines.map((l) => l.id)).toEqual(['heart'])
  })

  it('JSONでない出力は全文を診断文にして線は空', () => {
    expect(parseReadingOutput('ただの文章', detected)).toEqual({ analysis: 'ただの文章', lines: [] })
  })
})

describe('buildReadingPrompt', () => {
  it('検出できた線の測定値と判断基準だけを含み、他の線の説明は含まない', () => {
    const p = buildReadingPrompt('', sanitizeDetectedLines([goodLine('heart')]))
    expect(p).toContain('感情線')
    expect(p).toContain('長さ0.70')
    expect(p).not.toContain('**頭脳線**')
    expect(p).not.toContain('**生命線**')
  })

  it('線が1本も無いときは、個々の線の読みを書かせない', () => {
    const p = buildReadingPrompt('', [])
    expect(p).toContain('個々の線')
    expect(p).not.toContain('## 判断基準')
  })

  it('検出できなかった線について言及させない指示を含む', () => {
    const p = buildReadingPrompt('', sanitizeDetectedLines([goodLine('heart')]))
    expect(p).toContain('言及しない')
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

  it('生命線の途切れは「途中で一度途切れ、その先でまた続く」と書き、寿命や病気としては読まない', () => {
    const r = describeFeatures('life', { ...features, continuity: 0.6 })
    expect(r.evidence.join(' ')).toContain('その先でまた続いている')
    expect(r.tendencies.join(' ')).toContain('持ち直')
    expect(r.tendencies.join(' ')).not.toMatch(/寿命|病気/)
  })

  it('感情線の終点が人差し指側のとき、その位置を根拠に含める', () => {
    const r = describeFeatures('heart', { ...features, end: { a: 0.4, d: 0.1 } })
    expect(r.evidence.join(' ')).toContain('人差し指')
  })

  it('ますかけ線は専用の根拠を返し、空の意味文を含めない', () => {
    const r = describeFeatures('simian', features)
    expect(r.evidence[0]).toContain('1本にまとまり')
    expect(r.tendencies.every((t) => t.length > 0)).toBe(true)
  })
})

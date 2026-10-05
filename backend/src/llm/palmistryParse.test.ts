import { describe, it, expect } from 'vitest'
import { parsePalmistryOutput } from './palmistryParse.js'

describe('parsePalmistryOutput', () => {
  it('正常なJSONから診断文と線を取り出す', () => {
    const raw = JSON.stringify({
      analysis: '総合結論です。',
      lines: [
        { id: 'heart', found: true, points: [{ x: 100, y: 200 }, { x: 500, y: 250 }], reading: '感情豊かです。' },
        { id: 'life', found: true, points: [{ x: 300, y: 400 }, { x: 320, y: 800 }], reading: '生命力があります。' },
      ],
    })
    const out = parsePalmistryOutput(raw)
    expect(out.analysis).toBe('総合結論です。')
    expect(out.lines.map((l) => l.id)).toEqual(['heart', 'life'])
    expect(out.lines[0].label).toBe('感情線')
    expect(out.lines[0].points).toHaveLength(2)
  })

  it('JSONでない出力は全文を診断文として扱い、線は空にする', () => {
    const out = parsePalmistryOutput('ただの文章です')
    expect(out).toEqual({ analysis: 'ただの文章です', lines: [] })
  })

  it('座標を0-1000に丸め、不正な点は捨てる', () => {
    const raw = JSON.stringify({
      analysis: 'a',
      lines: [{ id: 'head', points: [{ x: -50, y: 2000 }, { x: 'bad', y: 1 }, { x: 10, y: 20 }], reading: 'r' }],
    })
    const out = parsePalmistryOutput(raw)
    expect(out.lines[0].points).toEqual([{ x: 0, y: 1000 }, { x: 10, y: 20 }])
  })

  it('点が足りない線は解説だけ残して points を空にする', () => {
    const raw = JSON.stringify({ analysis: 'a', lines: [{ id: 'fate', found: false, points: [], reading: 'はっきり見えません' }] })
    const out = parsePalmistryOutput(raw)
    expect(out.lines).toHaveLength(1)
    expect(out.lines[0].points).toEqual([])
  })

  it('未知のIDと重複IDは無視する', () => {
    const raw = JSON.stringify({
      analysis: 'a',
      lines: [
        { id: 'unknown', points: [{ x: 1, y: 1 }, { x: 2, y: 2 }], reading: 'r' },
        { id: 'heart', points: [{ x: 1, y: 1 }, { x: 2, y: 2 }], reading: 'r1' },
        { id: 'heart', points: [{ x: 3, y: 3 }, { x: 4, y: 4 }], reading: 'r2' },
      ],
    })
    const out = parsePalmistryOutput(raw)
    expect(out.lines).toHaveLength(1)
    expect(out.lines[0].reading).toBe('r1')
  })
})

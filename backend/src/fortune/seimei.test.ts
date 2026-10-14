import { describe, it, expect } from 'vitest'
import { computeSeimei, strokesOfName, strokesOfChar, elementOf, relationOf } from './seimei'
import { seimeiNumberOf, normalizeStrokeNumber, SEIMEI_NUMBERS } from './data/seimeiNumbers'

function chars(name: string) {
  const r = strokesOfName(name)
  if (!r.ok) throw new Error('unknown: ' + r.unknown.join(''))
  return r.chars
}

describe('画数（旧字体・部首は元の形）', () => {
  it('基本の漢字', () => {
    expect(strokesOfChar('山', null)).toEqual({ ok: true, strokes: 3 })
    expect(strokesOfChar('田', null)).toEqual({ ok: true, strokes: 5 })
    expect(strokesOfChar('子', null)).toEqual({ ok: true, strokes: 3 })
  })
  it('さんずい・くさかんむりは、元の部首の画数で数える', () => {
    // 流：水（4）＋7 ＝ 11、清：4＋8 ＝ 12、花：艸（6）＋4 ＝ 10
    expect(strokesOfChar('流', null)).toEqual({ ok: true, strokes: 11 })
    expect(strokesOfChar('清', null)).toEqual({ ok: true, strokes: 12 })
    expect(strokesOfChar('花', null)).toEqual({ ok: true, strokes: 10 })
  })
  it('常用漢字は、旧字体の画数で数える（国→國＝11）', () => {
    expect(strokesOfChar('国', null)).toEqual({ ok: true, strokes: 11 })
    expect(strokesOfChar('桜', null)).toEqual({ ok: true, strokes: 21 })
  })
  it('かなは書いた画数、濁点・半濁点を足す', () => {
    expect(strokesOfChar('あ', null)).toEqual({ ok: true, strokes: 3 })
    expect(strokesOfChar('が', null)).toEqual({ ok: true, strokes: 5 })
    expect(strokesOfChar('ぱ', null)).toEqual({ ok: true, strokes: 4 })
    expect(strokesOfChar('ア', null)).toEqual({ ok: true, strokes: 2 })
  })
  it('「々」は直前の字と同じ画数、先頭の「々」は不明', () => {
    expect(chars('佐々木').map((c) => c.strokes)).toEqual([7, 7, 4])
    expect(strokesOfChar('々', null)).toEqual({ ok: false })
  })
  it('表にない字は、一覧で返す', () => {
    const r = strokesOfName('山A')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.unknown).toEqual(['A'])
  })
})

describe('五格', () => {
  it('姓2字・名2字：天格＝姓の合計、人格＝姓の最後＋名の最初、地格＝名の合計、総格＝全部', () => {
    // 山田（3+5）花子（10+3）
    const r = computeSeimei(chars('山田'), chars('花子'))
    const by = Object.fromEntries(r.kaku.map((k) => [k.key, k.strokes]))
    expect(by.ten).toBe(8)
    expect(by.jin).toBe(15)
    expect(by.chi).toBe(13)
    expect(by.so).toBe(21)
    expect(by.gai).toBe(8 + 13 - 15)
  })
  it('姓1字は天格に、名1字は地格に、霊数1を足す。総格には足さない', () => {
    // 林（8）と、名1字（表の画数は、strokesOfChar から取る）
    const given = chars('蓮')
    const g = given[0].strokes
    const r = computeSeimei(chars('林'), given)
    const by = Object.fromEntries(r.kaku.map((k) => [k.key, k.strokes]))
    expect(by.ten).toBe(9)
    expect(by.chi).toBe(g + 1)
    expect(by.jin).toBe(8 + g)
    expect(by.so).toBe(8 + g)
  })
})

describe('三才・五行', () => {
  it('1の位から五行を出す', () => {
    expect(elementOf(1)).toBe('木')
    expect(elementOf(4)).toBe('火')
    expect(elementOf(15)).toBe('土')
    expect(elementOf(18)).toBe('金')
    expect(elementOf(20)).toBe('水')
  })
  it('相生・比和・相剋', () => {
    expect(relationOf('木', '火')).toBe('相生')
    expect(relationOf('火', '木')).toBe('相生')
    expect(relationOf('木', '木')).toBe('比和')
    expect(relationOf('木', '土')).toBe('相剋')
  })
})

describe('81画の表', () => {
  it('1〜81すべてに、吉凶と文章がある', () => {
    for (let n = 1; n <= 81; n++) {
      const x = SEIMEI_NUMBERS[n]
      expect(x, String(n)).toBeTruthy()
      expect(x.text.length).toBeGreaterThan(10)
    }
  })
  it('82以上は、80を引いた数として扱う', () => {
    expect(normalizeStrokeNumber(82)).toBe(2)
    expect(normalizeStrokeNumber(81)).toBe(81)
    expect(seimeiNumberOf(95).keyword).toBe(seimeiNumberOf(15).keyword)
  })
})

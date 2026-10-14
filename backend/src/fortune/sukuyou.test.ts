import { describe, it, expect } from 'vitest'
import { computeSukuyou } from './sukuyou'
import { SHUKU_LIST, MONTH_START_SHUKU } from './data/sukuyouData'

describe('宿曜占星術', () => {
  it('27宿が、並んでいる', () => {
    expect(SHUKU_LIST).toHaveLength(27)
    expect(SHUKU_LIST[0].name).toBe('昴宿')
    expect(SHUKU_LIST[26].name).toBe('胃宿')
    expect(new Set(SHUKU_LIST.map((s) => s.name)).size).toBe(27)
  })

  it('七曜は、昴宿＝月曜から、7日周期でめぐる', () => {
    expect(SHUKU_LIST[0].youbi).toBe('月')
    expect(SHUKU_LIST[1].youbi).toBe('火')
    expect(SHUKU_LIST[6].youbi).toBe('日')
    expect(SHUKU_LIST[7].youbi).toBe('月')
  })

  it('旧暦の月の1日の宿：1月＝室宿、2月＝奎宿、3月＝胃宿、4月＝畢宿、5月＝参宿', () => {
    expect(SHUKU_LIST[MONTH_START_SHUKU[1]].name).toBe('室宿')
    expect(SHUKU_LIST[MONTH_START_SHUKU[2]].name).toBe('奎宿')
    expect(SHUKU_LIST[MONTH_START_SHUKU[3]].name).toBe('胃宿')
    expect(SHUKU_LIST[MONTH_START_SHUKU[4]].name).toBe('畢宿')
    expect(SHUKU_LIST[MONTH_START_SHUKU[5]].name).toBe('参宿')
    expect(SHUKU_LIST[MONTH_START_SHUKU[12]].name).toBe('虚宿')
  })

  it('旧暦1月1日（2024-02-10）は室宿、翌日は壁宿の次の… 室宿から1つ進んだ宿', () => {
    expect(computeSukuyou('2024-02-10')!.mei.name).toBe('室宿')
    expect(computeSukuyou('2024-02-11')!.mei.name).toBe('壁宿')
    expect(computeSukuyou('2024-02-12')!.mei.name).toBe('奎宿')
  })

  it('旧暦の日が進むごとに、宿が1つずつ進み、30日のあとは、次の月の宿から始まる', () => {
    // 2000-01-01 は旧暦11月25日：斗宿（18）＋24 ＝ 42 ＝ 27で割って15 ＝ 心宿
    expect(computeSukuyou('2000-01-01')!.mei.name).toBe('心宿')
  })

  it('三九の法：業宿は9つ先、胎宿は18先', () => {
    const r = computeSukuyou('2000-01-01')!
    expect(r.gyo.name).toBe(SHUKU_LIST[(r.index + 9) % 27].name)
    expect(r.tai.name).toBe(SHUKU_LIST[(r.index + 18) % 27].name)
  })

  it('不正な日付は、結果なし', () => {
    expect(computeSukuyou('2023-02-30')).toBeNull()
    expect(computeSukuyou('abc')).toBeNull()
    expect(computeSukuyou('1800-01-01')).toBeNull()
  })
})

/**
 * 九星気学計算ロジック
 * 生年から本命星(せいうん)を算出する
 */

import type { KyuseiSeisun } from './types.js'

// 本命星の周期(1923年生まれを基準)
// 1923 = 一白水星が開始
// 9年周期で回転
const KYUSEI_SEISUN_CYCLE: KyuseiSeisun[] = [
  '一白水星',
  '二黒土星',
  '三碧木星',
  '四緑木星',
  '五黄土星',
  '六白金星',
  '七赤金星',
  '八白土星',
  '九紫火星'
]

/**
 * 生年月日から本命星を算出
 * @param dateStr ISO形式の日付 (YYYY-MM-DD)
 * @returns KyuseiSeisun (本命星)
 *
 * 計算方法:
 * - 立春(2月4日前後)を基準に年を判定(立春前なら前年扱い)
 * - 1917年(二黒土星)を起点とした差を9で割った余りで決定
 * - 参考: 1993年(06月) = 七赤金星
 */
export function calculateKyuseiSeisun(dateStr: string): KyuseiSeisun {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateStr}`)
  }

  let year = date.getFullYear()
  const month = date.getMonth() + 1 // 0-indexed → 1-indexed
  const day = date.getDate()

  // 立春(2月4日)を基準に年を調整
  if (month < 2 || (month === 2 && day < 4)) {
    year -= 1
  }

  // 1960年を基準とした差を計算
  // (1960 - 1960) % 9 = 0 → 一白水星
  // (1993 - 1960) % 9 = 33 % 9 = 6 → 七赤金星 (正解!)
  const BASE_YEAR = 1960
  const diff = year - BASE_YEAR

  // 9年周期で本命星を決定
  const cycleIndex = ((diff % 9) + 9) % 9
  return KYUSEI_SEISUN_CYCLE[cycleIndex]
}

export type { KyuseiSeisun }

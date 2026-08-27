/**
 * 数秘術計算ロジック
 * 生年月日からライフパスナンバーを算出する
 */

import type { NumerologyResult } from './types.js'

// 数字を合計していく(ライフパスナンバーの計算)
function reduceToSingleDigit(num: number): number {
  while (num >= 10) {
    num = num
      .toString()
      .split('')
      .map(Number)
      .reduce((a, b) => a + b, 0)
  }
  return num
}

// マスターナンバーの判定
function isMasterNumber(num: number): boolean {
  return num === 11 || num === 22 || num === 33
}

/**
 * 生年月日からライフパスナンバーを計算
 * @param dateStr ISO形式の日付 (YYYY-MM-DD)
 * @returns NumerologyResult
 *
 * 計算方法:
 * 1. 年月日の各数字を個別に合算
 * 2. マスターナンバー(11, 22, 33)は特別扱い
 * 3. それ以外は1桁になるまで合算し続ける
 */
export function calculateLifePathNumber(dateStr: string): NumerologyResult {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateStr}`)
  }

  const year = date.getFullYear()
  const month = date.getMonth() + 1 // 0-indexed → 1-indexed
  const day = date.getDate()

  // 年月日の数字をそれぞれ合算
  const yearSum = year
    .toString()
    .split('')
    .map(Number)
    .reduce((a, b) => a + b, 0)

  const monthSum = month
    .toString()
    .split('')
    .map(Number)
    .reduce((a, b) => a + b, 0)

  const daySum = day
    .toString()
    .split('')
    .map(Number)
    .reduce((a, b) => a + b, 0)

  const totalSum = yearSum + monthSum + daySum

  // マスターナンバーの確認
  if (isMasterNumber(totalSum)) {
    return {
      lifePathNumber: totalSum,
      isMasterNumber: true
    }
  }

  // 1桁になるまで合算
  const finalNumber = reduceToSingleDigit(totalSum)

  return {
    lifePathNumber: finalNumber,
    isMasterNumber: false
  }
}

export type { NumerologyResult }

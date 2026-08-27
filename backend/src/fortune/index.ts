/**
 * 占術計算ロジックの統合エクスポート
 */

export { calculateBaZi, type BaZiChart, type Sexagenary, type HeavenlyStem, type EarthlyBranch, type Element } from './shichuSuimei.js'
export { calculateLifePathNumber, type NumerologyResult } from './numerology.js'
export { calculateKyuseiSeisun, type KyuseiSeisun } from './kyuseiKigaku.js'
export type { FortuneReading } from './types.js'

/**
 * 統合占い診断計算関数
 */
export function calculateFullReading(
  birthDate: string,
  birthTime?: string,
  birthPlace?: string,
  concern?: string
) {
  const { calculateBaZi, calculateLifePathNumber, calculateKyuseiSeisun } = await import('./index.js')

  return {
    baZi: calculateBaZi(birthDate, birthTime),
    numerology: calculateLifePathNumber(birthDate),
    kyuseiSeisun: calculateKyuseiSeisun(birthDate),
    userInput: {
      birthDate,
      birthTime,
      birthPlace,
      concern: concern || ''
    }
  }
}

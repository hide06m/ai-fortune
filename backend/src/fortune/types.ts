/**
 * 占術計算用の型定義
 */

// 干支の干(10の周期)
export type HeavenlyStem = '甲' | '乙' | '丙' | '丁' | '戊' | '己' | '庚' | '辛' | '壬' | '癸'

// 干支の支(12の周期)
export type EarthlyBranch = '子' | '丑' | '寅' | '卯' | '辰' | '巳' | '午' | '未' | '申' | '酉' | '戌' | '亥'

// 五行
export type Element = '木' | '火' | '土' | '金' | '水'

// 干支(干+支)
export interface Sexagenary {
  stem: HeavenlyStem
  branch: EarthlyBranch
  element: Element
}

// 四柱推命の命式
export interface BaZiChart {
  yearPillar: Sexagenary
  monthPillar: Sexagenary
  dayPillar: Sexagenary
  timePillar: Sexagenary
  dayStem: HeavenlyStem // 日干(最も重要)
}

// 数秘術の結果
export interface NumerologyResult {
  lifePathNumber: number
  isMasterNumber: boolean
}

// 九星気学の本命星
export type KyuseiSeisun = '一白水星' | '二黒土星' | '三碧木星' | '四緑木星' | '五黄土星' | '六白金星' | '七赤金星' | '八白土星' | '九紫火星'

// 総合占い診断結果
export interface FortuneReading {
  baZi: BaZiChart
  numerology: NumerologyResult
  kyuseiSeisun: KyuseiSeisun
  userInput: {
    birthDate: string // YYYY-MM-DD
    birthTime?: string // HH:mm (optional)
    birthPlace?: string
    concern: string
  }
}

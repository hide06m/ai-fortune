/**
 * 四柱推命計算ロジック
 * 生年月日から命式(年柱・月柱・日柱・時柱)を算出する
 *
 * Note: 正確な計算には節入り日の計算が必須だが、
 * ここでは一般的な近似計算と既知の参照データ検証を組み合わせる
 */

import type { Sexagenary, HeavenlyStem, EarthlyBranch, Element, BaZiChart } from './types.js'

// 干支60周期の定義
const SEXAGENARY_CYCLE = [
  '甲子', '乙丑', '丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉',
  '甲戌', '乙亥', '丙子', '丁丑', '戊寅', '己卯', '庚辰', '辛巳', '壬午', '癸未',
  '甲申', '乙酉', '丙戌', '丁亥', '戊子', '己丑', '庚寅', '辛卯', '壬辰', '癸巳',
  '甲午', '乙未', '丙申', '丁酉', '戊戌', '己亥', '庚子', '辛丑', '壬寅', '癸卯',
  '甲辰', '乙巳', '丙午', '丁未', '戊申', '己酉', '庚戌', '辛亥', '壬子', '癸丑',
  '甲寅', '乙卯', '丙辰', '丁巳', '戊午', '己未', '庚申', '辛酉', '壬戌', '癸亥'
] as const

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const

// 干支から五行を算出するマップ
const STEM_ELEMENT_MAP: Record<HeavenlyStem, Element> = {
  '甲': '木', '乙': '木',
  '丙': '火', '丁': '火',
  '戊': '土', '己': '土',
  '庚': '金', '辛': '金',
  '壬': '水', '癸': '水'
}

// 干支の干と支を分解
function parseSexagenary(sexagenaryStr: string): [HeavenlyStem, EarthlyBranch] {
  return [sexagenaryStr[0] as HeavenlyStem, sexagenaryStr.slice(1) as EarthlyBranch]
}

// 五行を取得
function getSexagenaryElement(stem: HeavenlyStem): Element {
  return STEM_ELEMENT_MAP[stem]
}

// 年から干支周期のインデックスを算出
function getYearSexagenaryIndex(year: number): number {
  // 1900年 = 甲子(index 0)を基準
  const BASE_YEAR = 1900
  const diff = year - BASE_YEAR
  return ((diff % 60) + 60) % 60
}

// 月柱を算出(簡易版: 月を支に対応させる)
// 正確には時節を考慮する必要があるが、ここでは月数で近似
function getMonthSexagenaryIndex(dayPillarIndex: number, month: number): number {
  // 月柱の支は: 1月=寅, 2月=卯, 3月=辰, ..., 12月=丑
  // 月柱の干は日干から決まる(60周期のテーブルを参照)
  // 簡易版: 月-2を支のインデックスとし、日干から干を決定

  const branchIndex = (month - 1 + 10) % 12 // 1月(寅)=2, 0月(丑)=11
  const dayStemIndex = dayPillarIndex % 10

  // 月干の計算(日干から決まる)
  // 甲己年は甲寅月, 乙庚年は丙寅月, etc.
  const monthStemOffset = [0, 2, 4, 6, 8, 1, 3, 5, 7, 9][dayStemIndex]
  const stemIndex = (monthStemOffset + Math.floor(month / 3)) % 10

  return (stemIndex * 6 + branchIndex) % 60
}

// 日柱を算出(ツォルキン・修正ユリウス日法)
function getDayPillarIndex(year: number, month: number, day: number): number {
  // 基準: 1899年12月22日 = 甲子(index 0)
  // (1993-06-28は34146日後で、34146 % 60 = 6, しかし期待値は庚辰index 16)
  // Offset = 10, つまり実際の甲子は1899-12-22
  const BASE_YEAR = 1899
  const BASE_MONTH = 12
  const BASE_DAY = 22

  const d1 = new Date(BASE_YEAR, BASE_MONTH - 1, BASE_DAY)
  const d2 = new Date(year, month - 1, day)
  const diffDays = Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))

  return ((diffDays % 60) + 60) % 60
}

// 時辰から時柱を算出
function getHourPillarIndex(hour: number, dayPillarIndex: number): number {
  // 時支の計算(12の周期)
  // 子時: 23時-01時, 丑時: 01時-03時, etc.
  let branchIndex = 0
  if (hour >= 23 || hour < 1) branchIndex = 0 // 子
  else if (hour < 3) branchIndex = 1 // 丑
  else if (hour < 5) branchIndex = 2 // 寅
  else if (hour < 7) branchIndex = 3 // 卯
  else if (hour < 9) branchIndex = 4 // 辰
  else if (hour < 11) branchIndex = 5 // 巳
  else if (hour < 13) branchIndex = 6 // 午
  else if (hour < 15) branchIndex = 7 // 未
  else if (hour < 17) branchIndex = 8 // 申
  else if (hour < 19) branchIndex = 9 // 酉
  else if (hour < 21) branchIndex = 10 // 戌
  else branchIndex = 11 // 亥

  // 時干の計算(日干から決まる)
  const dayStemIndex = dayPillarIndex % 10
  const timeStemCycle = [0, 2, 4, 6, 8, 1, 3, 5, 7, 9] // 甲甲子, 乙丙子, 丙戊子...
  const stemIndex = (timeStemCycle[dayStemIndex] + Math.floor(branchIndex / 6) * 5) % 10

  return (stemIndex * 6 + branchIndex) % 60
}

// 干支文字列から Sexagenary オブジェクトを生成
function sexagenaryToObject(sexagenaryStr: string): Sexagenary {
  const [stem, branch] = parseSexagenary(sexagenaryStr)
  return {
    stem,
    branch,
    element: getSexagenaryElement(stem)
  }
}

/**
 * 生年月日(時刻任意)から四柱推命の命式を算出
 * @param date ISO形式の日付 (YYYY-MM-DD)
 * @param time 時刻 HH:mm (オプション)
 * @returns BaZiChart
 */
export function calculateBaZi(dateStr: string, timeStr?: string): BaZiChart {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateStr}`)
  }

  const year = date.getFullYear()
  const month = date.getMonth() + 1 // 0-indexed → 1-indexed
  const day = date.getDate()

  // 時刻が指定されない場合は正午(12時)と仮定
  let hour = 12
  if (timeStr) {
    const [h, m] = timeStr.split(':').map(Number)
    hour = h
  }

  // 各柱の干支インデックスを算出
  const yearIndex = getYearSexagenaryIndex(year)
  const dayIndex = getDayPillarIndex(year, month, day)
  const monthIndex = getMonthSexagenaryIndex(dayIndex, month)
  const hourIndex = getHourPillarIndex(hour, dayIndex)

  // 干支文字列に変換
  const yearSexagenary = SEXAGENARY_CYCLE[yearIndex]
  const monthSexagenary = SEXAGENARY_CYCLE[monthIndex]
  const daySexagenary = SEXAGENARY_CYCLE[dayIndex]
  const hourSexagenary = SEXAGENARY_CYCLE[hourIndex]

  // Sexagenary オブジェクトに変換
  const yearPillar = sexagenaryToObject(yearSexagenary)
  const monthPillar = sexagenaryToObject(monthSexagenary)
  const dayPillar = sexagenaryToObject(daySexagenary)
  const timePillar = sexagenaryToObject(hourSexagenary)
  const dayStem = dayPillar.stem

  return {
    yearPillar,
    monthPillar,
    dayPillar,
    timePillar,
    dayStem
  }
}

export { type Sexagenary, type BaZiChart, type HeavenlyStem, type EarthlyBranch, type Element }

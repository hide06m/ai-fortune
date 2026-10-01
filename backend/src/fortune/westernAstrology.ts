/**
 * 西洋占星術（星座）計算ロジック
 * 生年月日から星座・エレメント（四元素）・モダリティ（三区分）・支配星を算出する
 * ツキ（キャラID2）専用の占術
 */

export type ZodiacSign =
  | '牡羊座' | '牡牛座' | '双子座' | '蟹座' | '獅子座' | '乙女座'
  | '天秤座' | '蠍座' | '射手座' | '山羊座' | '水瓶座' | '魚座'

export type ZodiacElement = '火' | '地' | '風' | '水'
export type ZodiacModality = '活動宮' | '不動宮' | '柔軟宮'

export interface WesternZodiac {
  sign: ZodiacSign
  element: ZodiacElement
  modality: ZodiacModality
  rulingPlanet: string
}

interface ZodiacRange {
  sign: ZodiacSign
  start: [number, number] // [月, 日]
  end: [number, number]
  element: ZodiacElement
  modality: ZodiacModality
  rulingPlanet: string
}

// 各星座の期間は必ず2つの月にまたがるため、年をまたぐ山羊座（12/22〜1/19）も
// 特別扱いせず「月===開始月かつ日>=開始日」または「月===終了月かつ日<=終了日」の
// 判定だけで一律に扱える
const ZODIAC_TABLE: ZodiacRange[] = [
  { sign: '牡羊座', start: [3, 21], end: [4, 19], element: '火', modality: '活動宮', rulingPlanet: '火星' },
  { sign: '牡牛座', start: [4, 20], end: [5, 20], element: '地', modality: '不動宮', rulingPlanet: '金星' },
  { sign: '双子座', start: [5, 21], end: [6, 21], element: '風', modality: '柔軟宮', rulingPlanet: '水星' },
  { sign: '蟹座', start: [6, 22], end: [7, 22], element: '水', modality: '活動宮', rulingPlanet: '月' },
  { sign: '獅子座', start: [7, 23], end: [8, 22], element: '火', modality: '不動宮', rulingPlanet: '太陽' },
  { sign: '乙女座', start: [8, 23], end: [9, 22], element: '地', modality: '柔軟宮', rulingPlanet: '水星' },
  { sign: '天秤座', start: [9, 23], end: [10, 23], element: '風', modality: '活動宮', rulingPlanet: '金星' },
  { sign: '蠍座', start: [10, 24], end: [11, 22], element: '水', modality: '不動宮', rulingPlanet: '冥王星' },
  { sign: '射手座', start: [11, 23], end: [12, 21], element: '火', modality: '柔軟宮', rulingPlanet: '木星' },
  { sign: '山羊座', start: [12, 22], end: [1, 19], element: '地', modality: '活動宮', rulingPlanet: '土星' },
  { sign: '水瓶座', start: [1, 20], end: [2, 18], element: '風', modality: '不動宮', rulingPlanet: '天王星' },
  { sign: '魚座', start: [2, 19], end: [3, 20], element: '水', modality: '柔軟宮', rulingPlanet: '海王星' },
]

/**
 * 生年月日から星座を算出
 * @param dateStr ISO形式の日付 (YYYY-MM-DD)
 */
export function calculateWesternZodiac(dateStr: string): WesternZodiac {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateStr}`)
  }

  const month = date.getMonth() + 1
  const day = date.getDate()

  const entry = ZODIAC_TABLE.find(({ start, end }) => {
    const [startMonth, startDay] = start
    const [endMonth, endDay] = end
    return (month === startMonth && day >= startDay) || (month === endMonth && day <= endDay)
  })

  if (!entry) {
    throw new Error(`Failed to determine zodiac sign for date: ${dateStr}`)
  }

  return {
    sign: entry.sign,
    element: entry.element,
    modality: entry.modality,
    rulingPlanet: entry.rulingPlanet,
  }
}

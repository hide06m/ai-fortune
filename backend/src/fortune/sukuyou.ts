/**
 * 宿曜占星術：生年月日から、本命宿を出す
 *
 * 新暦の生年月日を、旧暦（kyureki.ts）に直し、旧暦の月ごとの「1日の宿」から、日数ぶん進めた宿が、本命宿。
 *   本命宿 ＝ 旧暦の月の1日の宿 ＋（旧暦の日 − 1）（27宿で、ひとまわりする）
 * 閏月は、元の月と同じ番号の月として数える（流派によっては扱いが異なる）。
 * 三九の法：命宿（本命宿）、業宿（本命宿から9つ先）、胎宿（本命宿から18先）。
 */

import { toKyureki, type Kyureki } from './kyureki'
import { SHUKU_LIST, MONTH_START_SHUKU, type Shuku } from './data/sukuyouData'

export interface SukuyouResult {
  /** 生年月日（新暦） */
  birthDate: string
  /** 旧暦での生年月日 */
  kyureki: Kyureki
  /** 本命宿（命宿） */
  mei: Shuku
  /** 業宿（本命宿から9つ先） */
  gyo: Shuku
  /** 胎宿（本命宿から18先） */
  tai: Shuku
  /** 本命宿の番号（0〜26） */
  index: number
}

export function computeSukuyou(birthDate: string): SukuyouResult | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const probe = new Date(Date.UTC(y, mo - 1, d))
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null

  const kyureki = toKyureki(y, mo, d)
  const index = (MONTH_START_SHUKU[kyureki.month] + (kyureki.day - 1)) % 27
  return {
    birthDate,
    kyureki,
    mei: SHUKU_LIST[index],
    gyo: SHUKU_LIST[(index + 9) % 27],
    tai: SHUKU_LIST[(index + 18) % 27],
    index,
  }
}

/**
 * 旧暦（日本の太陰太陽暦）への変換
 *
 * 宿曜占星術は、旧暦の月と日から、本命宿を出す。そのため、新暦の生年月日を、旧暦に変換する。
 * 天文計算で、朔（新月）と、太陽の黄経（二十四節気の中気）を出して、旧暦の決まりどおりに組み立てる：
 *   ・月の始まり ＝ 朔を含む日（日本時間の日付）
 *   ・月の番号   ＝ その月に含まれる中気で決まる（雨水＝1月、春分＝2月、… 冬至＝11月、大寒＝12月）
 *   ・中気を含まない月は、閏月（直前の月の番号を引き継ぐ）
 * 計算は、Meeus『Astronomical Algorithms』の新月（第49章）と、太陽位置（第25章、低精度）による。
 * 朔の時刻は数分の精度、太陽黄経は約0.01度（時刻にして十数分）の精度。日付の境目にぴったり重なる、ごくまれな日だけ、
 * 暦の書籍と1日ずれる可能性がある。1900〜2100年を想定している。
 */

const SYNODIC = 29.530588861
const RAD = Math.PI / 180

/** グレゴリオ暦の日付 → ユリウス日（正午を整数とする日番号 JDN） */
export function jdn(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12)
  const yy = y + 4800 - a
  const mm = m + 12 * a - 3
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045
}

/** ユリウス日番号 → グレゴリオ暦の日付 */
export function fromJdn(n: number): { y: number; m: number; d: number } {
  const a = n + 32044
  const b = Math.floor((4 * a + 3) / 146097)
  const c = a - Math.floor((146097 * b) / 4)
  const d = Math.floor((4 * c + 3) / 1461)
  const e = c - Math.floor((1461 * d) / 4)
  const m = Math.floor((5 * e + 2) / 153)
  return { d: e - Math.floor((153 * m + 2) / 5) + 1, m: m + 3 - 12 * Math.floor(m / 10), y: 100 * b + d - 4800 + Math.floor(m / 10) }
}

/** ΔT（地球時と世界時の差、秒）。Espenak & Meeus の近似式（1900〜2150年） */
function deltaT(year: number): number {
  const y = year
  if (y < 1920) {
    const t = y - 1900
    return -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4
  }
  if (y < 1941) {
    const t = y - 1920
    return 21.2 + 0.84493 * t - 0.0761 * t ** 2 + 0.0020936 * t ** 3
  }
  if (y < 1961) {
    const t = y - 1950
    return 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547
  }
  if (y < 1986) {
    const t = y - 1975
    return 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718
  }
  if (y < 2005) {
    const t = y - 2000
    return 63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5
  }
  if (y < 2050) {
    const t = y - 2000
    return 62.92 + 0.32217 * t + 0.005589 * t ** 2
  }
  return -20 + 32 * ((y - 1820) / 100) ** 2 - 0.5628 * (2150 - y)
}

/** k番目の新月の、地球時（JDE） */
function newMoonJde(k: number): number {
  const T = k / 1236.85
  const jde = 2451550.09766 + SYNODIC * k + 0.00015437 * T ** 2 - 0.00000015 * T ** 3 + 0.00000000073 * T ** 4
  const E = 1 - 0.002516 * T - 0.0000074 * T ** 2
  const M = (2.5534 + 29.1053567 * k - 0.0000014 * T ** 2 - 0.00000011 * T ** 3) * RAD
  const Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T ** 2 + 0.00001238 * T ** 3 - 0.000000058 * T ** 4) * RAD
  const F = (160.7108 + 390.67050284 * k - 0.0016118 * T ** 2 - 0.00000227 * T ** 3 + 0.000000011 * T ** 4) * RAD
  const Om = (124.7746 - 1.56375588 * k + 0.0020672 * T ** 2 + 0.00000215 * T ** 3) * RAD
  const s = Math.sin
  let corr =
    -0.4072 * s(Mp) +
    0.17241 * E * s(M) +
    0.01608 * s(2 * Mp) +
    0.01039 * s(2 * F) +
    0.00739 * E * s(Mp - M) -
    0.00514 * E * s(Mp + M) +
    0.00208 * E * E * s(2 * M) -
    0.00111 * s(Mp - 2 * F) -
    0.00057 * s(Mp + 2 * F) +
    0.00056 * E * s(2 * Mp + M) -
    0.00042 * s(3 * Mp) +
    0.00042 * E * s(M + 2 * F) +
    0.00038 * E * s(M - 2 * F) -
    0.00024 * E * s(2 * Mp - M) -
    0.00017 * s(Om) -
    0.00007 * s(Mp + 2 * M) +
    0.00004 * s(2 * Mp - 2 * F) +
    0.00004 * s(3 * M) +
    0.00003 * s(Mp + M - 2 * F) +
    0.00003 * s(2 * Mp + 2 * F) -
    0.00003 * s(Mp + M + 2 * F) +
    0.00003 * s(Mp - M + 2 * F) -
    0.00002 * s(Mp - M - 2 * F) -
    0.00002 * s(3 * Mp + M) +
    0.00002 * s(4 * Mp)
  const A = [
    299.77 + 0.107408 * k - 0.009173 * T ** 2,
    251.88 + 0.016321 * k,
    251.83 + 26.651886 * k,
    349.42 + 36.412478 * k,
    84.66 + 18.206239 * k,
    141.74 + 53.303771 * k,
    207.14 + 2.453732 * k,
    154.84 + 7.30686 * k,
    34.52 + 27.261239 * k,
    207.19 + 0.121824 * k,
    291.34 + 1.844379 * k,
    161.72 + 24.198154 * k,
    239.56 + 25.513099 * k,
    331.55 + 3.592518 * k,
  ]
  const W = [0.000325, 0.000165, 0.000164, 0.000126, 0.00011, 0.000062, 0.00006, 0.000056, 0.000047, 0.000042, 0.00004, 0.000037, 0.000035, 0.000023]
  A.forEach((a, i) => {
    corr += W[i] * s(a * RAD)
  })
  return jde + corr
}

/** k番目の新月の、日本時間の日付（ユリウス日番号） */
function newMoonDay(k: number): number {
  const jde = newMoonJde(k)
  const year = fromJdn(Math.floor(jde + 0.5)).y
  const jdUt = jde - deltaT(year) / 86400
  return Math.floor(jdUt + 0.5 + 9 / 24)
}

/** 太陽の見かけの黄経（度、0〜360）。jde は地球時のユリウス日 */
function sunLongitude(jde: number): number {
  const T = (jde - 2451545) / 36525
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T ** 2
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T ** 2) * RAD
  const C = (1.914602 - 0.004817 * T - 0.000014 * T ** 2) * Math.sin(M) + (0.019993 - 0.000101 * T) * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M)
  const omega = (125.04 - 1934.136 * T) * RAD
  const lon = L0 + C - 0.00569 - 0.00478 * Math.sin(omega)
  return ((lon % 360) + 360) % 360
}

/** 日本時間の、ある日の0時の、太陽黄経 */
function sunLongitudeAtJstMidnight(day: number): number {
  const year = fromJdn(day).y
  // 日番号 day の0時（日本時間）＝ 世界時で、前日の15時 ＝ ユリウス日で day - 0.5 - 9/24
  const jdUt = day - 0.5 - 9 / 24
  return sunLongitude(jdUt + deltaT(year) / 86400)
}

export interface Kyureki {
  /** 旧暦の年（おおよそ。旧暦1月を基準に、新暦の年を当てたもの） */
  year: number
  /** 旧暦の月（1〜12。閏月も、元の月の番号） */
  month: number
  day: number
  /** 閏月か */
  isLeap: boolean
}

/** k番目の新月から始まる月に、中気（太陽黄経が30度の倍数になる時点）が含まれるか。含まれるなら、その月の番号を返す */
function monthNumberOf(k: number): number | null {
  const s0 = newMoonDay(k)
  const s1 = newMoonDay(k + 1)
  const a = sunLongitudeAtJstMidnight(s0)
  let b = sunLongitudeAtJstMidnight(s1)
  if (b < a) b += 360
  if (Math.floor(b / 30) <= Math.floor(a / 30)) return null
  const lambdaIndex = Math.floor(b / 30) % 12 // 黄経 30 × lambdaIndex 度の中気
  // 330度（雨水）＝1月、0度（春分）＝2月、…、300度（大寒）＝12月
  return ((lambdaIndex + 1) % 12) + 1
}

/** 新暦（グレゴリオ暦）の日付を、旧暦に変換する */
export function toKyureki(y: number, m: number, d: number): Kyureki {
  const day = jdn(y, m, d)
  let k = Math.round((day - 2451550.1) / SYNODIC)
  while (newMoonDay(k) > day) k--
  while (newMoonDay(k + 1) <= day) k++

  const own = monthNumberOf(k)
  let month: number
  let isLeap = false
  if (own !== null) {
    month = own
  } else {
    // 中気のない月は、閏月：直前の月の番号を引き継ぐ
    isLeap = true
    month = monthNumberOf(k - 1) ?? monthNumberOf(k - 2) ?? 1
  }
  const lunarDay = day - newMoonDay(k) + 1
  // 旧暦の年：旧暦の月が、新暦の月より、大きく後ろ（例：新暦1月なのに旧暦11・12月）なら、前の年
  const year = month >= 11 && m <= 2 ? y - 1 : month <= 2 && m >= 11 ? y + 1 : y
  return { year, month, day: lunarDay, isLeap }
}

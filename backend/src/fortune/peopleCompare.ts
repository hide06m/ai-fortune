/**
 * 縁帳：「あなたから見た、あの人（仮説）」の、恋愛タイプの比較
 * 文章は、6つの軸の、短いラベルだけ（外部の文章は使わない）
 */

import type { LoveAxis, LoveAnswer } from './loveType64.js'
import { LOVE_TYPE64_QUESTIONS } from './loveType64.js'

export const AXIS_ORDER: LoveAxis[] = ['LF', 'CA', 'PR', 'OE', 'VN', 'DI']

/** 軸ごとの、2つの向きの呼び名（先頭の文字が左、後ろの文字が右） */
export const AXIS_LABELS: Record<LoveAxis, { name: string; left: string; right: string }> = {
  LF: { name: '主導権', left: 'リードする', right: '合わせる' },
  CA: { name: '甘え方', left: '甘えたい', right: '甘えられたい' },
  PR: { name: '好きになり方', left: '気持ちで動く', right: '理想で選ぶ' },
  OE: { name: '恋の向き合い方', left: '自由・開放的', right: '一途・真剣' },
  VN: { name: '時間の軸', left: '未来を重んじる', right: '今を重んじる' },
  DI: { name: '距離感', left: '寄り添う', right: '自立・適度な距離' },
}

// 軸の文字の割り当て：LF=L/F, CA=C/A, PR=P/R, OE=O/E, VN=V/N, DI=D/I
// 文字ごとの表示は、コードの2つ目の文字（右）／1つ目（左）に対応
function labelOf(axis: LoveAxis, letter: string): string {
  const l = AXIS_LABELS[axis]
  return letter === axis[0] ? l.left : l.right
}

/** 回答に、1問でも答えのある軸 */
export function knownAxes(answers: LoveAnswer[]): LoveAxis[] {
  const answered = new Set(answers.map((a) => a.id))
  return AXIS_ORDER.filter((axis) => LOVE_TYPE64_QUESTIONS.some((q) => q.axis === axis && answered.has(q.id)))
}

export interface AxisComparison {
  axis: LoveAxis
  name: string
  mine: string
  theirs: string
  same: boolean
}

export interface Comparison {
  axes: AxisComparison[]
  sameCount: number
  total: number
  summary: string
}

/** 自分のタイプと、相手のタイプ（分かっている軸だけ）の比較 */
export function compareLoveTypes(myFullType: string, theirFullType: string, known: LoveAxis[]): Comparison {
  const mine = myFullType.replace('-', '')
  const theirs = theirFullType.replace('-', '')
  const axes: AxisComparison[] = []
  AXIS_ORDER.forEach((axis, i) => {
    if (!known.includes(axis)) return
    const m = mine[i]
    const t = theirs[i]
    if (!m || !t) return
    axes.push({ axis, name: AXIS_LABELS[axis].name, mine: labelOf(axis, m), theirs: labelOf(axis, t), same: m === t })
  })
  const sameCount = axes.filter((a) => a.same).length
  const total = axes.length
  let summary = ''
  if (total === 0) summary = ''
  else if (sameCount === total) summary = 'すべての軸で、同じ向きです。'
  else if (sameCount * 3 >= total * 2) summary = '近い向きが、多い相手です。'
  else if (sameCount * 3 >= total) summary = '重なる軸と、ちがう軸が、まざっています。'
  else summary = 'ちがう向きが、多い相手です。'
  return { axes, sameCount, total, summary }
}

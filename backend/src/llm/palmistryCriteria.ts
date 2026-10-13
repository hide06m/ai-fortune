/**
 * 手相の「判断基準」（オリジナルの整理）
 *
 * 画像から測った客観的な数値（長さ・曲がり・濃さ・途切れ・始点終点の位置）を、
 * 「この数値ならこういう傾向と読むのが一般的」という言葉に結びつける表。
 * 診断文はこの基準と測定値を根拠に書かれるので、画面にも根拠（evidence）として出せる。
 *
 * 手相は流派によって解釈が分かれる。ここでは広く知られた読み方を「傾向」として整理しており、
 * 運命や健康・寿命などの断定には使わない。基準を変えたいときは、このファイルの文言と閾値だけを直せばよい。
 */

export type PalmLineKey = 'heart' | 'head' | 'life' | 'fate' | 'simian' | 'marriage' | 'sun' | 'health'

/** フロントが測定して送ってくる値（座標は手のひらの大きさで正規化済み） */
export interface MeasuredFeatures {
  /** 線の長さ ÷ 指の付け根〜手首の長さ */
  lengthRatio: number
  /** 始点と終点の直線距離 ÷ 線の長さ（1に近いほど直線） */
  straightness: number
  /** 線らしさの平均 0〜1（濃さ・深さの目安） */
  depth: number
  /** 線らしさが十分ある部分の割合 0〜1（1に近いほど途切れがない） */
  continuity: number
  /** a: 小指側が負・親指側が正（指の付け根の幅を1とする）、d: 指の付け根0〜手首1 */
  start: { a: number; d: number }
  end: { a: number; d: number }
}

interface LineCriteria {
  label: string
  /** その線が表すとされるテーマ */
  theme: string
  /** 長さの目安（lengthRatio の境目）。[短め/標準の境, 標準/長めの境] */
  lengthBreaks: [number, number]
  longMeaning: string
  shortMeaning: string
  curvedMeaning: string
  straightMeaning: string
  deepMeaning: string
  faintMeaning: string
  brokenMeaning: string
}

const MAIN_CRITERIA: Record<'heart' | 'head' | 'life' | 'fate', LineCriteria> = {
  heart: {
    label: '感情線',
    theme: '気持ちの出し方、人との関わり方、愛情の向け方',
    lengthBreaks: [0.6, 0.85],
    longMeaning: '感情が豊かで、思いやりの範囲が広い。気持ちを表に出しやすい傾向',
    shortMeaning: '気持ちを内に収めがちで、親しい相手にだけ深く関わる傾向',
    curvedMeaning: '感情表現が豊かで、気持ちが態度や言葉に出やすい傾向',
    straightMeaning: '感情表現は落ち着いていて、冷静に距離をとる傾向',
    deepMeaning: '気持ちがはっきりしていて、好き嫌いや意思が相手に伝わりやすい傾向',
    faintMeaning: '気分が環境や相手に左右されやすく、気持ちの波を感じやすい傾向',
    brokenMeaning: '感情の切り替えが早い、または関係の変わり目を経験しやすい傾向',
  },
  head: {
    label: '頭脳線',
    theme: '考え方、判断のしかた、学び方、集中の向け方',
    lengthBreaks: [0.8, 1.15],
    longMeaning: '物事をじっくり考え、先まで見通して判断する慎重な傾向',
    shortMeaning: '要点をつかんで素早く決める、実務的で割り切りの早い傾向',
    curvedMeaning: '発想が柔軟で、想像力やひらめきを働かせて考える傾向',
    straightMeaning: '筋道を立てて現実的に考える、論理重視の傾向',
    deepMeaning: '集中力が高く、一度考え始めると深く掘り下げる傾向',
    faintMeaning: '考えが広がりやすく、状況に合わせて切り替える柔軟さの傾向',
    brokenMeaning: '関心や考え方が節目ごとに切り替わりやすい傾向',
  },
  life: {
    label: '生命線',
    theme: '活力、生活のリズム、安定感、物事への粘り（寿命を表すものではない）',
    lengthBreaks: [0.85, 1.2],
    longMeaning: '活力が長く続き、生活のリズムを保つ粘り強さがある傾向',
    shortMeaning: '力の配分に慎重で、必要な場面に集中して使う省エネ型の傾向',
    curvedMeaning: '大きな弧を描くほど、活力が外へ向かい、行動範囲が広い傾向',
    straightMeaning: '手首に向かってまっすぐなほど、堅実で変化を好みすぎない傾向',
    deepMeaning: '体力・気力の土台がしっかりしていて、立て直しが早い傾向',
    faintMeaning: '無理をせず、周囲に合わせて力を調整する繊細さの傾向',
    brokenMeaning: '生活環境や役割の転換期を経験しやすい傾向',
  },
  fate: {
    label: '運命線',
    theme: '仕事・役割の方向性、自分の軸の持ち方（無い人も多く、優劣ではない）',
    lengthBreaks: [0.6, 0.95],
    longMeaning: '目指す方向がはっきりしていて、役割に一貫して取り組む傾向',
    shortMeaning: '状況に合わせて役割を選び、柔軟に道筋を作っていく傾向',
    curvedMeaning: '進む道を状況に応じて調整しながら歩む傾向',
    straightMeaning: '一つの方向にまっすぐ進む、軸のぶれにくい傾向',
    deepMeaning: '自分の役割や目標への意識が強い傾向',
    faintMeaning: '決まった型にとらわれず、自分のペースで道を作る傾向',
    brokenMeaning: '転機やキャリアの切り替えを経験しやすい傾向',
  },
}

// 確実に検出できたときだけ使う線（基本の4本と同じ形式）
const SIMIAN_CRITERIA: LineCriteria = {
  label: 'ますかけ線',
  theme: '感情と思考が一体で働く傾向（感情線と頭脳線が1本にまとまって手のひらを横切る、持つ人の少ない線）',
  lengthBreaks: [0.9, 1.3],
  longMeaning: '気持ちと考えが分かれにくく、物事に一途に打ち込む傾向',
  shortMeaning: '',
  curvedMeaning: '',
  straightMeaning: '',
  deepMeaning: '集中力が強く、決めたことをやり抜く意志の傾向',
  faintMeaning: '',
  brokenMeaning: '',
}
const MARRIAGE_CRITERIA: LineCriteria = {
  label: '結婚線',
  theme: '親しいパートナーシップへの向き合い方（本数や長さは、関係の数や期間を断定するものではない）',
  lengthBreaks: [0.12, 0.3],
  longMeaning: '一人の相手との関係をじっくり育てる傾向',
  shortMeaning: '関係を気負わず、自然な流れに任せる傾向',
  curvedMeaning: '',
  straightMeaning: '',
  deepMeaning: 'パートナーシップへの意識がはっきりしている傾向',
  faintMeaning: '',
  brokenMeaning: '',
}
const SUN_CRITERIA: LineCriteria = {
  label: '太陽線',
  theme: '才能が人から見える形になること、周囲からの評価との縁',
  lengthBreaks: [0.4, 0.7],
  longMeaning: '持ち味が周囲に伝わりやすく、評価を得やすい傾向',
  shortMeaning: '評価より、自分の納得を大切にして取り組む傾向',
  curvedMeaning: '',
  straightMeaning: '一つの持ち味を軸に、ぶれずに磨いていく傾向',
  deepMeaning: '自分の強みや魅力を自覚していて、表に出す力の傾向',
  faintMeaning: '',
  brokenMeaning: '',
}
const HEALTH_CRITERIA: LineCriteria = {
  label: '健康線',
  theme: '生活リズムの整え方、ストレスとの付き合い方（体調や病気を診断するものではない）',
  lengthBreaks: [0.45, 0.8],
  longMeaning: '生活のリズムを意識して整えようとする傾向',
  shortMeaning: '細かいことに縛られず、のびのび過ごす傾向',
  curvedMeaning: '',
  straightMeaning: '',
  deepMeaning: '心身の状態に敏感で、調子を自分でつかみやすい傾向',
  faintMeaning: '',
  brokenMeaning: '',
}

export const LINE_CRITERIA: Record<PalmLineKey, LineCriteria> = {
  ...MAIN_CRITERIA,
  simian: SIMIAN_CRITERIA,
  marriage: MARRIAGE_CRITERIA,
  sun: SUN_CRITERIA,
  health: HEALTH_CRITERIA,
}

/** 測定値を言葉に直す（画面の根拠表示と、診断文の材料に使う） */
export function describeFeatures(id: PalmLineKey, f: MeasuredFeatures): { evidence: string[]; tendencies: string[] } {
  const c = LINE_CRITERIA[id]
  const evidence: string[] = []
  const tendencies: string[] = []
  const addTendency = (t: string) => {
    if (t) tendencies.push(t)
  }

  if (id === 'simian') {
    evidence.push('形：感情線と頭脳線が1本にまとまり、手のひらを横切っている')
    if (f.depth >= 0.65) evidence.push('濃さ：はっきりと濃い')
    addTendency(c.longMeaning)
    if (f.depth >= 0.65) addTendency(c.deepMeaning)
    return { evidence, tendencies }
  }

  // 長さ
  const [shortBreak, longBreak] = c.lengthBreaks
  const lengthPct = Math.round(f.lengthRatio * 100)
  if (f.lengthRatio < shortBreak) {
    evidence.push(`長さ：短め（指の付け根〜手首の約${lengthPct}％）`)
    addTendency(c.shortMeaning)
  } else if (f.lengthRatio > longBreak) {
    evidence.push(`長さ：長め（指の付け根〜手首の約${lengthPct}％）`)
    addTendency(c.longMeaning)
  } else {
    evidence.push(`長さ：標準的（指の付け根〜手首の約${lengthPct}％）`)
  }

  // 曲がり
  if (f.straightness < 0.75) {
    evidence.push('形：大きく曲がっている')
    addTendency(c.curvedMeaning)
  } else if (f.straightness > 0.9) {
    evidence.push('形：まっすぐに近い')
    addTendency(c.straightMeaning)
  } else {
    evidence.push('形：ゆるやかなカーブ')
  }

  // 濃さ・深さ
  if (f.depth >= 0.65) {
    evidence.push('濃さ：はっきりと濃い')
    addTendency(c.deepMeaning)
  } else if (f.depth < 0.4) {
    evidence.push('濃さ：薄め')
    addTendency(c.faintMeaning)
  } else {
    evidence.push('濃さ：標準的')
  }

  // 途切れ
  if (f.continuity < 0.8) {
    evidence.push('連続性：途切れ・かすれがある')
    addTendency(c.brokenMeaning)
  } else {
    evidence.push('連続性：ほぼ途切れなく続いている')
  }

  // 位置（線ごとに意味のある端だけ）
  if (id === 'heart') {
    // 終点の位置：a>0.15 は人差し指側、-0.15〜0.15 は中指の付け根あたり、それより小指側は短い
    if (f.end.a > 0.15) {
      evidence.push('終点：人差し指の付け根の下あたり')
      tendencies.push('理想や信頼を大切にし、相手に誠実さを求めやすい傾向')
    } else if (f.end.a > -0.15) {
      evidence.push('終点：中指の付け根の下あたり')
      tendencies.push('自分の気持ちや基準を軸に関係を築く傾向')
    } else {
      evidence.push('終点：薬指〜小指側に寄っている')
    }
  }
  if (id === 'head') {
    if (f.end.d > 0.55) {
      evidence.push('終点：手のひらの下の方まで伸びている')
      tendencies.push('想像力や内省に向かう思考の傾向')
    }
  }

  return { evidence, tendencies }
}

/** プロンプトに差し込む判断基準。検出できた線についてだけ書く（検出できなかった線の説明は渡さない） */
export function criteriaPromptBlock(keys: PalmLineKey[]): string {
  const pair = (a: string, b: string, la: string, lb: string) => [a && `${la}：${a}`, b && `${lb}：${b}`].filter(Boolean).join('／')
  const parts: string[] = []
  for (const key of keys) {
    const c = LINE_CRITERIA[key]
    const rows = [
      pair(c.longMeaning, c.shortMeaning, '長い', '短い'),
      pair(c.curvedMeaning, c.straightMeaning, '曲がりが大きい', 'まっすぐ'),
      pair(c.deepMeaning, c.faintMeaning, '濃い', '薄い'),
      c.brokenMeaning && `途切れ：${c.brokenMeaning}`,
    ].filter(Boolean)
    parts.push(`- **${c.label}**（${c.theme}）\n` + rows.map((r) => `  ${r}`).join('\n'))
  }
  return parts.join('\n')
}

/**
 * 姓名判断（五格・三才）
 *
 * 画数の数え方：旧字体（康熙字典の字体）で、部首は元の形の画数で数える流儀（熊崎式で、広く使われる）。
 * 画数の表は、Unicode の Unihan データから作ったもの（backend/scripts/build-kangxi-strokes.cjs）。
 * 表の値と流派が合わない字は、STROKE_OVERRIDES で直せる。
 *
 * 五格：
 *   天格 ＝ 姓の画数の合計（姓が1字なら、霊数1を足す）… 先祖・家系から受け継ぐ運
 *   人格 ＝ 姓の最後の字 ＋ 名の最初の字 … 性格・中心となる運（主運）
 *   地格 ＝ 名の画数の合計（名が1字なら、霊数1を足す）… 幼少〜青年期の運・土台
 *   外格 ＝ 天格 ＋ 地格 − 人格 … 対人・社会との関わりの運
 *   総格 ＝ 姓名すべての画数の合計 … 人生全体・晩年の運
 * 三才：天格・人格・地格の1の位から五行（木火土金水）を出し、隣り合う五行の関係（相生・比和・相剋）を見る。
 */

import strokeTable from './data/kangxiStrokes.json'
import { seimeiNumberOf, normalizeStrokeNumber, type SeimeiNumber } from './data/seimeiNumbers'

/** 表の値と、流派や好みが合わない字の画数を、ここで直す（例： '郎': 10 ） */
export const STROKE_OVERRIDES: Record<string, number> = {}

const STROKES: Record<string, number> = strokeTable as Record<string, number>

// かな（ひらがな・カタカナ）の画数。濁点は +2、半濁点は +1
const KANA_STROKES: Record<string, number> = {}
function addKana(chars: string, strokes: number[]) {
  const arr = [...chars]
  arr.forEach((c, i) => {
    KANA_STROKES[c] = strokes[i]
  })
}
addKana('あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん', [3, 2, 2, 2, 3, 3, 4, 1, 3, 2, 3, 1, 2, 3, 1, 4, 2, 1, 1, 2, 4, 3, 2, 2, 1, 3, 1, 4, 1, 4, 3, 2, 3, 2, 3, 3, 2, 2, 2, 2, 1, 2, 1, 2, 3, 1])
addKana('ぁぃぅぇぉっゃゅょゎ', [3, 2, 2, 2, 3, 1, 3, 2, 2, 2])
addKana('アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン', [2, 2, 3, 3, 3, 2, 3, 2, 3, 2, 3, 3, 2, 2, 2, 3, 3, 3, 3, 2, 2, 2, 4, 1, 2, 2, 1, 1, 4, 2, 3, 2, 2, 3, 2, 2, 3, 2, 2, 1, 3, 2, 3, 2])
addKana('ァィゥェォッャュョヮヴ', [2, 2, 3, 3, 3, 3, 2, 2, 3, 2, 5])
KANA_STROKES['ー'] = 1

const DAKUTEN = 'がぎぐげござじずぜぞだぢづでどばびぶべぼガギグゲゴザジズゼゾダヂヅデドバビブベボ'
const DAKUTEN_BASE = 'かきくけこさしすせそたちつてとはひふへほカキクケコサシスセソタチツテトハヒフヘホ'
const HANDAKUTEN = 'ぱぴぷぺぽパピプペポ'
const HANDAKUTEN_BASE = 'はひふへほハヒフヘホ'

export type StrokeResult = { ok: true; strokes: number } | { ok: false }

/** 1文字の画数。`prev` は、直前の字の画数（「々」は、直前の字と同じ画数として数える） */
export function strokesOfChar(ch: string, prev: number | null): StrokeResult {
  if (ch in STROKE_OVERRIDES) return { ok: true, strokes: STROKE_OVERRIDES[ch] }
  if (ch === '々') return prev !== null ? { ok: true, strokes: prev } : { ok: false }
  const di = DAKUTEN.indexOf(ch)
  if (di >= 0) return { ok: true, strokes: KANA_STROKES[DAKUTEN_BASE[di]] + 2 }
  const hi = HANDAKUTEN.indexOf(ch)
  if (hi >= 0) return { ok: true, strokes: KANA_STROKES[HANDAKUTEN_BASE[hi]] + 1 }
  if (ch in KANA_STROKES) return { ok: true, strokes: KANA_STROKES[ch] }
  if (ch in STROKES) return { ok: true, strokes: STROKES[ch] }
  return { ok: false }
}

export interface NameChar {
  char: string
  strokes: number
}

export type NameStrokeResult = { ok: true; chars: NameChar[] } | { ok: false; unknown: string[] }

/** 名前（姓または名）の各字の画数を出す。空白は取り除く。表にない字があれば、その字の一覧を返す */
export function strokesOfName(name: string): NameStrokeResult {
  const chars: NameChar[] = []
  const unknown: string[] = []
  let prev: number | null = null
  for (const ch of [...name.replace(/[\s　]/g, '')]) {
    const r = strokesOfChar(ch, prev)
    if (r.ok) {
      chars.push({ char: ch, strokes: r.strokes })
      prev = r.strokes
    } else {
      unknown.push(ch)
      prev = null
    }
  }
  return unknown.length > 0 ? { ok: false, unknown } : { ok: true, chars }
}

export type Element = '木' | '火' | '土' | '金' | '水'

/** 画数の1の位から、五行を出す（1・2＝木、3・4＝火、5・6＝土、7・8＝金、9・0＝水） */
export function elementOf(n: number): Element {
  const d = normalizeStrokeNumber(n) % 10
  if (d === 1 || d === 2) return '木'
  if (d === 3 || d === 4) return '火'
  if (d === 5 || d === 6) return '土'
  if (d === 7 || d === 8) return '金'
  return '水'
}

const GENERATES: Record<Element, Element> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' } // 相生
const OVERCOMES: Record<Element, Element> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' } // 相剋

export type ElementRelation = '相生' | '比和' | '相剋'

export function relationOf(a: Element, b: Element): ElementRelation {
  if (a === b) return '比和'
  if (GENERATES[a] === b || GENERATES[b] === a) return '相生'
  if (OVERCOMES[a] === b || OVERCOMES[b] === a) return '相剋'
  return '相剋'
}

export type KakuKey = 'ten' | 'jin' | 'chi' | 'gai' | 'so'

export interface Kaku extends SeimeiNumber {
  key: KakuKey
  label: string
  /** 何を表す格か */
  meaning: string
  strokes: number
  element: Element
}

export interface SeimeiResult {
  surname: NameChar[]
  givenName: NameChar[]
  kaku: Kaku[]
  /** 三才配置（天格・人格・地格の五行） */
  sansai: {
    elements: [Element, Element, Element]
    tenJin: ElementRelation
    jinChi: ElementRelation
  }
}

const KAKU_META: Record<KakuKey, { label: string; meaning: string }> = {
  ten: { label: '天格', meaning: '先祖・家系から受け継ぐ運' },
  jin: { label: '人格', meaning: '性格と、人生の中心になる運（主運）' },
  chi: { label: '地格', meaning: '幼少期から青年期の運と、人生の土台' },
  gai: { label: '外格', meaning: '対人関係や、社会とのつながりの運' },
  so: { label: '総格', meaning: '人生全体の運と、中年から晩年の運' },
}

export function computeSeimei(surname: NameChar[], givenName: NameChar[]): SeimeiResult {
  const sum = (cs: NameChar[]) => cs.reduce((s, c) => s + c.strokes, 0)
  const surnameTotal = sum(surname)
  const givenTotal = sum(givenName)
  const ten = surnameTotal + (surname.length === 1 ? 1 : 0)
  const jin = surname[surname.length - 1].strokes + givenName[0].strokes
  const chi = givenTotal + (givenName.length === 1 ? 1 : 0)
  const so = surnameTotal + givenTotal
  const gai = ten + chi - jin

  const make = (key: KakuKey, strokes: number): Kaku => ({
    key,
    ...KAKU_META[key],
    strokes,
    element: elementOf(strokes),
    ...seimeiNumberOf(strokes),
  })
  const kaku = [make('ten', ten), make('jin', jin), make('chi', chi), make('gai', gai), make('so', so)]
  const elements: [Element, Element, Element] = [elementOf(ten), elementOf(jin), elementOf(chi)]
  return {
    surname,
    givenName,
    kaku,
    sansai: { elements, tenJin: relationOf(elements[0], elements[1]), jinChi: relationOf(elements[1], elements[2]) },
  }
}

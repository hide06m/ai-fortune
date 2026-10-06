/**
 * 手相の各線の「定義」
 *
 * 各線について、先に次の前提を決めておき、その前提に合う線だけを採用する：
 *   - どこから始まり、どこへ向かうか（始点・終点の位置、進む向き）
 *   - どの範囲を通るか（探索範囲）
 *   - 線として十分か（長さ・濃さ・連続性）
 * 写真に見えるしわを先に拾って名前を付けるのではなく、定義に合うしわを探す。
 * 定義に合わなければ、その線は結果に含めない（確実に検出できたものだけを使う）。
 *
 * すべて手の座標系 (a, d) の単位で書く（palmGeometry 参照）：
 *   a：小指側が負・親指側が正（人差し指の付け根≒+0.5、小指の付け根≒-0.5）
 *   d：指の付け根が0、手首が約1
 *
 * 基本の4本の範囲は、利用者が6枚のサンプルに描いた正解の線を (a, d) に直し、その範囲に余裕を足して決めた。
 * 正解が増えたら、dev の /palm-lab の「正解の手の座標」を見て、ここを更新する。
 */

import { CANON_A_MIN, CANON_D_MIN, CANON_H, CANON_SCALE, CANON_W, fromCanon, type HandFrame } from './palmGeometry';
import { findPathBetween, findSeam, type SeamResult, type SeamSpec } from './palmSeam';
import type { Pt } from './palmLines';

export type LineId = 'heart' | 'head' | 'life' | 'fate' | 'simian' | 'marriage' | 'sun' | 'health';

/** main: 手相の基本の4本。strict: 確実に検出できたときだけ使う（見つからなければ何も言わず省く） */
export type LineTier = 'main' | 'strict';

export interface LineModel {
  id: LineId;
  tier: LineTier;
  /** 標準の手のひら画像の「線らしさ」から、定義の範囲内で最も線らしい道筋を探す */
  find: (ridge: Float32Array) => SeamResult | null;
  /** 検出結果が、定義（始点・終点の位置、長さ、濃さ、連続性）を満たすか */
  accept: (r: SeamResult) => boolean;
  /** 線の「始点」が find の返す道筋の末尾側にあるか（結果の点を、始点→終点の順に並べるために使う） */
  startAtHigh: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const px = (a: number) => (a - CANON_A_MIN) * CANON_SCALE;
const py = (d: number) => (d - CANON_D_MIN) * CANON_SCALE;
const aOfX = (x: number) => x / CANON_SCALE + CANON_A_MIN;
const dOfY = (y: number) => y / CANON_SCALE + CANON_D_MIN;

/** 折れ線（x昇順の点列）で表した曲線の、xでの値（範囲外は端の値） */
function piecewise(points: Array<[number, number]>, x: number): number {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (x <= points[i][0]) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      return lerp(y0, y1, (x - x0) / (x1 - x0));
    }
  }
  return points[points.length - 1][1];
}

/** 多角形の内外判定（レイキャスティング） */
function pointInPolygon(x: number, y: number, poly: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** 標準の手のひら画像上の経路の、(a, d) での範囲 */
function extent(path: Pt[]) {
  let aMin = Infinity;
  let aMax = -Infinity;
  let dMin = Infinity;
  let dMax = -Infinity;
  for (const p of path) {
    const { a, d } = fromCanon(p);
    aMin = Math.min(aMin, a);
    aMax = Math.max(aMax, a);
    dMin = Math.min(dMin, d);
    dMax = Math.max(dMax, d);
  }
  return { aMin, aMax, dMin, dMax, aSpan: aMax - aMin, dSpan: dMax - dMin };
}

const seamFinder = (spec: SeamSpec) => (ridge: Float32Array) => findSeam(ridge, CANON_W, CANON_H, spec);

/** 通常の4本は線らしさ 0.4 以上、strict は 0.55 以上を求める */
const MAIN_MEAN = 0.3;
const MAIN_COVERAGE = 0.5;
const STRICT_MEAN = 0.55;
const STRICT_COVERAGE = 0.8;

/**
 * 感情線：小指側の縁から、中指の付け根の下あたりまで、手のひらの上部を横に進み、指の付け根の方へ少し上がる
 * 正解の範囲：d は小指側で 0.09〜0.24、a=0 で 0.01〜0.14、a=0.3 で -0.17〜0.03
 */
export function buildHeartModel(_h: HandFrame): LineModel {
  const from = -0.85;
  const to = 0.45;
  const lo: Array<[number, number]> = [[-0.9, 0.05], [-0.4, 0.05], [-0.2, 0.03], [0, -0.04], [0.2, -0.13], [0.4, -0.22]];
  const hi: Array<[number, number]> = [[-0.9, 0.29], [-0.3, 0.29], [-0.1, 0.23], [0.1, 0.15], [0.3, 0.1], [0.5, 0.08]];
  return {
    id: 'heart',
    tier: 'main',
    startAtHigh: false,
    find: seamFinder({
      axis: 'x',
      from: px(from),
      to: px(to),
      range: (x) => [py(piecewise(lo, aOfX(x))), py(piecewise(hi, aOfX(x)))],
      tau: 0.25,
    }),
    accept: (r) => {
      const e = extent(r.path);
      return e.aMin <= -0.5 && e.aMax >= 0.0 && e.aSpan >= 0.6 && r.meanRidge >= MAIN_MEAN && r.coverage >= MAIN_COVERAGE;
    },
  };
}

/**
 * 頭脳線：親指側（感情線の親指側の端の少し下）から、手のひらの中ほどを小指側へ横切り、少し下がる
 * 正解の範囲：d は a=0.5 で 0.10〜0.19、a=0 で 0.18〜0.27、a=-0.4 で 0.27〜0.46
 * 頭脳線は感情線より下にある。感情線が見つかっていれば、その少し下より上は探さない
 */
export function buildHeadModel(_h: HandFrame, heartPath?: Pt[]): LineModel {
  const from = -0.65;
  const to = 0.75;
  const lo: Array<[number, number]> = [[-0.7, 0.4], [-0.5, 0.34], [-0.4, 0.2], [-0.2, 0.16], [0, 0.11], [0.2, 0.06], [0.5, 0.04], [0.8, 0.07]];
  const hi: Array<[number, number]> = [[-0.7, 0.6], [-0.5, 0.54], [-0.4, 0.52], [-0.2, 0.43], [0, 0.33], [0.2, 0.31], [0.4, 0.29], [0.8, 0.25]];
  const heart = heartPath?.map(fromCanon).sort((p, q) => p.a - q.a);
  const heartD = (a: number): number | null => {
    if (!heart || heart.length === 0 || a < heart[0].a || a > heart[heart.length - 1].a) return null;
    let best = heart[0];
    for (const p of heart) if (Math.abs(p.a - a) < Math.abs(best.a - a)) best = p;
    return best.d;
  };
  return {
    id: 'head',
    tier: 'main',
    startAtHigh: true,
    find: seamFinder({
      axis: 'x',
      from: px(from),
      to: px(to),
      range: (x) => {
        const a = aOfX(x);
        let low = piecewise(lo, a);
        const hd = heartD(a);
        if (hd !== null) low = Math.max(low, hd + 0.06);
        return [py(low), py(piecewise(hi, a))];
      },
      tau: 0.25,
    }),
    accept: (r) => {
      const e = extent(r.path);
      return e.aMax >= 0.2 && e.aMin <= -0.1 && e.aSpan >= 0.45 && r.meanRidge >= MAIN_MEAN && r.coverage >= MAIN_COVERAGE;
    },
  };
}

/**
 * 生命線：親指と人差し指の間（指の付け根のあたり）から、手のひらの中央寄りを下り、手首の方へ弧を描く。
 * 上の部分は、親指側から中央へ向かって斜めに横切る（縦横どちらか一方向には進まない）ので、
 * 始点の領域から終点の領域まで、正解の範囲の帯の中で、最も線らしい道筋を探す。
 * 正解の範囲：始 a≈0.4〜0.7・d≈-0.1〜0.3 → 中ほど a≈-0.15〜0.06（d 0.4〜0.8）→ 終 a≈0.05〜0.3・d≈0.9〜1.1
 */
export function buildLifeModel(): LineModel {
  const corridor: Array<[number, number]> = [
    [0.72, -0.12], [0.8, 0.2], [0.8, 0.36], [0.16, 0.42], [0.12, 0.82], [0.42, 0.92], [0.42, 1.14], [-0.22, 1.14],
    [-0.28, 0.8], [-0.22, 0.4], [-0.06, 0.24], [0.18, 0.08], [0.34, -0.12],
  ];
  return {
    id: 'life',
    tier: 'main',
    startAtHigh: false,
    find: (ridge) =>
      findPathBetween(ridge, CANON_W, CANON_H, {
        inside: (x, y) => pointInPolygon(aOfX(x), dOfY(y), corridor),
        isStart: (x, y) => {
          const a = aOfX(x);
          const d = dOfY(y);
          return a >= 0.35 && a <= 0.75 && d >= -0.12 && d <= 0.3;
        },
        isEnd: (x, y) => {
          const a = aOfX(x);
          const d = dOfY(y);
          return a >= -0.05 && a <= 0.42 && d >= 0.85 && d <= 1.12;
        },
      }),
    accept: (r) => {
      const e = extent(r.path);
      return e.dMin <= 0.32 && e.dMax >= 0.85 && e.dSpan >= 0.55 && r.meanRidge >= 0.3 && r.coverage >= 0.45;
    },
  };
}

/**
 * 運命線：手のひらの中ほどから手首へ、小指側へ向かってゆるやかに斜めに進む（薬指寄り）。無い人も多いので、基準は厳しめ
 * 正解の範囲：a は d=0.3 で -0.08〜0.02、d=0.6 で -0.31〜-0.12、d=0.8 で -0.48〜-0.17
 */
export function buildFateModel(): LineModel {
  const center: Array<[number, number]> = [[0.2, 0.04], [0.3, -0.03], [0.5, -0.15], [0.7, -0.25], [0.9, -0.28], [1.1, -0.2]];
  return {
    id: 'fate',
    tier: 'main',
    startAtHigh: true,
    find: seamFinder({
      axis: 'y',
      from: py(0.2),
      to: py(1.12),
      range: (y) => {
        const c = piecewise(center, dOfY(y));
        return [px(c - 0.14), px(c + 0.14)];
      },
      tau: 0.3,
    }),
    accept: (r) => {
      const e = extent(r.path);
      return e.dSpan >= 0.35 && e.aSpan <= 0.4 && e.dMin <= 0.55 && e.dMax >= 0.75 && r.meanRidge >= 0.35 && r.coverage >= 0.55;
    },
  };
}

export function buildMainModels(h: HandFrame, heartPath?: Pt[]): Record<'heart' | 'head' | 'life' | 'fate', LineModel> {
  return { heart: buildHeartModel(h), head: buildHeadModel(h, heartPath), life: buildLifeModel(), fate: buildFateModel() };
}

export function buildStrictModels(h: HandFrame): Record<'sun' | 'health' | 'marriage', LineModel> {
  const { aMiddle, aRing, aPinky } = h.refs;

  // 太陽線：手のひらの下の方から、薬指の付け根の方向へ縦に進み、指の付け根の近くまで届く
  const sun: LineModel = {
    id: 'sun',
    tier: 'strict',
    startAtHigh: true,
    find: seamFinder({
      axis: 'y',
      from: py(0.0),
      to: py(0.95),
      range: () => [px(aRing - 0.14), px(aRing + 0.1)],
      tau: 0.35,
    }),
    accept: (r) => {
      const e = extent(r.path);
      return e.dSpan >= 0.3 && e.aSpan <= 0.25 && e.dMin <= 0.2 && r.meanRidge >= STRICT_MEAN && r.coverage >= STRICT_COVERAGE;
    },
  };

  // 健康線：手首の近くから、小指の付け根の方向へ斜めに進む
  const healthCenter = (d: number) => lerp(aPinky + 0.05, aMiddle, clamp((d - 0.25) / 0.75, 0, 1));
  const health: LineModel = {
    id: 'health',
    tier: 'strict',
    startAtHigh: true,
    find: seamFinder({
      axis: 'y',
      from: py(0.25),
      to: py(1.0),
      range: (y) => {
        const c = healthCenter(dOfY(y));
        return [px(c - 0.14), px(c + 0.14)];
      },
      tau: 0.35,
    }),
    accept: (r) => {
      const e = extent(r.path);
      return e.dSpan >= 0.35 && e.dMin <= 0.45 && e.dMax >= 0.7 && r.meanRidge >= STRICT_MEAN && r.coverage >= STRICT_COVERAGE;
    },
  };

  // 結婚線：小指側の端、小指の付け根と感情線の間にある短い横線
  const marriage: LineModel = {
    id: 'marriage',
    tier: 'strict',
    startAtHigh: true,
    find: seamFinder({
      axis: 'x',
      from: px(aPinky - 0.2),
      to: px(aPinky + 0.15),
      range: () => [py(0.04), py(0.2)],
      tau: 0.4,
    }),
    accept: (r) => {
      const e = extent(r.path);
      return e.aSpan >= 0.12 && e.aSpan <= 0.45 && r.meanRidge >= 0.65 && r.coverage >= 0.85;
    },
  };

  return { sun, health, marriage };
}

/**
 * ますかけ線の判定用：感情線と頭脳線が1本にまとまって、手のひらを横切る線。
 * 横切る1本の強い線があり、その線を除くと感情線も頭脳線も別に見つからないときだけ成立する。
 * 親指側の端が、感情線のように指の付け根へ上がらず、頭脳線の高さ（d≥0.12）にあることを条件にする
 */
export function buildSimianTransverse(): LineModel {
  const from = -0.85;
  const to = 0.6;
  return {
    id: 'simian',
    tier: 'strict',
    startAtHigh: false,
    find: seamFinder({
      axis: 'x',
      from: px(from),
      to: px(to),
      range: () => [py(0.1), py(0.45)],
      tau: 0.35,
    }),
    accept: (r) => {
      const e = extent(r.path);
      const first = fromCanon(r.path[0]);
      const last = fromCanon(r.path[r.path.length - 1]);
      return e.aSpan >= 1.0 && first.d <= 0.36 && last.d >= 0.12 && r.meanRidge >= 0.6 && r.coverage >= 0.85;
    },
  };
}

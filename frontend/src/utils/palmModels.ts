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
 */

import { CANON_A_MIN, CANON_D_MIN, CANON_SCALE, fromCanon, toCanon, type HandFrame } from './palmGeometry';
import type { SeamResult, SeamSpec } from './palmSeam';

export type LineId = 'heart' | 'head' | 'life' | 'fate' | 'simian' | 'marriage' | 'sun' | 'health';

/** main: 手相の基本の4本。strict: 確実に検出できたときだけ使う（見つからなければ何も言わず省く） */
export type LineTier = 'main' | 'strict';

export interface LineModel {
  id: LineId;
  tier: LineTier;
  spec: SeamSpec;
  /** 検出結果が、定義（始点・終点の位置、長さ、濃さ、連続性）を満たすか */
  accept: (r: SeamResult) => boolean;
  /** 線の「始点」が progress の大きい側にあるか（結果の点を、始点→終点の順に並べるために使う） */
  startAtHigh: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const px = (a: number) => (a - CANON_A_MIN) * CANON_SCALE;
const py = (d: number) => (d - CANON_D_MIN) * CANON_SCALE;

/** 標準の手のひら画像上の経路の、(a, d) での範囲 */
function extent(path: { x: number; y: number }[]) {
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

/** 通常の4本は線らしさ 0.4 以上、strict は 0.55 以上を求める */
const MAIN_MEAN = 0.4;
const MAIN_COVERAGE = 0.65;
const STRICT_MEAN = 0.55;
const STRICT_COVERAGE = 0.8;

export function buildMainModels(h: HandFrame): Record<'heart' | 'head' | 'life' | 'fate', LineModel> {
  const { aIndex, aMiddle, aRing, aPinky } = h.refs;

  // 感情線：小指側の端から、人差し指〜中指の付け根の方向へ、手のひらの上部を横に進む
  const heartFrom = aPinky - 0.12;
  const heartTo = aIndex + 0.05;
  const heart: LineModel = {
    id: 'heart',
    tier: 'main',
    startAtHigh: false,
    spec: {
      axis: 'x',
      from: px(heartFrom),
      to: px(heartTo),
      range: (x) => {
        const a = x / CANON_SCALE + CANON_A_MIN;
        const f = clamp((a - heartFrom) / (heartTo - heartFrom), 0, 1); // 0: 小指側の端 → 1: 人差し指側
        return [py(0.04), py(lerp(0.34, 0.24, f))];
      },
      tau: 0.25,
    },
    accept: (r) => {
      const e = extent(r.path);
      return e.aMin <= aPinky + 0.2 && e.aMax >= aMiddle - 0.1 && e.aSpan >= 0.7 && r.meanRidge >= MAIN_MEAN && r.coverage >= MAIN_COVERAGE;
    },
  };

  // 頭脳線：親指と人差し指の間（親指側）から、手のひらの中ほどを小指側へ横切る
  const headFrom = aPinky + 0.05;
  const headTo = aIndex + 0.25;
  const head: LineModel = {
    id: 'head',
    tier: 'main',
    startAtHigh: true,
    spec: {
      axis: 'x',
      from: px(headFrom),
      to: px(headTo),
      range: (x) => {
        const a = x / CANON_SCALE + CANON_A_MIN;
        const f = clamp((a - headFrom) / (headTo - headFrom), 0, 1); // 0: 小指側 → 1: 親指側
        return [py(lerp(0.34, 0.18, f)), py(lerp(0.74, 0.5, f))];
      },
      tau: 0.25,
    },
    accept: (r) => {
      const e = extent(r.path);
      // 親指側から始まり、少なくとも薬指の下あたりまで手のひらを横切ること（親指と人差し指の間の短いしわを、頭脳線としない）
      return e.aMax >= aIndex - 0.1 && e.aMin <= aRing + 0.05 && e.aSpan >= 0.65 && r.meanRidge >= MAIN_MEAN && r.coverage >= MAIN_COVERAGE;
    },
  };

  // 生命線：親指と人差し指の間から、親指の付け根を囲んで、手首の方向へ弧を描く
  const life: LineModel = {
    id: 'life',
    tier: 'main',
    startAtHigh: false,
    spec: {
      axis: 'y',
      from: py(0.25),
      to: py(1.15),
      range: (y) => {
        const d = y / CANON_SCALE + CANON_D_MIN;
        const lo = 0.25 - 0.3 * clamp((d - 0.7) / 0.4, 0, 1);
        const hi = 1.05 - 0.45 * clamp((d - 0.8) / 0.4, 0, 1);
        return [px(lo), px(hi)];
      },
      tau: 0.25,
    },
    accept: (r) => {
      const e = extent(r.path);
      return e.dMin <= 0.55 && e.dMax >= 0.85 && e.dSpan >= 0.5 && r.meanRidge >= MAIN_MEAN && r.coverage >= MAIN_COVERAGE;
    },
  };

  // 運命線：手首の付近から、中指の付け根の方向へ縦に進む（無い人も多いので、基準は厳しめ）
  const fate: LineModel = {
    id: 'fate',
    tier: 'main',
    startAtHigh: true,
    spec: {
      axis: 'y',
      from: py(0.15),
      to: py(1.1),
      range: () => [px(aMiddle - 0.3), px(aMiddle + 0.2)],
      tau: 0.3,
    },
    accept: (r) => {
      const e = extent(r.path);
      // 運命線は縦にまっすぐ進む線。弧を描く線（生命線の一部）や横に流れる線は、運命線としない
      return e.dSpan >= 0.45 && e.aSpan <= 0.3 && e.dMin <= 0.55 && e.dMax >= 0.6 && r.meanRidge >= 0.5 && r.coverage >= 0.75;
    },
  };

  return { heart, head, life, fate };
}

export function buildStrictModels(h: HandFrame): Record<'sun' | 'health' | 'marriage', LineModel> {
  const { aMiddle, aRing, aPinky } = h.refs;

  // 太陽線：手のひらの下の方から、薬指の付け根の方向へ縦に進む
  const sun: LineModel = {
    id: 'sun',
    tier: 'strict',
    startAtHigh: true,
    spec: {
      axis: 'y',
      from: py(0.1),
      to: py(0.95),
      range: () => [px(aRing - 0.14), px(aRing + 0.1)],
      tau: 0.35,
    },
    accept: (r) => {
      const e = extent(r.path);
      return e.dSpan >= 0.3 && e.aSpan <= 0.25 && e.dMin <= 0.35 && r.meanRidge >= STRICT_MEAN && r.coverage >= STRICT_COVERAGE;
    },
  };

  // 健康線：手首の近くから、小指の付け根の方向へ斜めに進む
  const healthCenter = (d: number) => lerp(aPinky + 0.05, aMiddle, clamp((d - 0.25) / 0.75, 0, 1));
  const health: LineModel = {
    id: 'health',
    tier: 'strict',
    startAtHigh: true,
    spec: {
      axis: 'y',
      from: py(0.25),
      to: py(1.0),
      range: (y) => {
        const c = healthCenter(y / CANON_SCALE + CANON_D_MIN);
        return [px(c - 0.14), px(c + 0.14)];
      },
      tau: 0.35,
    },
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
    spec: {
      axis: 'x',
      from: px(aPinky - 0.2),
      to: px(aPinky + 0.15),
      range: () => [py(0.04), py(0.2)],
      tau: 0.4,
    },
    accept: (r) => {
      const e = extent(r.path);
      return e.aSpan >= 0.12 && e.aSpan <= 0.45 && r.meanRidge >= 0.65 && r.coverage >= 0.85;
    },
  };

  return { sun, health, marriage };
}

/**
 * ますかけ線の判定用：感情線と頭脳線が1本にまとまって、手のひらを横切る線。
 * 横切る1本の強い線があり、感情線の位置にも頭脳線の位置にも別の線が無いときだけ成立する
 */
export function buildSimianTransverse(h: HandFrame): LineModel {
  const { aIndex, aPinky } = h.refs;
  const from = aPinky - 0.12;
  const to = aIndex + 0.05;
  return {
    id: 'simian',
    tier: 'strict',
    startAtHigh: false,
    spec: {
      axis: 'x',
      from: px(from),
      to: px(to),
      range: () => [py(0.15), py(0.5)],
      tau: 0.35,
    },
    accept: (r) => {
      const e = extent(r.path);
      const first = fromCanon(r.path[0]);
      const last = fromCanon(r.path[r.path.length - 1]);
      // 小指側の端から親指側の端まで通し、親指側の端が頭脳線の高さ（感情線のように指の付け根へ上がらない）にある
      return (
        e.aSpan >= aIndex - aPinky + 0.0 &&
        first.d <= 0.36 &&
        last.d >= 0.26 &&
        r.meanRidge >= 0.6 &&
        r.coverage >= 0.85
      );
    },
  };
}

export { toCanon };

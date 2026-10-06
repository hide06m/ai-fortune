/**
 * 定義された範囲の中で、いちばん「線らしい」道筋を探す（動的計画法）
 *
 * 線は進む向き（progress軸）に沿って1画素ずつ進み、直交方向（offset）に少しずつ動く。
 * 始点と終点は固定せず、「線らしさ − 基準値」の合計が最大になる区間を選ぶ
 * （線らしさが基準に満たない部分は減点になるので、しわのない場所を無理に通らない）。
 * 結果が定義を満たすか（始点・終点の位置、長さ、濃さ、連続性）は、呼び出し側（palmModels）で判定する。
 */

import type { Pt } from './palmLines';

export interface SeamSpec {
  /** 'x' なら x方向に進み y が動く。'y' なら y方向に進み x が動く */
  axis: 'x' | 'y';
  /** 進む範囲（標準の手のひら画像の画素、両端を含む） */
  from: number;
  to: number;
  /** 各 progress で通ってよい offset の範囲 */
  range: (t: number) => [number, number];
  /** これより線らしさが低い画素は減点になる */
  tau: number;
  /** 1歩で offset が動ける最大幅 */
  maxStep?: number;
  /** offset を動かすときの減点（ふらつき防止） */
  stepPenalty?: number;
}

export interface SeamResult {
  /** progress が増える向きに並んだ経路（標準の手のひら画像の画素座標） */
  path: Pt[];
  score: number;
  /** 経路上の線らしさの平均（0〜1） */
  meanRidge: number;
  /** 線らしさが十分ある画素の割合（0〜1） */
  coverage: number;
}

const COVERAGE_LEVEL = 0.3;

export function findSeam(ridge: Float32Array, W: number, H: number, spec: SeamSpec): SeamResult | null {
  const { axis, tau } = spec;
  const maxStep = spec.maxStep ?? 1;
  const stepPenalty = spec.stepPenalty ?? 0.3;
  const sizeT = axis === 'x' ? W : H;
  const sizeO = axis === 'x' ? H : W;
  const from = Math.max(0, Math.round(spec.from));
  const to = Math.min(sizeT - 1, Math.round(spec.to));
  if (to <= from) return null;

  const at = (t: number, o: number) => (axis === 'x' ? ridge[o * W + t] : ridge[t * W + o]);
  const steps = to - from + 1;
  const parent = new Int32Array(steps * sizeO).fill(-2); // -2: 未到達, -1: ここが始点
  let prev = new Float32Array(sizeO).fill(-Infinity);
  let cur = new Float32Array(sizeO);

  let bestScore = 0;
  let bestT = -1;
  let bestO = -1;

  for (let t = from; t <= to; t++) {
    cur.fill(-Infinity);
    const [lo0, hi0] = spec.range(t);
    const lo = Math.max(0, Math.round(lo0));
    const hi = Math.min(sizeO - 1, Math.round(hi0));
    const row = (t - from) * sizeO;
    for (let o = lo; o <= hi; o++) {
      const gain = at(t, o) - tau;
      let bestPrev = -Infinity;
      let bestPrevO = -1;
      if (t > from) {
        for (let k = -maxStep; k <= maxStep; k++) {
          const po = o + k;
          if (po < 0 || po >= sizeO) continue;
          const v = prev[po] - stepPenalty * Math.abs(k);
          if (v > bestPrev) {
            bestPrev = v;
            bestPrevO = po;
          }
        }
      }
      if (bestPrev > 0) {
        cur[o] = gain + bestPrev;
        parent[row + o] = bestPrevO;
      } else {
        cur[o] = gain;
        parent[row + o] = -1;
      }
      if (cur[o] > bestScore) {
        bestScore = cur[o];
        bestT = t;
        bestO = o;
      }
    }
    const tmp = prev;
    prev = cur;
    cur = tmp;
  }

  if (bestT < 0) return null;

  const path: Pt[] = [];
  let t = bestT;
  let o = bestO;
  let sum = 0;
  let strong = 0;
  while (t >= from) {
    path.push(axis === 'x' ? { x: t, y: o } : { x: o, y: t });
    const r = at(t, o);
    sum += r;
    if (r > COVERAGE_LEVEL) strong++;
    const p = parent[(t - from) * sizeO + o];
    if (p < 0) break;
    o = p;
    t--;
  }
  path.reverse();
  return { path, score: bestScore, meanRidge: sum / path.length, coverage: strong / path.length };
}

/** 経路のまわりの線らしさを弱める（あとから探す別の線が、同じ道筋を再利用しないようにする） */
export function suppressPath(ridge: Float32Array, W: number, H: number, path: Pt[], radius: number, skipFirst = 0) {
  const r2 = radius * radius;
  for (let i = Math.floor(path.length * skipFirst); i < path.length; i++) {
    const cx = Math.round(path[i].x);
    const cy = Math.round(path[i].y);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        ridge[y * W + x] *= 0.1;
      }
    }
  }
}

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

class MinHeap {
  private keys: number[] = [];
  private vals: number[] = [];
  get size() {
    return this.keys.length;
  }
  push(key: number, val: number) {
    const k = this.keys;
    const v = this.vals;
    k.push(key);
    v.push(val);
    let i = k.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= k[i]) break;
      [k[p], k[i]] = [k[i], k[p]];
      [v[p], v[i]] = [v[i], v[p]];
      i = p;
    }
  }
  pop(): [number, number] {
    const k = this.keys;
    const v = this.vals;
    const top: [number, number] = [k[0], v[0]];
    const lastK = k.pop()!;
    const lastV = v.pop()!;
    if (k.length > 0) {
      k[0] = lastK;
      v[0] = lastV;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < k.length && k[l] < k[m]) m = l;
        if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]];
        [v[m], v[i]] = [v[i], v[m]];
        i = m;
      }
    }
    return top;
  }
}

const NEIGHBORS: Array<[number, number, number]> = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

export interface PathSpec {
  /** 通ってよい範囲 */
  inside: (x: number, y: number) => boolean;
  /** 始点・終点の領域（この中の、どの画素からどの画素へでもよい） */
  isStart: (x: number, y: number) => boolean;
  isEnd: (x: number, y: number) => boolean;
  /**
   * 線らしさに足す下駄（既定0.05）。大きくするほど、しわが途切れた部分を渡る費用が安くなり、
   * 途中で切れている線（生命線が途中で途切れて、また続く手など）でも、別の濃いしわへ逸れにくくなる
   */
  floor?: number;
}

/**
 * 始点の領域から終点の領域まで、線らしさが最大になる道筋を探す（ダイクストラ法）。
 * 縦や横の一方向に進むとは限らない、弧を描く線（生命線）用。
 * 始点・終点は領域の中で自由に選ぶので、領域の端が定義に合っていれば、途中は実際のしわに沿う
 */
export function findPathBetween(ridge: Float32Array, W: number, H: number, spec: PathSpec): SeamResult | null {
  const dist = new Float64Array(W * H).fill(Infinity);
  const prev = new Int32Array(W * H).fill(-1);
  const heap = new MinHeap();

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (spec.inside(x, y) && spec.isStart(x, y)) {
        dist[y * W + x] = 0;
        heap.push(0, y * W + x);
      }
    }
  }
  if (heap.size === 0) return null;

  // 線らしくない画素ほど高コスト。わずかな下駄で、無駄な迂回を防ぐ
  const floor = spec.floor ?? 0.05;
  const cost = (i: number) => 1 / (floor + ridge[i]);

  let reached = -1;
  while (heap.size > 0) {
    const [d, i] = heap.pop();
    if (d > dist[i]) continue;
    const x = i % W;
    const y = (i - x) / W;
    if (spec.isEnd(x, y)) {
      reached = i;
      break;
    }
    for (const [dx, dy, len] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || !spec.inside(nx, ny)) continue;
      const ni = ny * W + nx;
      const nd = d + cost(ni) * len;
      if (nd < dist[ni]) {
        dist[ni] = nd;
        prev[ni] = i;
        heap.push(nd, ni);
      }
    }
  }
  if (reached < 0) return null;

  const path: Pt[] = [];
  let sum = 0;
  let strong = 0;
  for (let i = reached, guard = 0; i !== -1 && guard <= W * H; i = prev[i], guard++) {
    const x = i % W;
    const y = (i - x) / W;
    path.push({ x, y });
    sum += ridge[i];
    if (ridge[i] > COVERAGE_LEVEL) strong++;
  }
  path.reverse();
  return { path, score: sum, meanRidge: sum / path.length, coverage: strong / path.length };
}

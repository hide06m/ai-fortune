/**
 * 手の骨格（MediaPipeの21点）から、4本の線それぞれの「始点・終点・探索範囲」を決める
 *
 * 座標系：指の付け根（人差し指と小指の付け根の中点）を原点 B とし、
 *   A軸 = 小指→人差し指（親指側が正）、D軸 = 指の付け根→手首（手のひらの下向き）
 *   F(a, d) = B + A*(a*手のひら幅) + D*(d*指の付け根〜手首の長さ)
 * 手が傾いていても、写真の向きに関係なく同じ式で位置が決まる。
 * 数値は、一般的な手のひらの比率に基づく初期値（実写で調整する）
 */

import type { Pt } from './palmLines';

export type PalmLineId = 'heart' | 'head' | 'life' | 'fate';

export interface LineSpec {
  id: PalmLineId;
  starts: Pt[];
  ends: Pt[];
  /** 探索してよい範囲（多角形） */
  corridor: Pt[];
}

// MediaPipe Hands のランドマーク番号
const WRIST = 0;
const INDEX_MCP = 5;
const PINKY_MCP = 17;

const sub = (p: Pt, q: Pt): Pt => ({ x: p.x - q.x, y: p.y - q.y });
const len = (p: Pt) => Math.hypot(p.x, p.y);
const norm = (p: Pt): Pt => {
  const l = len(p) || 1;
  return { x: p.x / l, y: p.y / l };
};

export interface HandFrame {
  F: (a: number, d: number) => Pt;
  /** 画像上の点を、手の座標系 (a, d) に戻す */
  toFrame: (p: Pt) => { a: number; d: number };
  width: number;
  length: number;
}

export function buildHandFrame(lm: Pt[]): HandFrame {
  const idx = lm[INDEX_MCP];
  const pk = lm[PINKY_MCP];
  const wr = lm[WRIST];
  const B: Pt = { x: (idx.x + pk.x) / 2, y: (idx.y + pk.y) / 2 };
  const width = len(sub(idx, pk));
  const A = norm(sub(idx, pk));
  // D は A に直交させる（指の付け根の線と手首の位置から決める）
  const toWrist = sub(wr, B);
  const proj = toWrist.x * A.x + toWrist.y * A.y;
  const perp = { x: toWrist.x - A.x * proj, y: toWrist.y - A.y * proj };
  const D = norm(perp);
  const length = Math.abs(toWrist.x * D.x + toWrist.y * D.y);
  return {
    width,
    length,
    toFrame: (p) => {
      const dx = p.x - B.x;
      const dy = p.y - B.y;
      return { a: (dx * A.x + dy * A.y) / width, d: (dx * D.x + dy * D.y) / length };
    },
    F: (a, d) => ({ x: B.x + A.x * a * width + D.x * d * length, y: B.y + A.y * a * width + D.y * d * length }),
  };
}

/** 中心の周りに小さな点群を作る（始点・終点の候補。1点だと位置がずれたときに破綻するため） */
function cluster(frame: HandFrame, a: number, d: number, da = 0.06, dd = 0.06): Pt[] {
  const pts: Pt[] = [];
  for (const ia of [-1, 0, 1]) for (const id of [-1, 0, 1]) pts.push(frame.F(a + ia * da, d + id * dd));
  return pts;
}

export function buildLineSpecs(lm: Pt[]): { frame: HandFrame; specs: LineSpec[] } {
  const f = buildHandFrame(lm);
  const F = f.F;
  const poly = (...ps: Array<[number, number]>) => ps.map(([a, d]) => F(a, d));

  const specs: LineSpec[] = [
    {
      id: 'heart',
      starts: cluster(f, -0.6, 0.2),
      ends: cluster(f, 0.3, 0.12),
      corridor: poly([-0.75, 0.04], [0.6, 0.02], [0.6, 0.36], [-0.75, 0.4]),
    },
    {
      id: 'head',
      starts: cluster(f, 0.55, 0.3),
      ends: cluster(f, -0.55, 0.42),
      corridor: poly([0.8, 0.2], [-0.75, 0.24], [-0.75, 0.66], [0.8, 0.62]),
    },
    {
      id: 'life',
      starts: cluster(f, 0.5, 0.3),
      ends: cluster(f, 0.15, 0.95),
      corridor: poly([0.3, 0.2], [1.05, 0.3], [1.05, 0.95], [0.5, 1.08], [-0.05, 1.08], [0.05, 0.6]),
    },
    {
      id: 'fate',
      starts: cluster(f, 0.0, 0.95),
      ends: cluster(f, 0.0, 0.2),
      corridor: poly([-0.3, 0.1], [0.3, 0.1], [0.3, 1.05], [-0.3, 1.05]),
    },
  ];
  return { frame: f, specs };
}

/** 多角形の内外判定（レイキャスティング）。探索範囲のマスク作成用 */
export function pointInPolygon(x: number, y: number, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

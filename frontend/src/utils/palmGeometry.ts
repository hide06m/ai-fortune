/**
 * 手の座標系と「標準の手のひら」への変換
 *
 * 手の骨格（MediaPipeの21点）から、手の向きや大きさに依らない座標 (a, d) を作る：
 *   原点 B = 人差し指と小指の付け根の中点
 *   A軸 = 小指→人差し指（親指側が正）、単位は「人差し指〜小指の付け根の幅」
 *   D軸 = 指の付け根→手首（手のひらの下向き）、単位は「指の付け根〜手首の長さ」
 * 写真をこの座標に並べ替えた画像（標準の手のひら）の上で線を探すので、
 * 手が傾いていても、遠くても近くても、各線の定義（始点・終点・通る範囲）を同じ式で書ける。
 */

import type { Pt } from './palmLines';

// MediaPipe Hands のランドマーク番号
export const LM = { WRIST: 0, THUMB_CMC: 1, THUMB_MCP: 2, INDEX_MCP: 5, MIDDLE_MCP: 9, RING_MCP: 13, PINKY_MCP: 17 } as const;

/** 標準の手のひら画像の寸法：a ∈ [A_MIN, A_MAX]、d ∈ [D_MIN, D_MAX] を SCALE 画素/単位で並べる */
export const CANON_SCALE = 220;
export const CANON_A_MIN = -0.9;
export const CANON_A_MAX = 1.2;
export const CANON_D_MIN = -0.1;
export const CANON_D_MAX = 1.2;
export const CANON_W = Math.round((CANON_A_MAX - CANON_A_MIN) * CANON_SCALE);
export const CANON_H = Math.round((CANON_D_MAX - CANON_D_MIN) * CANON_SCALE);

/** (a, d) → 標準の手のひら画像の画素座標 */
export const toCanon = (a: number, d: number): Pt => ({
  x: (a - CANON_A_MIN) * CANON_SCALE,
  y: (d - CANON_D_MIN) * CANON_SCALE,
});

/** 標準の手のひら画像の画素座標 → (a, d) */
export const fromCanon = (p: Pt): { a: number; d: number } => ({
  a: p.x / CANON_SCALE + CANON_A_MIN,
  d: p.y / CANON_SCALE + CANON_D_MIN,
});

const sub = (p: Pt, q: Pt): Pt => ({ x: p.x - q.x, y: p.y - q.y });
const len = (p: Pt) => Math.hypot(p.x, p.y);
const norm = (p: Pt): Pt => {
  const l = len(p) || 1;
  return { x: p.x / l, y: p.y / l };
};

export interface HandFrame {
  /** (a, d) → 写真上の座標 */
  F: (a: number, d: number) => Pt;
  /** 写真上の座標 → (a, d) */
  toFrame: (p: Pt) => { a: number; d: number };
  /** 人差し指〜小指の付け根の幅（写真の画素） */
  width: number;
  /** 指の付け根〜手首の長さ（写真の画素） */
  length: number;
  /** 指の付け根の並び（a座標）。線の定義を、実際の指の位置に合わせるために使う */
  refs: { aIndex: number; aMiddle: number; aRing: number; aPinky: number };
  /**
   * 手の向きの符号。手首→中指の付け根の向きと、小指→人差し指の向きの外積。
   * 撮影した写真（鏡像でない）で、手のひら側が見えているとき、親指が画像の右側にあれば正（右手）、左側にあれば負（左手）。
   * 手のひらを見る向きでは、親指が左にあるのが左手、右にあるのが右手（手の甲を見る向きでは逆になる）
   */
  orientation: number;
}

export function buildHandFrame(lm: Pt[]): HandFrame {
  const idx = lm[LM.INDEX_MCP];
  const pk = lm[LM.PINKY_MCP];
  const wr = lm[LM.WRIST];
  const mid = lm[LM.MIDDLE_MCP];
  const B: Pt = { x: (idx.x + pk.x) / 2, y: (idx.y + pk.y) / 2 };
  const width = len(sub(idx, pk));
  const A = norm(sub(idx, pk));
  // D は A に直交させる（指の付け根の並びと手首の位置から決める）
  const toWrist = sub(wr, B);
  const proj = toWrist.x * A.x + toWrist.y * A.y;
  const D = norm({ x: toWrist.x - A.x * proj, y: toWrist.y - A.y * proj });
  const length = Math.abs(toWrist.x * D.x + toWrist.y * D.y);

  const toFrame = (p: Pt) => {
    const dx = p.x - B.x;
    const dy = p.y - B.y;
    return { a: (dx * A.x + dy * A.y) / width, d: (dx * D.x + dy * D.y) / length };
  };

  const up = norm(sub(mid, wr));
  const across = norm(sub(idx, pk));

  return {
    F: (a, d) => ({ x: B.x + A.x * a * width + D.x * d * length, y: B.y + A.y * a * width + D.y * d * length }),
    toFrame,
    width,
    length,
    refs: {
      aIndex: toFrame(idx).a,
      aMiddle: toFrame(mid).a,
      aRing: toFrame(lm[LM.RING_MCP]).a,
      aPinky: toFrame(pk).a,
    },
    orientation: up.x * across.y - up.y * across.x,
  };
}

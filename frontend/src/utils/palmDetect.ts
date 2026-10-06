/**
 * 手のひらの写真から、手相の線を「定義に合うものだけ」検出する
 *
 *   1) MediaPipe で手の骨格（21点）を取得し、手の向き・左右を確認する
 *   2) 写真を「標準の手のひら」（palmGeometry）に並べ替える
 *   3) しわの強調画像を作り、手の輪郭付近は除く
 *   4) 各線の定義（palmModels）の範囲の中で、最も線らしい道筋を探す（palmSeam）
 *   5) 定義を満たした線だけを結果に含める。満たさない線は何も言わず省く
 */

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { toGray, normalizeIllumination, ridgeMap, smoothAndResample, segmentHand, edgeBand, type Pt } from './palmLines';
import { buildHandFrame, CANON_H, CANON_W, fromCanon, type HandFrame } from './palmGeometry';
import { buildHeadModel, buildHeartModel, buildMainModels, buildSimianTransverse, buildStrictModels, type LineId, type LineModel } from './palmModels';
import { suppressPath } from './palmSeam';

const WORK_MAX_SIZE = 720;

/** 診断で見る手。左右の読み方は流派によって違うため、ここ1か所で切り替えられるようにしてある */
export const REQUIRED_HAND: 'left' | 'right' = 'left';

/** 線の測定値（判断基準と結びつけるための客観的な数値。座標系は手のひらの大きさで正規化済み） */
export interface LineFeatures {
  /** 線の長さ ÷ 指の付け根〜手首の長さ */
  lengthRatio: number;
  /** 始点と終点の直線距離 ÷ 線の長さ（1に近いほど直線、小さいほど曲がっている） */
  straightness: number;
  /** 線らしさの平均（0〜1。濃さ・深さの目安） */
  depth: number;
  /** 線らしさが十分ある部分の割合（1に近いほど途切れがない） */
  continuity: number;
  /** 始点・終点の手の座標（a: 小指側負・親指側正、d: 指の付け根0〜手首1） */
  start: { a: number; d: number };
  end: { a: number; d: number };
}

export interface DetectedLine {
  id: LineId;
  /** 元画像の左上を(0,0)、右下を(1000,1000)とする座標（始点→終点の順） */
  points: Pt[];
  features: LineFeatures;
}

export type RejectReason = 'no-hand' | 'wrong-hand';

export interface DetectionResult {
  ok: boolean;
  reason?: RejectReason;
  /** 写っている手（骨格の向きから判定） */
  hand?: 'left' | 'right';
  lines: DetectedLine[];
  /** 調整・デバッグ用 */
  debug?: {
    work: { width: number; height: number };
    landmarks: Pt[];
    frame: HandFrame;
    ridge: Float32Array;
    handedness: string;
    orientation: number;
    /** 標準の手のひらでの様子（調整用）：変換後の写真、線らしさ、採用された線の道筋 */
    canon?: {
      rgba: Uint8ClampedArray;
      ridge: Float32Array;
      paths: Array<{ id: LineId; path: Pt[] }>;
    };
  };
}

let landmarkerPromise: Promise<HandLandmarker> | null = null;

function getLandmarker(): Promise<HandLandmarker> {
  landmarkerPromise ??= (async () => {
    const vision = await FilesetResolver.forVisionTasks('/models/wasm');
    return HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: '/models/hand_landmarker.task' },
      runningMode: 'IMAGE',
      numHands: 1,
      minHandDetectionConfidence: 0.3,
      minHandPresenceConfidence: 0.3,
    });
  })();
  return landmarkerPromise;
}

/** 双一次補間で、写真（RGBA）を標準の手のひらに並べ替える */
function rectify(
  src: { data: Uint8ClampedArray; width: number; height: number },
  frame: HandFrame,
): { data: Uint8ClampedArray; valid: Uint8Array } {
  const out = new Uint8ClampedArray(CANON_W * CANON_H * 4);
  const valid = new Uint8Array(CANON_W * CANON_H);
  for (let cy = 0; cy < CANON_H; cy++) {
    for (let cx = 0; cx < CANON_W; cx++) {
      const { a, d } = fromCanon({ x: cx, y: cy });
      const p = frame.F(a, d);
      const o = (cy * CANON_W + cx) * 4;
      out[o + 3] = 255;
      if (p.x < 0 || p.y < 0 || p.x > src.width - 1 || p.y > src.height - 1) continue;
      valid[cy * CANON_W + cx] = 1;
      const x0 = Math.floor(p.x);
      const y0 = Math.floor(p.y);
      const x1 = Math.min(src.width - 1, x0 + 1);
      const y1 = Math.min(src.height - 1, y0 + 1);
      const fx = p.x - x0;
      const fy = p.y - y0;
      for (let c = 0; c < 3; c++) {
        const v00 = src.data[(y0 * src.width + x0) * 4 + c];
        const v10 = src.data[(y0 * src.width + x1) * 4 + c];
        const v01 = src.data[(y1 * src.width + x0) * 4 + c];
        const v11 = src.data[(y1 * src.width + x1) * 4 + c];
        out[o + c] = v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
      }
    }
  }
  return { data: out, valid };
}

/** 標準の手のひらの画素 → (a, d) → 物理的な長さ（指の付け根〜手首の長さを1とする） */
function pathLengthPhysical(path: Pt[], frame: HandFrame): number {
  const ratio = frame.width / frame.length;
  let len = 0;
  for (let i = 1; i < path.length; i++) {
    const p = fromCanon(path[i - 1]);
    const q = fromCanon(path[i]);
    len += Math.hypot((q.a - p.a) * ratio, q.d - p.d);
  }
  return len;
}

function computeFeatures(path: Pt[], depth: number, continuity: number, frame: HandFrame): LineFeatures {
  const len = pathLengthPhysical(path, frame);
  const s = fromCanon(path[0]);
  const e = fromCanon(path[path.length - 1]);
  const ratio = frame.width / frame.length;
  const chord = Math.hypot((e.a - s.a) * ratio, e.d - s.d);
  return { lengthRatio: len, straightness: len > 0 ? chord / len : 0, depth, continuity, start: s, end: e };
}

/** 結果の経路（標準の手のひらの画素）を、元の写真の 0〜1000 座標に直す */
function toOutput(path: Pt[], frame: HandFrame, W: number, H: number): Pt[] {
  return smoothAndResample(path, 48, 9).map((p) => {
    const { a, d } = fromCanon(p);
    const q = frame.F(a, d);
    return { x: (q.x / W) * 1000, y: (q.y / H) * 1000 };
  });
}

function runModel(model: LineModel, ridge: Float32Array) {
  const r = model.find(ridge);
  if (!r || !model.accept(r)) return null;
  return r;
}

export async function detectPalmLines(
  source: HTMLImageElement | HTMLCanvasElement,
  options: { requiredHand?: 'left' | 'right' | null } = {},
): Promise<DetectionResult> {
  const requiredHand = options.requiredHand === undefined ? REQUIRED_HAND : options.requiredHand;
  const srcW = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const srcH = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  const scale = Math.min(1, WORK_MAX_SIZE / Math.max(srcW, srcH));
  const W = Math.round(srcW * scale);
  const H = Math.round(srcH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, W, H);

  const landmarker = await getLandmarker();
  const result = landmarker.detect(canvas);
  if (!result.landmarks || result.landmarks.length === 0) return { ok: false, reason: 'no-hand', lines: [] };

  const lm: Pt[] = result.landmarks[0].map((p) => ({ x: p.x * W, y: p.y * H }));
  const frame = buildHandFrame(lm);
  const handedness = result.handedness?.[0]?.[0]?.categoryName ?? '';

  // 手の向き：鏡像でない写真で、手のひら側を向けた左手なら orientation > 0、右手なら < 0
  const hand: 'left' | 'right' = frame.orientation > 0 ? 'left' : 'right';
  const debugBase = { work: { width: W, height: H }, landmarks: lm, frame, handedness, orientation: frame.orientation };
  if (requiredHand && hand !== requiredHand) {
    return { ok: false, reason: 'wrong-hand', hand, lines: [], debug: { ...debugBase, ridge: new Float32Array(0) } };
  }

  // 標準の手のひらに並べ替え、しわの強調画像を作る
  const imageData = ctx.getImageData(0, 0, W, H);
  const rect = rectify(imageData, frame);
  const canonGray = normalizeIllumination(toGray({ data: rect.data, width: CANON_W, height: CANON_H }));
  const ridge = ridgeMap(canonGray);

  // 写真の外側（並べ替えで範囲外になった部分）は線らしさを0にする
  for (let i = 0; i < ridge.length; i++) if (!rect.valid[i]) ridge[i] = 0;

  // 手の輪郭付近は、影や輪郭を「線」と取り違えやすいので除く
  const samples = [0, 1, 2, 5, 9, 13, 17].map((i) => lm[i]);
  const mask = segmentHand(imageData, samples);
  if (mask) {
    const band = edgeBand(mask, W, H, Math.max(8, Math.round(frame.width * 0.1)));
    for (let cy = 0; cy < CANON_H; cy++) {
      for (let cx = 0; cx < CANON_W; cx++) {
        const { a, d } = fromCanon({ x: cx, y: cy });
        const p = frame.F(a, d);
        const sx = Math.round(p.x);
        const sy = Math.round(p.y);
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
        if (band[sy * W + sx]) ridge[cy * CANON_W + cx] *= 0.05;
      }
    }
  }

  // 定義に合う線を探す。見つけた線の道筋は、あとで探す別の線が再利用しないように弱める
  const work = Float32Array.from(ridge);
  const main = buildMainModels(frame);
  const strict = buildStrictModels(frame);
  const found: Array<{ model: LineModel; path: Pt[]; meanRidge: number; coverage: number }> = [];
  const take = (model: LineModel, skipFirst = 0) => {
    const r = runModel(model, work);
    if (!r) return null;
    found.push({ model, path: r.path, meanRidge: r.meanRidge, coverage: r.coverage });
    suppressPath(work, CANON_W, CANON_H, r.path, 7, skipFirst);
    return r;
  };

  take(main.life, 0.15); // 頭脳線と始点が重なるので、始まりの部分は残す
  take(main.fate);

  // 感情線・頭脳線を、通常の定義で探す。頭脳線は感情線より下にあるので、感情線が見つかっていればその下だけを探す
  const heartResult = take(main.heart);
  const headResult = take(buildHeadModel(frame, heartResult?.path), 0.1);

  // ますかけ線：感情線と頭脳線が1本にまとまっている場合だけ成立する。
  // 通常の感情線・頭脳線が（両方とも）見つからなかったときに限り、1本の強い横線があるかを調べる
  if (!heartResult && !headResult) {
    const transverse = buildSimianTransverse();
    const tr = runModel(transverse, work);
    if (tr) {
      const probe = Float32Array.from(work);
      suppressPath(probe, CANON_W, CANON_H, tr.path, 9);
      const separateHead = runModel(buildHeadModel(frame), probe);
      const separateHeart = runModel(buildHeartModel(frame), probe);
      if (!separateHead && !separateHeart) {
        found.push({ model: transverse, path: tr.path, meanRidge: tr.meanRidge, coverage: tr.coverage });
        suppressPath(work, CANON_W, CANON_H, tr.path, 9);
      }
    }
  }

  // 位置関係の決まり：感情線は頭脳線より指に近い側（dが小さい側）にある
  const heart = found.find((f) => f.model.id === 'heart');
  const head = found.find((f) => f.model.id === 'head');
  if (heart && head) {
    const as = (f: { path: Pt[] }) => f.path.map((p) => fromCanon(p));
    const hq = as(heart);
    const dq = as(head);
    const lo = Math.max(Math.min(...hq.map((q) => q.a)), Math.min(...dq.map((q) => q.a)));
    const hi = Math.min(Math.max(...hq.map((q) => q.a)), Math.max(...dq.map((q) => q.a)));
    if (hi > lo) {
      const mean = (qs: { a: number; d: number }[]) => {
        const ds = qs.filter((q) => q.a >= lo && q.a <= hi).map((q) => q.d);
        return ds.length ? ds.reduce((s, v) => s + v, 0) / ds.length : null;
      };
      const dh = mean(hq);
      const dd = mean(dq);
      if (dh !== null && dd !== null && dh >= dd - 0.05) {
        // 定義に反する（感情線が頭脳線より下、または同じ位置）。線らしさの弱い方を捨てる
        const drop = heart.meanRidge * heart.coverage < head.meanRidge * head.coverage ? heart : head;
        found.splice(found.indexOf(drop), 1);
      }
    }
  }

  // 確実に検出できたときだけ使う線（太陽線・健康線・結婚線）
  const heartPath = found.find((f) => f.model.id === 'heart')?.path;
  for (const m of [strict.sun, strict.health, strict.marriage]) {
    const r = runModel(m, work);
    if (!r) continue;
    if (m.id === 'marriage' && heartPath) {
      // 感情線そのものを拾っていないこと（感情線から十分離れていること）
      const near = r.path.filter((p) => heartPath.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 12)).length;
      if (near / r.path.length > 0.3) continue;
    }
    // すでに見つけた線とほぼ同じ道筋なら、別の線として採用しない
    const dup = found.some((f) => {
      const near = r.path.filter((p) => f.path.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 10)).length;
      return near / r.path.length > 0.5;
    });
    if (dup) continue;
    found.push({ model: m, path: r.path, meanRidge: r.meanRidge, coverage: r.coverage });
    suppressPath(work, CANON_W, CANON_H, r.path, 7);
  }

  const lines: DetectedLine[] = found.map((f) => {
    const ordered = f.model.startAtHigh ? [...f.path].reverse() : f.path;
    return {
      id: f.model.id,
      points: toOutput(ordered, frame, W, H),
      features: computeFeatures(ordered, f.meanRidge, f.coverage, frame),
    };
  });

  return {
    ok: true,
    hand,
    lines,
    debug: { ...debugBase, ridge, canon: { rgba: rect.data, ridge, paths: found.map((f) => ({ id: f.model.id, path: f.path })) } },
  };
}

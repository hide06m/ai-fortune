/**
 * 手のひらの写真から、4本の線（感情線・頭脳線・生命線・運命線）を検出する
 *   1) MediaPipe で手の骨格（21点）を取得
 *   2) 骨格から線ごとの始点・終点・探索範囲を決める（palmGeometry）
 *   3) しわの強調画像の上で、始点〜終点の最も線らしい道筋をたどる（palmLines）
 * 線が見つからないときは、その線を結果に含めない（嘘の線を描かない）
 */

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { toGray, normalizeIllumination, ridgeMap, traceLine, smoothAndResample, segmentHand, edgeBand, type Pt } from './palmLines';
import { buildLineSpecs, pointInPolygon, type PalmLineId, type LineSpec, type HandFrame } from './palmGeometry';

const WORK_MAX_SIZE = 720;

export interface DetectedLine {
  id: PalmLineId;
  /** 元画像の左上を(0,0)、右下を(1000,1000)とする座標 */
  points: Pt[];
  strength: number;
  coverage: number;
}

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
  /** 始点・終点の手の座標（a: 小指側-0.6〜親指側+0.6、d: 指の付け根0〜手首1） */
  start: { a: number; d: number };
  end: { a: number; d: number };
}

/** Gemini に選ばせる「しわの候補」 */
export interface LineCandidate {
  id: string; // C1, C2, ...
  /** どの線の探索範囲から見つかった候補か（ヒント。最終判断はGeminiが行う） */
  zone: PalmLineId;
  /** 元画像の左上を(0,0)、右下を(1000,1000)とする座標 */
  points: Pt[];
  features: LineFeatures;
}

export interface DetectionResult {
  ok: boolean;
  reason?: 'no-hand';
  lines: DetectedLine[];
  candidates: LineCandidate[];
  /** 調整・デバッグ用（作業画像の画素座標） */
  debug?: { work: { width: number; height: number }; landmarks: Pt[]; ridge: Float32Array; specs: LineSpec[] };
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

export async function detectPalmLines(source: HTMLImageElement | HTMLCanvasElement): Promise<DetectionResult> {
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
  if (!result.landmarks || result.landmarks.length === 0) return { ok: false, reason: 'no-hand', lines: [], candidates: [] };

  const lm: Pt[] = result.landmarks[0].map((p) => ({ x: p.x * W, y: p.y * H }));
  const { specs, frame } = buildLineSpecs(lm);

  const imageData = ctx.getImageData(0, 0, W, H);
  const gray = normalizeIllumination(toGray(imageData));
  const ridge = ridgeMap(gray);

  // 手の輪郭付近は、影や輪郭を「線」と取り違えやすいので、検出の対象から外す
  const samples = [0, 1, 2, 5, 9, 13, 17].map((i) => lm[i]);
  const mask = segmentHand(imageData, samples);
  if (mask) {
    const band = edgeBand(mask, W, H, Math.max(5, Math.round(frame.width * 0.05)));
    for (let i = 0; i < ridge.length; i++) if (band[i]) ridge[i] *= 0.05;
  }

  const lines: DetectedLine[] = [];
  for (const spec of specs) {
    const traced = traceLine(ridge, W, H, spec.starts, spec.ends, {
      corridor: (x, y) => pointInPolygon(x, y, spec.corridor),
    });
    if (!traced) continue;
    const pts = smoothAndResample(traced.path).map((p) => ({ x: (p.x / W) * 1000, y: (p.y / H) * 1000 }));
    lines.push({ id: spec.id, points: pts, strength: traced.strength, coverage: traced.coverage });
  }

  const candidates = extractCandidates(ridge, W, H, specs, frame);

  return { ok: true, lines, candidates, debug: { work: { width: W, height: H }, landmarks: lm, ridge, specs } };
}

const ALTERNATIVES_PER_ZONE = 3;
const SUPPRESS_RADIUS = 7;

function pathLength(pts: Pt[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return l;
}

/** 経路のまわりの「線らしさ」を弱めて、次に探すときに別の道筋が選ばれるようにする */
function suppressAround(ridge: Float32Array, W: number, H: number, path: Pt[]) {
  for (const p of path) {
    const cx = Math.round(p.x);
    const cy = Math.round(p.y);
    for (let dy = -SUPPRESS_RADIUS; dy <= SUPPRESS_RADIUS; dy++) {
      for (let dx = -SUPPRESS_RADIUS; dx <= SUPPRESS_RADIUS; dx++) {
        if (dx * dx + dy * dy > SUPPRESS_RADIUS * SUPPRESS_RADIUS) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        ridge[y * W + x] *= 0.1;
      }
    }
  }
}

/** 2本の経路が重なっている割合（aの点のうち、bのそばを通る点の割合） */
function overlapRatio(a: Pt[], b: Pt[], tol = 6): number {
  let near = 0;
  for (const p of a) {
    for (const q of b) {
      if (Math.hypot(p.x - q.x, p.y - q.y) <= tol) {
        near++;
        break;
      }
    }
  }
  return near / a.length;
}

function computeFeatures(path: Pt[], strength: number, coverage: number, frame: HandFrame): LineFeatures {
  const len = pathLength(path);
  const chord = Math.hypot(path[path.length - 1].x - path[0].x, path[path.length - 1].y - path[0].y);
  return {
    lengthRatio: len / frame.length,
    straightness: len > 0 ? chord / len : 0,
    depth: strength,
    continuity: coverage,
    start: frame.toFrame(path[0]),
    end: frame.toFrame(path[path.length - 1]),
  };
}

/**
 * 各線の探索範囲ごとに、しわの候補を最大 ALTERNATIVES_PER_ZONE 本取り出す。
 * 1本目は最も線らしい道筋、2本目以降は1本目を避けた別の道筋（影や別のしわを拾った場合の保険）。
 * 重複する候補は強い方だけ残す。
 */
export function extractCandidates(
  ridge: Float32Array,
  W: number,
  H: number,
  specs: LineSpec[],
  frame: HandFrame,
): LineCandidate[] {
  type Raw = { zone: PalmLineId; path: Pt[]; strength: number; coverage: number; rank: number };
  const raws: Raw[] = [];

  for (const spec of specs) {
    const work = Float32Array.from(ridge);
    for (let k = 0; k < ALTERNATIVES_PER_ZONE; k++) {
      const traced = traceLine(work, W, H, spec.starts, spec.ends, {
        corridor: (x, y) => pointInPolygon(x, y, spec.corridor),
      });
      if (!traced) break;
      raws.push({ zone: spec.id, path: smoothAndResample(traced.path, 60, 9), strength: traced.strength, coverage: traced.coverage, rank: k });
      suppressAround(work, W, H, traced.path);
    }
  }

  // 強い順に採用し、すでに採用した候補とほぼ同じ経路なら捨てる
  raws.sort((a, b) => b.strength * b.coverage - a.strength * a.coverage);
  const kept: Raw[] = [];
  for (const r of raws) {
    if (kept.some((k) => overlapRatio(r.path, k.path) > 0.6 || overlapRatio(k.path, r.path) > 0.6)) continue;
    kept.push(r);
  }

  // 番号は 線の種類（感情線→頭脳線→生命線→運命線）、同じ種類の中では強い順
  const zoneOrder: PalmLineId[] = ['heart', 'head', 'life', 'fate'];
  kept.sort((a, b) => zoneOrder.indexOf(a.zone) - zoneOrder.indexOf(b.zone) || b.strength - a.strength);

  return kept.map((r, i) => ({
    id: `C${i + 1}`,
    zone: r.zone,
    points: r.path.map((p) => ({ x: (p.x / W) * 1000, y: (p.y / H) * 1000 })),
    features: computeFeatures(r.path, r.strength, r.coverage, frame),
  }));
}

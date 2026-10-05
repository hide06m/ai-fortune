/**
 * 手のひらの写真から、4本の線（感情線・頭脳線・生命線・運命線）を検出する
 *   1) MediaPipe で手の骨格（21点）を取得
 *   2) 骨格から線ごとの始点・終点・探索範囲を決める（palmGeometry）
 *   3) しわの強調画像の上で、始点〜終点の最も線らしい道筋をたどる（palmLines）
 * 線が見つからないときは、その線を結果に含めない（嘘の線を描かない）
 */

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { toGray, normalizeIllumination, ridgeMap, traceLine, smoothAndResample, type Pt } from './palmLines';
import { buildLineSpecs, pointInPolygon, type PalmLineId, type LineSpec } from './palmGeometry';

const WORK_MAX_SIZE = 720;

export interface DetectedLine {
  id: PalmLineId;
  /** 元画像の左上を(0,0)、右下を(1000,1000)とする座標 */
  points: Pt[];
  strength: number;
  coverage: number;
}

export interface DetectionResult {
  ok: boolean;
  reason?: 'no-hand';
  lines: DetectedLine[];
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
  if (!result.landmarks || result.landmarks.length === 0) return { ok: false, reason: 'no-hand', lines: [] };

  const lm: Pt[] = result.landmarks[0].map((p) => ({ x: p.x * W, y: p.y * H }));
  const { specs } = buildLineSpecs(lm);

  const gray = normalizeIllumination(toGray(ctx.getImageData(0, 0, W, H)));
  const ridge = ridgeMap(gray);

  const lines: DetectedLine[] = [];
  for (const spec of specs) {
    const traced = traceLine(ridge, W, H, spec.starts, spec.ends, {
      corridor: (x, y) => pointInPolygon(x, y, spec.corridor),
    });
    if (!traced) continue;
    const pts = smoothAndResample(traced.path).map((p) => ({ x: (p.x / W) * 1000, y: (p.y / H) * 1000 }));
    lines.push({ id: spec.id, points: pts, strength: traced.strength, coverage: traced.coverage });
  }

  return { ok: true, lines, debug: { work: { width: W, height: H }, landmarks: lm, ridge, specs } };
}

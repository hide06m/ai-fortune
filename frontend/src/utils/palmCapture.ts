/**
 * 撮影直後に、手のひらの写真からしわの候補を取り出し、番号付きで重ねた画像を作る
 * 失敗しても診断自体は続けられる（その場合は候補なしで送り、サーバーは従来方式にフォールバックする）
 */

import { detectPalmLines, type LineCandidate } from './palmDetect';

// 候補ごとに見分けやすい色（線の種類のヒントにならないよう、候補番号の順に割り当てる）
const PALETTE = ['#ff3b30', '#00b8ff', '#34c759', '#ffcc00', '#bf5af2', '#ff9500', '#00e5c8', '#ff2d95', '#a2ff00', '#5e5ce6'];

export interface PalmAnalysis {
  candidates: LineCandidate[];
  /** 候補を番号付きで重ねたJPEG（base64、ヘッダなし） */
  annotatedBase64: string;
}

function drawAnnotated(source: HTMLCanvasElement, candidates: LineCandidate[]): string {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0);

  const lineWidth = Math.max(3, Math.round(canvas.width / 220));
  candidates.forEach((c, i) => {
    const color = PALETTE[i % PALETTE.length];
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    c.points.forEach((p, k) => {
      const x = (p.x / 1000) * canvas.width;
      const y = (p.y / 1000) * canvas.height;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });

  // ラベルは線の上に描いたあとで、線の始点側に置く（中ほどに置くと他の線と重なりやすい）
  const fontSize = Math.max(14, Math.round(canvas.width / 45));
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  candidates.forEach((c, i) => {
    const color = PALETTE[i % PALETTE.length];
    const p = c.points[Math.floor(c.points.length * 0.15)];
    const x = (p.x / 1000) * canvas.width;
    const y = (p.y / 1000) * canvas.height;
    const w = ctx.measureText(c.id).width + 10;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(x - w / 2, y - fontSize / 2 - 3, w, fontSize + 6);
    ctx.fillStyle = color;
    ctx.fillText(c.id, x, y);
  });

  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
}

export async function analyzePalmImage(canvas: HTMLCanvasElement): Promise<PalmAnalysis | null> {
  try {
    const result = await detectPalmLines(canvas);
    if (!result.ok || result.candidates.length === 0) return null;
    return { candidates: result.candidates, annotatedBase64: drawAnnotated(canvas, result.candidates) };
  } catch (error) {
    console.error('Palm line analysis failed (falling back to server-side detection):', error);
    return null;
  }
}

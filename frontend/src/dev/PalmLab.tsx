/**
 * 手相の線検出の調整用ページ（開発時のみ。/palm-lab で開く）
 * public/dev-samples/ のサンプル写真に、定義に合うと判定された線だけを重ねて目で確認する。
 * 各写真の右に「標準の手のひら」（アルゴリズムが実際に見ている画像）を出し、
 * 各線の探索範囲（点線）と、しわの強さ・採用された道筋を重ねる。
 * 左右の制限は外してある（どの手でも検出の様子を見るため）
 */

import { useEffect, useRef, useState } from 'react';
import { detectPalmLines, type DetectionResult } from '../utils/palmDetect';
import { buildMainModels } from '../utils/palmModels';
import { CANON_H, CANON_W } from '../utils/palmGeometry';

const SAMPLES = ['sample1.webp', 'sample2.png', 'sample3.png', 'sample4.png', 'sample5.png', 'sample6.png'];
const COLORS: Record<string, string> = {
  heart: '#ff2d6f',
  head: '#1e90ff',
  life: '#00c853',
  fate: '#ffb300',
  simian: '#ff6d00',
  sun: '#e91e63',
  health: '#00bcd4',
  marriage: '#9c27b0',
};
const LABELS: Record<string, string> = {
  heart: '感情線',
  head: '頭脳線',
  life: '生命線',
  fate: '運命線',
  simian: 'ますかけ線',
  sun: '太陽線',
  health: '健康線',
  marriage: '結婚線',
};

function drawCanon(canvas: HTMLCanvasElement, res: DetectionResult, showRidge: boolean) {
  const canon = res.debug?.canon;
  if (!canon || !res.debug) return;
  canvas.width = CANON_W;
  canvas.height = CANON_H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(CANON_W, CANON_H);
  for (let i = 0; i < CANON_W * CANON_H; i++) {
    if (showRidge) {
      const v = Math.round(canon.ridge[i] * 255);
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
    } else {
      img.data[i * 4] = canon.rgba[i * 4];
      img.data[i * 4 + 1] = canon.rgba[i * 4 + 1];
      img.data[i * 4 + 2] = canon.rgba[i * 4 + 2];
    }
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  // 各線の探索範囲（点線）
  const main = buildMainModels(res.debug.frame);
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 4]);
  for (const m of Object.values(main)) {
    ctx.strokeStyle = COLORS[m.id];
    for (const side of [0, 1]) {
      ctx.beginPath();
      for (let t = Math.round(m.spec.from); t <= Math.round(m.spec.to); t += 4) {
        const o = m.spec.range(t)[side];
        const [x, y] = m.spec.axis === 'x' ? [t, o] : [o, t];
        if (t === Math.round(m.spec.from)) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);

  // 採用された線の道筋
  ctx.lineWidth = 3;
  for (const p of canon.paths) {
    ctx.strokeStyle = COLORS[p.id];
    ctx.beginPath();
    p.path.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
    ctx.stroke();
  }
}

function Sample({ file, run, showRidge }: { file: string; run: number; showRidge: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const canonRef = useRef<HTMLCanvasElement>(null);
  const [info, setInfo] = useState('検出中…');

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = async () => {
      const canvas = ref.current;
      if (!canvas || cancelled) return;
      const maxW = 440;
      const s = Math.min(1, maxW / img.naturalWidth);
      canvas.width = Math.round(img.naturalWidth * s);
      canvas.height = Math.round(img.naturalHeight * s);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      let res: DetectionResult;
      try {
        res = await detectPalmLines(img, { requiredHand: null });
      } catch (e) {
        setInfo('エラー: ' + (e instanceof Error ? e.message : String(e)));
        return;
      }
      if (cancelled) return;
      if (!res.ok || !res.debug) {
        setInfo('手を検出できませんでした');
        return;
      }
      if (canonRef.current) drawCanon(canonRef.current, res, showRidge);
      const sx = canvas.width / res.debug.work.width;
      const sy = canvas.height / res.debug.work.height;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (const p of res.debug.landmarks) {
        ctx.beginPath();
        ctx.arc(p.x * sx, p.y * sy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const l of res.lines) {
        ctx.strokeStyle = COLORS[l.id];
        ctx.lineWidth = 3.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        l.points.forEach((p, i) => {
          const x = (p.x / 1000) * canvas.width;
          const y = (p.y / 1000) * canvas.height;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        const mid = l.points[Math.floor(l.points.length / 2)];
        const lx = (mid.x / 1000) * canvas.width;
        const ly = (mid.y / 1000) * canvas.height;
        ctx.font = 'bold 12px sans-serif';
        const label = LABELS[l.id];
        const w = ctx.measureText(label).width + 8;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(lx - w / 2, ly - 9, w, 18);
        ctx.fillStyle = COLORS[l.id];
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, lx, ly);
      }
      const found = res.lines
        .map(
          (l) =>
            `${LABELS[l.id]}(長${l.features.lengthRatio.toFixed(2)} 直${l.features.straightness.toFixed(2)} 濃${l.features.depth.toFixed(2)} 連${l.features.continuity.toFixed(2)})`,
        )
        .join(' ');
      setInfo(
        `判定:${res.hand === 'left' ? '左手' : '右手'}(向き${res.debug.orientation.toFixed(2)}/MP:${res.debug.handedness}) → ${found || '採用された線なし'}`,
      );
    };
    img.src = `/dev-samples/${file}`;
    return () => {
      cancelled = true;
    };
  }, [file, run, showRidge]);

  return (
    <div style={{ margin: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <canvas ref={ref} style={{ width: 440, maxWidth: '48vw' }} />
        <canvas ref={canonRef} style={{ width: 440, maxWidth: '48vw', background: '#000' }} />
      </div>
      <div style={{ fontSize: 12, color: '#ccc', maxWidth: 900 }}>
        {file}　{info}
      </div>
    </div>
  );
}

export function PalmLab() {
  const [run, setRun] = useState(0);
  const [showRidge, setShowRidge] = useState(false);
  return (
    <div style={{ background: '#111', color: '#fff', minHeight: '100vh', padding: 12 }}>
      <button onClick={() => setRun((n) => n + 1)}>再検出</button>{' '}
      <label>
        <input type="checkbox" checked={showRidge} onChange={(e) => setShowRidge(e.target.checked)} /> 右の画像を「しわの強さ」にする
      </label>
      {SAMPLES.map((f) => (
        <Sample key={f} file={f} run={run} showRidge={showRidge} />
      ))}
    </div>
  );
}

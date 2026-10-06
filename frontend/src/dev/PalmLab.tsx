/**
 * 手相の線検出の調整用ページ（開発時のみ。/palm-lab で開く）
 * public/dev-samples/ のサンプル写真に、定義に合うと判定された線だけを重ねて目で確認する。
 * 左右の制限は外してある（どの手でも検出の様子を見るため）。判定された手と向きは各写真の下に表示する
 */

import { useEffect, useRef, useState } from 'react';
import { detectPalmLines, type DetectionResult } from '../utils/palmDetect';

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

function Sample({ file, run }: { file: string; run: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [info, setInfo] = useState('検出中…');

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = async () => {
      const canvas = ref.current;
      if (!canvas || cancelled) return;
      const maxW = 520;
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
  }, [file, run]);

  return (
    <div style={{ margin: 8, maxWidth: 520 }}>
      <canvas ref={ref} style={{ maxWidth: '100%', display: 'block' }} />
      <div style={{ fontSize: 12, color: '#ccc' }}>
        {file}　{info}
      </div>
    </div>
  );
}

export function PalmLab() {
  const [run, setRun] = useState(0);
  return (
    <div style={{ background: '#111', color: '#fff', minHeight: '100vh', padding: 12 }}>
      <button onClick={() => setRun((n) => n + 1)}>再検出</button>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {SAMPLES.map((f) => (
          <Sample key={f} file={f} run={run} />
        ))}
      </div>
    </div>
  );
}

/**
 * 手相の線検出の調整用ページ（開発時のみ。/palm-lab で開く）
 * public/dev-samples/ のサンプル写真に検出結果を重ねて、目で確認する
 */

import { useEffect, useRef, useState } from 'react';
import { detectPalmLines, type DetectionResult } from '../utils/palmDetect';

const SAMPLES = ['sample1.webp', 'sample2.png', 'sample3.png', 'sample4.png', 'sample5.png', 'sample6.png'];
const COLORS: Record<string, string> = { heart: '#ff2d6f', head: '#1e90ff', life: '#00c853', fate: '#ffb300' };

function Sample({ file, showRidge, showZones }: { file: string; showRidge: boolean; showZones: boolean }) {
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
        res = await detectPalmLines(img);
      } catch (e) {
        setInfo('エラー: ' + (e instanceof Error ? e.message : String(e)));
        return;
      }
      if (cancelled) return;
      if (showRidge && res.debug) {
        const { width, height } = res.debug.work;
        const tmp = document.createElement('canvas');
        tmp.width = width;
        tmp.height = height;
        const t = tmp.getContext('2d')!;
        const id = t.createImageData(width, height);
        for (let i = 0; i < width * height; i++) {
          const v = Math.round(res.debug.ridge[i] * 255);
          id.data[i * 4] = v;
          id.data[i * 4 + 1] = v;
          id.data[i * 4 + 2] = v;
          id.data[i * 4 + 3] = 255;
        }
        t.putImageData(id, 0, 0);
        ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
      }
      if (!res.ok || !res.debug) {
        setInfo('手を検出できませんでした');
        return;
      }
      const sx = canvas.width / res.debug.work.width;
      const sy = canvas.height / res.debug.work.height;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (const p of res.debug.landmarks) {
        ctx.beginPath();
        ctx.arc(p.x * sx, p.y * sy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (showZones) {
        for (const spec of res.debug.specs) {
          ctx.strokeStyle = COLORS[spec.id];
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          spec.corridor.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * sx, p.y * sy) : ctx.lineTo(p.x * sx, p.y * sy)));
          ctx.closePath();
          ctx.stroke();
          ctx.setLineDash([]);
          for (const p of [...spec.starts, ...spec.ends]) ctx.fillRect(p.x * sx - 1, p.y * sy - 1, 3, 3);
        }
      }
      for (const l of res.lines) {
        ctx.strokeStyle = COLORS[l.id];
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        l.points.forEach((p, i) => {
          const x = (p.x / 1000) * canvas.width;
          const y = (p.y / 1000) * canvas.height;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
      const found = res.lines.map((l) => `${l.id}(${l.strength.toFixed(2)}/${l.coverage.toFixed(2)})`).join(' ');
      setInfo(`検出: ${found || 'なし'}`);
    };
    img.src = `/dev-samples/${file}`;
    return () => {
      cancelled = true;
    };
  }, [file, showRidge, showZones]);

  return (
    <div style={{ margin: 8 }}>
      <canvas ref={ref} style={{ maxWidth: '100%', display: 'block' }} />
      <div style={{ fontSize: 12, color: '#ccc' }}>
        {file}　{info}
      </div>
    </div>
  );
}

export function PalmLab() {
  const [showRidge, setShowRidge] = useState(false);
  const [showZones, setShowZones] = useState(false);
  return (
    <div style={{ background: '#111', color: '#fff', minHeight: '100vh', padding: 12 }}>
      <label style={{ marginRight: 16 }}>
        <input type="checkbox" checked={showRidge} onChange={(e) => setShowRidge(e.target.checked)} /> 線らしさマップ
      </label>
      <label>
        <input type="checkbox" checked={showZones} onChange={(e) => setShowZones(e.target.checked)} /> 探索範囲と始点・終点
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {SAMPLES.map((f) => (
          <Sample key={f + showRidge + showZones} file={f} showRidge={showRidge} showZones={showZones} />
        ))}
      </div>
    </div>
  );
}

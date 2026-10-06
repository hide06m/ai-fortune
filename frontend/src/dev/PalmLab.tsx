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
import { CANON_H, CANON_W, toCanon } from '../utils/palmGeometry';
import { loadGroundTruth, type GroundTruthLines } from './groundTruth';
import type { Pt } from '../utils/palmLines';

/** 点列を、一定間隔（画素）の点に補間する */
function densify(poly: Pt[], step: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1];
    const b = poly[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  out.push(poly[poly.length - 1]);
  return out;
}

function distToPolyline(p: Pt, poly: Pt[]): number {
  let best = Infinity;
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1];
    const b = poly[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
  }
  return best;
}

/** 正解と検出結果の一致度。距離は「手のひら幅（人差し指〜小指の付け根）」を1とした比 */
function compare(gt: Pt[], det: Pt[], toPx: (p: Pt) => Pt, palmWidth: number) {
  const g = densify(gt.map(toPx), 2);
  const d = densify(det.map(toPx), 2);
  const tol = 0.1 * palmWidth;
  const gtCovered = g.filter((p) => distToPolyline(p, d) <= tol).length / g.length;
  const detOnGt = d.filter((p) => distToPolyline(p, g) <= tol).length / d.length;
  const mean = g.reduce((sum, p) => sum + distToPolyline(p, d), 0) / g.length / palmWidth;
  return { gtCovered, detOnGt, mean };
}

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

function drawCanon(canvas: HTMLCanvasElement, res: DetectionResult, showRidge: boolean, gt: GroundTruthLines | null) {
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
    // 探索範囲を、各点の「その線の範囲内か」で点描する（弧を描く線も含めて、どの定義方式でも描ける）
    ctx.fillStyle = COLORS[m.id] + '22';
    void m;
  }
  ctx.setLineDash([]);

  // 正解（白の点線）：写真上の座標 → 手の座標 → 標準の手のひら画像の座標
  if (gt) {
    const work = res.debug.work;
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    for (const pts of Object.values(gt)) {
      if (!pts) continue;
      ctx.beginPath();
      pts.forEach((p, i) => {
        const { a, d } = res.debug!.frame.toFrame({ x: (p.x / 1000) * work.width, y: (p.y / 1000) * work.height });
        const c = toCanon(a, d);
        if (i === 0) ctx.moveTo(c.x, c.y);
        else ctx.lineTo(c.x, c.y);
      });
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

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
      const gt = await loadGroundTruth(file.replace(/.[^.]+$/, ''));
      if (cancelled) return;
      if (canonRef.current) drawCanon(canonRef.current, res, showRidge, gt);
      const sx = canvas.width / res.debug.work.width;
      const sy = canvas.height / res.debug.work.height;
      if (gt) {
        // 正解（点線）：色は線の種類、太さを細くして検出結果（実線）と見分ける
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 2.5;
        for (const [id, pts] of Object.entries(gt)) {
          if (!pts) continue;
          ctx.strokeStyle = '#ffffff';
          ctx.beginPath();
          pts.forEach((p, i) => {
            const x = (p.x / 1000) * canvas.width;
            const y = (p.y / 1000) * canvas.height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();
          void id;
        }
        ctx.setLineDash([]);
      }
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
      // 正解との比較
      const work = res.debug.work;
      const toPx = (p: Pt): Pt => ({ x: (p.x / 1000) * work.width, y: (p.y / 1000) * work.height });
      const palmWidth = res.debug.frame.width;
      const rows: string[] = [];
      if (gt) {
        for (const id of ['heart', 'head', 'life', 'fate'] as const) {
          const g = gt[id];
          const d = res.lines.find((l) => l.id === id);
          if (g && d) {
            const m = compare(g, d.points, toPx, palmWidth);
            rows.push(`${LABELS[id]}: 正解の${Math.round(m.gtCovered * 100)}%を再現／検出の${Math.round(m.detOnGt * 100)}%が正解上／平均ずれ${m.mean.toFixed(2)}`);
          } else if (g) {
            rows.push(`${LABELS[id]}: 未検出`);
          } else if (d) {
            rows.push(`${LABELS[id]}: 正解なし（検出あり）`);
          }
        }
      }
      // 正解の線が、手の座標 (a: 小指側負・親指側正, d: 指の付け根0〜手首1) のどこにあるか（定義の調整用）
      const gtRows: string[] = [];
      if (gt) {
        const f = (p: Pt) => res.debug!.frame.toFrame(toPx(p));
        for (const id of ['heart', 'head', 'life', 'fate'] as const) {
          const g = gt[id];
          if (!g) continue;
          const q = g.map(f);
          const st = q[0];
          const en = q[q.length - 1];
          const as = q.map((v) => v.a);
          const ds = q.map((v) => v.d);
          gtRows.push(
            `${LABELS[id]}:始(${st.a.toFixed(2)},${st.d.toFixed(2)})→終(${en.a.toFixed(2)},${en.d.toFixed(2)}) a[${Math.min(...as).toFixed(2)},${Math.max(...as).toFixed(2)}] d[${Math.min(...ds).toFixed(2)},${Math.max(...ds).toFixed(2)}]`,
          );
        }
      }
      setInfo(
        `判定:${res.hand === 'left' ? '左手' : '右手'}(向き${res.debug.orientation.toFixed(2)}/MP:${res.debug.handedness}) → ${found || '採用された線なし'}${rows.length ? ' ｜ 【正解との比較】 ' + rows.join(' ／ ') : ''}${gtRows.length ? ' ｜ 【正解の手の座標】 ' + gtRows.join(' ／ ') : ''} ｜ 骨格a: 小指${res.debug.frame.refs.aPinky.toFixed(2)} 薬指${res.debug.frame.refs.aRing.toFixed(2)} 中指${res.debug.frame.refs.aMiddle.toFixed(2)} 人差指${res.debug.frame.refs.aIndex.toFixed(2)}`,
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

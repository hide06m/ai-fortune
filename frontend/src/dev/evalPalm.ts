/**
 * 手相の線検出の評価（開発専用）
 * dev-samples/ の全サンプルを検出し、利用者が描いた正解の線と比べて、集計を返す。
 * 一致の基準は、手のひら幅（人差し指〜小指の付け根）の 10% 以内。
 *   再現率：正解の線のうち、検出結果の近くにある部分の割合
 *   精度　：検出結果のうち、正解の線の近くにある部分の割合
 * ブラウザのコンソールや調整用ページから `await (await import('/src/dev/evalPalm.ts')).evaluateAll()` で呼べる
 */

import { detectPalmLines, ridgeTuning, type RidgeMode } from '../utils/palmDetect';
import { loadGroundTruth } from './groundTruth';
import type { Pt } from '../utils/palmLines';

const LINE_IDS = ['heart', 'head', 'life', 'fate'] as const;
const MAX_SAMPLES = 30;
const EXTENSIONS = ['png', 'webp', 'jpg', 'jpeg'];

export async function listSamples(): Promise<string[]> {
  const found: string[] = [];
  for (let n = 1; n <= MAX_SAMPLES; n++) {
    const labels = n < 10 ? [String(n), String(n).padStart(2, '0')] : [String(n)];
    for (const label of labels) {
      for (const ext of EXTENSIONS) {
        const name = `sample${label}.${ext}`;
        const res = await fetch(`/dev-samples/${name}`, { method: 'HEAD' }).catch(() => null);
        if (res && res.ok && (res.headers.get('content-type') ?? '').startsWith('image/')) {
          found.push(name);
          break;
        }
      }
    }
  }
  return found;
}

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

function dist(p: Pt, poly: Pt[]): number {
  let best = Infinity;
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1];
    const b = poly[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
  }
  return best;
}

export interface EvalSums {
  gtTotal: number;
  detected: number;
  /** 検出され、かつ正解と十分に重なった（再現率・精度とも60%以上）線の数 */
  correct: number;
  /** 検出されたが、正解とほとんど重ならない（誤った）線の数 */
  wrong: number;
  recallSum: number;
  precSum: number;
  extra: number;
}

/** 複数回に分けて評価した結果を合算して、集計の文字列にする */
export function combineSums(parts: EvalSums[]): EvalSummary['summary'] {
  const t = parts.reduce(
    (a, p) => ({ gtTotal: a.gtTotal + p.gtTotal, detected: a.detected + p.detected, correct: a.correct + p.correct, wrong: a.wrong + p.wrong, recallSum: a.recallSum + p.recallSum, precSum: a.precSum + p.precSum, extra: a.extra + p.extra }),
    { gtTotal: 0, detected: 0, correct: 0, wrong: 0, recallSum: 0, precSum: 0, extra: 0 },
  );
  return {
    gtTotal: t.gtTotal,
    detected: t.detected,
    detectRate: (t.detected / Math.max(1, t.gtTotal)).toFixed(2),
    correct: t.correct,
    wrong: t.wrong,
    meanRecallOverAll: (t.recallSum / Math.max(1, t.gtTotal)).toFixed(2),
    meanPrecisionOverDetected: (t.precSum / Math.max(1, t.detected)).toFixed(2),
    extraLines: t.extra,
  };
}

export interface EvalSummary {
  rows: string[];
  sums?: EvalSums;
  summary: {
    gtTotal: number;
    detected: number;
    detectRate: string;
    correct: number;
    wrong: number;
    meanRecallOverAll: string;
    meanPrecisionOverDetected: string;
    extraLines: number;
  };
  perLine: Record<string, string>;
}

export async function evaluateAll(files?: string[], tuning?: { mode?: RidgeMode; orientedScale?: number }): Promise<EvalSummary> {
  // 方式の指定は、この評価が読み込んだモジュールに直接反映する（別のコピーを触らないため）
  if (tuning?.mode) ridgeTuning.mode = tuning.mode;
  if (tuning?.orientedScale) ridgeTuning.orientedScale = tuning.orientedScale;
  const samples = files ?? (await listSamples());
  const rows: string[] = [];
  let gtTotal = 0;
  let detected = 0;
  let correct = 0;
  let wrong = 0;
  let recallSum = 0;
  let precSum = 0;
  let extra = 0;
  const per: Record<string, { n: number; det: number; rec: number }> = {};

  for (const f of samples) {
    const img = new Image();
    img.src = `/dev-samples/${f}`;
    await img.decode();
    const res = await detectPalmLines(img, { requiredHand: null });
    const gt = await loadGroundTruth(f.replace(/\.[^.]+$/, ''));
    if (!res.debug || !gt) {
      rows.push(`${f} (手または正解なし)`);
      continue;
    }
    const W = res.debug.work.width;
    const H = res.debug.work.height;
    const palmWidth = res.debug.frame.width;
    const toPx = (p: Pt): Pt => ({ x: (p.x / 1000) * W, y: (p.y / 1000) * H });
    const cells: string[] = [];
    for (const id of LINE_IDS) {
      const g = gt[id];
      const d = res.lines.find((l) => l.id === id);
      if (g) {
        gtTotal++;
        per[id] = per[id] ?? { n: 0, det: 0, rec: 0 };
        per[id].n++;
      }
      if (g && d) {
        const G = densify(g.map(toPx), 2);
        // 検出は、しわが確認できた区間だけ（途切れの間は含まない）
        const Ds = d.segments.map((s) => densify(s.map(toPx), 2));
        const D = Ds.flat();
        const tol = 0.1 * palmWidth;
        const rec = G.filter((p) => Ds.some((s) => dist(p, s) <= tol)).length / G.length;
        const prec = D.filter((p) => dist(p, G) <= tol).length / D.length;
        detected++;
        if (rec >= 0.6 && prec >= 0.6) correct++;
        else wrong++;
        recallSum += rec;
        precSum += prec;
        per[id].det++;
        per[id].rec += rec;
        cells.push(`${id[0]}:${Math.round(rec * 100)}/${Math.round(prec * 100)}`);
      } else if (g) {
        cells.push(`${id[0]}:-`);
      } else if (d) {
        extra++;
        cells.push(`${id[0]}:余`);
      }
    }
    rows.push(`${f.replace(/\.[^.]+$/, '')} ${cells.join(' ')}`);
  }

  return {
    rows,
    summary: {
      gtTotal,
      detected,
      detectRate: (detected / Math.max(1, gtTotal)).toFixed(2),
      correct,
      wrong,
      meanRecallOverAll: (recallSum / Math.max(1, gtTotal)).toFixed(2),
      meanPrecisionOverDetected: (precSum / Math.max(1, detected)).toFixed(2),
      extraLines: extra,
    },
    sums: { gtTotal, detected, correct, wrong, recallSum, precSum, extra },
    perLine: Object.fromEntries(
      Object.entries(per).map(([k, v]) => [k, `検出${v.det}/${v.n} 平均再現${(v.rec / Math.max(1, v.det)).toFixed(2)}`]),
    ),
  };
}

/** 1枚の評価結果（精度の確認ページ用）：線ごとの数値と、描画用の検出・正解の座標 */
export interface SampleReport {
  file: string;
  hasHand: boolean;
  lines: Array<{
    id: (typeof LINE_IDS)[number];
    /** 正解の線の座標（0〜1000）。無ければ null */
    gt: Pt[] | null;
    /** 検出された、しわが確認できた区間ごとの座標（0〜1000）。検出されなければ null */
    segments: Pt[][] | null;
    recall?: number;
    precision?: number;
    verdict: 'correct' | 'wrong' | 'missed' | 'extra' | 'none';
  }>;
}

export async function evaluateOne(file: string): Promise<SampleReport> {
  const img = new Image();
  img.src = `/dev-samples/${file}`;
  await img.decode();
  const res = await detectPalmLines(img, { requiredHand: null });
  const gt = await loadGroundTruth(file.replace(/\.[^.]+$/, ''));
  if (!res.debug) return { file, hasHand: false, lines: [] };
  const W = res.debug.work.width;
  const H = res.debug.work.height;
  const toPx = (p: Pt): Pt => ({ x: (p.x / 1000) * W, y: (p.y / 1000) * H });
  const lines: SampleReport['lines'] = [];
  for (const id of LINE_IDS) {
    const g = gt?.[id] ?? null;
    const d = res.lines.find((l) => l.id === id) ?? null;
    if (!g && !d) continue;
    let recall: number | undefined;
    let precision: number | undefined;
    let verdict: SampleReport['lines'][number]['verdict'] = 'none';
    if (g && d) {
      const G = densify(g.map(toPx), 2);
      const Ds = d.segments.map((s) => densify(s.map(toPx), 2));
      const tol = 0.1 * res.debug.frame.width;
      recall = G.filter((p) => Ds.some((s) => dist(p, s) <= tol)).length / G.length;
      precision = Ds.flat().filter((p) => dist(p, G) <= tol).length / Ds.flat().length;
      verdict = recall >= 0.6 && precision >= 0.6 ? 'correct' : 'wrong';
    } else if (g) verdict = 'missed';
    else verdict = 'extra';
    lines.push({ id, gt: g, segments: d ? d.segments : null, recall, precision, verdict });
  }
  return { file, hasHand: true, lines };
}

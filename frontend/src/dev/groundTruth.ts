/**
 * 手相の線検出を調整するための「正解の線」（開発専用）
 *
 * 利用者が、サンプル写真の上に色で描いた画像（public/dev-samples/annotated/converted/ に置く。git管理外）から、
 * 色ごとに線の道筋を取り出す。赤=感情線、青=頭脳線、緑=生命線、黄=運命線。
 * 道筋は、色の画素のうち最大のかたまりだけを使い、端から端までの距離順に並べ直して等間隔にそろえる。
 */

import type { Pt } from '../utils/palmLines';

export type GroundTruthLines = Partial<Record<'heart' | 'head' | 'life' | 'fate', Pt[]>>;

/** 色の判定（HSV）。肌の色や背景より彩度の高い、はっきりした色だけを拾う */
const COLOR_TESTS: Record<keyof Required<GroundTruthLines>, (h: number, s: number, v: number) => boolean> = {
  heart: (h, s, v) => (h < 14 || h > 345) && s > 0.75 && v > 0.6,
  fate: (h, s, v) => h >= 42 && h <= 68 && s > 0.7 && v > 0.65,
  life: (h, s, v) => h >= 75 && h <= 160 && s > 0.5 && v > 0.45,
  head: (h, s, v) => h >= 195 && h <= 255 && s > 0.6 && v > 0.55,
};

/**
 * 色と線の対応を入れ替える写真。サンプル5は、黄色が親指を囲む弧（生命線の形）、
 * 緑が手のひらの中ほどの縦の短い線（運命線の形）として描かれているため、入れ替えて扱う
 */
const SWAP_LIFE_FATE = new Set(['sample5']);

const NEIGHBORS: Array<[number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx ? d / mx : 0, mx];
}

function largestComponent(pts: Pt[], W: number): Pt[] {
  const key = (x: number, y: number) => y * W + x;
  const index = new Map<number, number>();
  pts.forEach((p, i) => index.set(key(p.x, p.y), i));
  const seen = new Uint8Array(pts.length);
  let best: number[] = [];
  for (let s = 0; s < pts.length; s++) {
    if (seen[s]) continue;
    const comp = [s];
    seen[s] = 1;
    for (let qi = 0; qi < comp.length; qi++) {
      const p = pts[comp[qi]];
      for (const [dx, dy] of NEIGHBORS) {
        const j = index.get(key(p.x + dx, p.y + dy));
        if (j !== undefined && !seen[j]) {
          seen[j] = 1;
          comp.push(j);
        }
      }
    }
    if (comp.length > best.length) best = comp;
  }
  return best.map((i) => pts[i]);
}

/** 8近傍グラフ上の距離（端点は二重スイープで決める）で並べ、同じ距離の点は平均する */
function orderPath(pts: Pt[], W: number): Pt[] {
  const key = (x: number, y: number) => y * W + x;
  const index = new Map<number, number>();
  pts.forEach((p, i) => index.set(key(p.x, p.y), i));
  const bfs = (start: number) => {
    const dist = new Int32Array(pts.length).fill(-1);
    const queue = [start];
    dist[start] = 0;
    let far = start;
    for (let qi = 0; qi < queue.length; qi++) {
      const i = queue[qi];
      const p = pts[i];
      for (const [dx, dy] of NEIGHBORS) {
        const j = index.get(key(p.x + dx, p.y + dy));
        if (j !== undefined && dist[j] < 0) {
          dist[j] = dist[i] + 1;
          queue.push(j);
          if (dist[j] > dist[far]) far = j;
        }
      }
    }
    return { dist, far };
  };
  const a = bfs(0);
  const b = bfs(a.far);
  const c = bfs(b.far);
  const bins = new Map<number, { x: number; y: number; n: number }>();
  pts.forEach((p, i) => {
    const d = c.dist[i];
    if (d < 0) return;
    const e = bins.get(d) ?? { x: 0, y: 0, n: 0 };
    e.x += p.x;
    e.y += p.y;
    e.n++;
    bins.set(d, e);
  });
  return [...bins.keys()]
    .sort((x, y) => x - y)
    .map((d) => {
      const e = bins.get(d)!;
      return { x: e.x / e.n, y: e.y / e.n };
    });
}

function resample(path: Pt[], n: number): Pt[] {
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
  const total = cum[cum.length - 1];
  const out: Pt[] = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const t = (total * k) / (n - 1);
    while (j < cum.length - 2 && cum[j + 1] < t) j++;
    const f = (t - cum[j]) / (cum[j + 1] - cum[j] || 1);
    out.push({ x: path[j].x * (1 - f) + path[j + 1].x * f, y: path[j].y * (1 - f) + path[j + 1].y * f });
  }
  return out;
}

const cache = new Map<string, Promise<GroundTruthLines | null>>();

/** サンプル名（例 "sample4"）の正解を読み込む。描いた画像が無ければ null */
export function loadGroundTruth(sample: string): Promise<GroundTruthLines | null> {
  if (!cache.has(sample)) {
    cache.set(
      sample,
      (async () => {
        const img = new Image();
        img.src = `/dev-samples/annotated/converted/${sample}.png`;
        try {
          await img.decode();
        } catch {
          return null;
        }
        const W = img.naturalWidth;
        const H = img.naturalHeight;
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, W, H).data;

        const per: Record<string, Pt[]> = { heart: [], head: [], life: [], fate: [] };
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            const [h, s, v] = rgbToHsv(data[i], data[i + 1], data[i + 2]);
            for (const k of Object.keys(COLOR_TESTS) as Array<keyof typeof COLOR_TESTS>) {
              if (COLOR_TESTS[k](h, s, v)) {
                per[k].push({ x, y });
                break;
              }
            }
          }
        }

        const out: GroundTruthLines = {};
        for (const k of Object.keys(per) as Array<keyof typeof COLOR_TESTS>) {
          if (per[k].length < 30) continue;
          const comp = largestComponent(per[k], W);
          if (comp.length < 30) continue;
          const path = resample(orderPath(comp, W), 48);
          out[k] = path.map((p) => ({ x: (p.x / W) * 1000, y: (p.y / H) * 1000 }));
        }
        if (SWAP_LIFE_FATE.has(sample)) {
          const life = out.life;
          out.life = out.fate;
          out.fate = life;
        }
        return out;
      })(),
    );
  }
  return cache.get(sample)!;
}

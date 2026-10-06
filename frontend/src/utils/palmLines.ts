/**
 * 手のひらの写真から「しわ（線）らしさ」を数値化する画像処理（外部ライブラリ不要）
 *   グレースケール → 照明ムラの除去 → 多重スケールのHessian（暗い線状構造の強調）
 *   ＋ 手のシルエット推定（輪郭の影を線と取り違えないため）
 * 線の定義に合う道筋の探索は palmSeam.ts、各線の定義は palmModels.ts
 */

export interface Pt {
  x: number;
  y: number;
}

export interface GrayImage {
  width: number;
  height: number;
  /** 0〜1 */
  data: Float32Array;
}

export function toGray(img: { data: ArrayLike<number>; width: number; height: number }): GrayImage {
  const { width, height } = img;
  const out = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = img.data[i * 4];
    const g = img.data[i * 4 + 1];
    const b = img.data[i * 4 + 2];
    out[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  return { width, height, data: out };
}

function gaussianKernel(sigma: number): Float32Array {
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const k = new Float32Array(radius * 2 + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k[i + radius] = v;
    sum += v;
  }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  return k;
}

/** 分離可能ガウシアンぼかし（端は端の値で延長） */
export function gaussianBlur(src: GrayImage, sigma: number): GrayImage {
  const { width, height } = src;
  const k = gaussianKernel(sigma);
  const r = (k.length - 1) / 2;
  const tmp = new Float32Array(width * height);
  const out = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) {
        const xx = Math.min(width - 1, Math.max(0, x + i));
        acc += src.data[y * width + xx] * k[i + r];
      }
      tmp[y * width + x] = acc;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) {
        const yy = Math.min(height - 1, Math.max(0, y + i));
        acc += tmp[yy * width + x] * k[i + r];
      }
      out[y * width + x] = acc;
    }
  }
  return { width, height, data: out };
}

/** 照明ムラを除く：大きくぼかした画像との差を、局所の明るさで割る */
export function normalizeIllumination(src: GrayImage, sigma = 18): GrayImage {
  const bg = gaussianBlur(src, sigma);
  const out = new Float32Array(src.data.length);
  for (let i = 0; i < out.length; i++) {
    out[i] = src.data[i] / Math.max(0.05, bg.data[i]);
  }
  return { width: src.width, height: src.height, data: out };
}

/** ridgeRaw の値のうち「はっきりした線」とみなす大きさ（合成画像と実写で調整する） */
export const RIDGE_FULL_SCALE = 0.06;

/**
 * 暗い線状構造（しわ）の強調（正規化前の生の値）。
 * Hessianの最大固有値が大きく、もう一方が小さい（＝点ではなく線）ほど高い
 */
export function ridgeRaw(src: GrayImage, sigmas: number[] = [1.5, 2.5, 3.5]): Float32Array {
  const { width, height } = src;
  const n = width * height;
  const best = new Float32Array(n);

  for (const sigma of sigmas) {
    const g = gaussianBlur(src, sigma).data;
    const s2 = sigma * sigma;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        const c = g[i];
        const ixx = g[i - 1] - 2 * c + g[i + 1];
        const iyy = g[i - width] - 2 * c + g[i + width];
        const ixy = (g[i + width + 1] - g[i + width - 1] - g[i - width + 1] + g[i - width - 1]) / 4;
        const mean = (ixx + iyy) / 2;
        const diff = Math.sqrt(((ixx - iyy) / 2) ** 2 + ixy * ixy);
        const l1 = mean + diff; // 大きい方
        const l2 = mean - diff;
        if (l1 <= 0) continue; // 暗い線は、断面方向の2階微分が正
        const ratio = Math.abs(l2) / l1; // 0に近いほど線らしい。1に近いと点（ほくろ・影）
        const lineness = Math.exp(-(ratio * ratio) / (2 * 0.5 * 0.5));
        const v = l1 * s2 * lineness;
        if (v > best[i]) best[i] = v;
      }
    }
  }

  return best;
}

/**
 * 線らしさを 0〜1 に正規化する。
 * 画像ごとの相対値（上位パーセンタイル）で割ると、線の無い画像でもノイズが「強い線」に見えてしまうので、
 * 照明補正後の画像で意味のある線のコントラスト（fullScale）を固定値で基準にする
 */
export function ridgeMap(src: GrayImage, sigmas?: number[], fullScale = RIDGE_FULL_SCALE): Float32Array {
  const raw = ridgeRaw(src, sigmas);
  const out = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = Math.min(1, raw[i] / fullScale);
  return out;
}

/** 移動平均で滑らかにし、等間隔の点数に間引く（SVG描画・座標の受け渡し用） */
export function smoothAndResample(path: Pt[], count = 40, window = 7): Pt[] {
  if (path.length <= 2) return path.slice();
  const half = Math.floor(window / 2);
  const smooth = path.map((_, i) => {
    let sx = 0;
    let sy = 0;
    let c = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(path.length - 1, i + half); j++) {
      sx += path[j].x;
      sy += path[j].y;
      c++;
    }
    return { x: sx / c, y: sy / c };
  });
  // 端点は元の位置に固定
  smooth[0] = path[0];
  smooth[smooth.length - 1] = path[path.length - 1];

  const out: Pt[] = [];
  for (let k = 0; k < count; k++) {
    const t = (k / (count - 1)) * (smooth.length - 1);
    const i0 = Math.floor(t);
    const i1 = Math.min(smooth.length - 1, i0 + 1);
    const f = t - i0;
    out.push({ x: smooth[i0].x * (1 - f) + smooth[i1].x * f, y: smooth[i0].y * (1 - f) + smooth[i1].y * f });
  }
  return out;
}

/**
 * 手のシルエットを推定する。手の色（骨格の点の色）と背景の色（画像の縁のうち手と違う色）の
 * 2色で画素を分け、縁につながる背景だけを背景とみなす（穴や小さな島は手の側に入れる）。
 * 手と背景が似た色で分けられないときは null を返す（その場合、輪郭の除外はしない）
 */
export function segmentHand(
  img: { data: ArrayLike<number>; width: number; height: number },
  handSamples: Pt[],
): Uint8Array | null {
  const { width: W, height: H, data } = img;
  const px = (x: number, y: number) => {
    const i = (Math.min(H - 1, Math.max(0, Math.round(y))) * W + Math.min(W - 1, Math.max(0, Math.round(x)))) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };

  // 手の色：骨格の各点の周囲3x3の平均
  const hand = [0, 0, 0];
  let hn = 0;
  for (const p of handSamples) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const c = px(p.x + dx, p.y + dy);
        hand[0] += c[0];
        hand[1] += c[1];
        hand[2] += c[2];
        hn++;
      }
    }
  }
  if (hn === 0) return null;
  hand[0] /= hn;
  hand[1] /= hn;
  hand[2] /= hn;

  const dist2 = (c: number[], m: number[]) => (c[0] - m[0]) ** 2 + (c[1] - m[1]) ** 2 + (c[2] - m[2]) ** 2;

  // 背景の色：縁の画素のうち、手の色から十分離れているものの平均
  const ring = 4;
  const bg = [0, 0, 0];
  let bn = 0;
  let ringTotal = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x >= ring && y >= ring && x < W - ring && y < H - ring) continue;
      ringTotal++;
      const c = px(x, y);
      if (dist2(c, hand) > 45 * 45) {
        bg[0] += c[0];
        bg[1] += c[1];
        bg[2] += c[2];
        bn++;
      }
    }
  }
  if (bn < ringTotal * 0.1) return null;
  bg[0] /= bn;
  bg[1] /= bn;
  bg[2] /= bn;
  if (dist2(hand, bg) < 30 * 30) return null;

  // 画素ごとに、手の色と背景の色のどちらに近いかで分ける
  const isBg = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const c = [data[i], data[i + 1], data[i + 2]];
      isBg[y * W + x] = dist2(c, bg) < dist2(c, hand) ? 1 : 0;
    }
  }

  // 縁につながっている背景だけを背景とみなす
  const outside = new Uint8Array(W * H);
  const stack: number[] = [];
  const seed = (x: number, y: number) => {
    const i = y * W + x;
    if (isBg[i] && !outside[i]) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < W; x++) {
    seed(x, 0);
    seed(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    seed(0, y);
    seed(W - 1, y);
  }
  while (stack.length > 0) {
    const i = stack.pop()!;
    const x = i % W;
    const y = (i - x) / W;
    if (x > 0) seed(x - 1, y);
    if (x < W - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < H - 1) seed(x, y + 1);
  }

  const mask = new Uint8Array(W * H);
  for (let i = 0; i < mask.length; i++) mask[i] = outside[i] ? 0 : 1;
  return mask;
}

/** 手のシルエットの縁から radius 画素以内の帯（背景に接する部分）を返す */
export function edgeBand(mask: Uint8Array, W: number, H: number, radius: number): Uint8Array {
  // 背景（mask=0）を radius だけ膨らませ、手の側に食い込んだ部分を帯とする（分離可能な最大値フィルタ）
  const tmp = new Uint8Array(W * H);
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = 0;
      for (let dx = -radius; dx <= radius && !v; dx++) {
        const xx = x + dx;
        if (xx >= 0 && xx < W && mask[y * W + xx] === 0) v = 1;
      }
      tmp[y * W + x] = v;
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = 0;
      for (let dy = -radius; dy <= radius && !v; dy++) {
        const yy = y + dy;
        if (yy >= 0 && yy < H && tmp[yy * W + x]) v = 1;
      }
      out[y * W + x] = v && mask[y * W + x] ? 1 : 0;
    }
  }
  return out;
}

/**
 * 向きを持った細長いフィルタによる「しわらしさ」（暗い線を強調する）。
 * 線の向きに沿って長く（sigmaAlong）、線をまたぐ向きに細く（sigmaAcross）平均を取る二次微分フィルタを、
 * 複数の向きで当てて、最も強い反応を使う。続いている薄い線は強まり、ばらばらの肌のきめは弱まる。
 * 値は raw（正規化前）。ridgeMap と同じ fullScale で 0〜1 にするには ridgeNormalize を使う
 */
export function ridgeOriented(
  src: GrayImage,
  options: { sigmaAcross?: number; sigmaAlong?: number; angles?: number; stride?: number } = {},
): Float32Array {
  const { width: W, height: H, data } = src;
  const sigmaAcross = options.sigmaAcross ?? 2.0;
  const sigmaAlong = options.sigmaAlong ?? 6.0;
  const angles = options.angles ?? 8;
  const stride = options.stride ?? 2;
  const radiusAlong = Math.ceil(2.5 * sigmaAlong);
  const radiusAcross = Math.ceil(3 * sigmaAcross);

  // 向きごとのフィルタ（通常の画素の位置と重み）を作る。重みの合計は 0（一様な明るさに反応しない）
  const kernels: Array<{ dx: Int16Array; dy: Int16Array; w: Float32Array }> = [];
  for (let k = 0; k < angles; k++) {
    const theta = (Math.PI * k) / angles;
    const cu = Math.cos(theta);
    const su = Math.sin(theta);
    const dxs: number[] = [];
    const dys: number[] = [];
    const ws: number[] = [];
    for (let u = -radiusAlong; u <= radiusAlong; u += stride) {
      const gu = Math.exp(-(u * u) / (2 * sigmaAlong * sigmaAlong));
      for (let v = -radiusAcross; v <= radiusAcross; v++) {
        // v: 線をまたぐ向き。中心が負・両側が正の「メキシカンハット」（暗い線で正の反応）
        const t = (v * v) / (sigmaAcross * sigmaAcross);
        const gv = (t - 1) * Math.exp(-t / 2);
        dxs.push(Math.round(u * cu - v * su));
        dys.push(Math.round(u * su + v * cu));
        ws.push(gu * gv);
      }
    }
    const mean = ws.reduce((s, x) => s + x, 0) / ws.length;
    let absSum = 0;
    for (let i = 0; i < ws.length; i++) {
      ws[i] -= mean;
      absSum += Math.abs(ws[i]);
    }
    for (let i = 0; i < ws.length; i++) ws[i] /= absSum / 2; // 正負の合計がそれぞれ約1になるように
    kernels.push({ dx: Int16Array.from(dxs), dy: Int16Array.from(dys), w: Float32Array.from(ws) });
  }

  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let best = 0;
      for (const kern of kernels) {
        let acc = 0;
        for (let i = 0; i < kern.w.length; i++) {
          const xx = Math.min(W - 1, Math.max(0, x + kern.dx[i]));
          const yy = Math.min(H - 1, Math.max(0, y + kern.dy[i]));
          acc += kern.w[i] * data[yy * W + xx];
        }
        if (acc > best) best = acc;
      }
      out[y * W + x] = best;
    }
  }
  return out;
}

/** raw の反応を、fullScale を 1 として 0〜1 に正規化する（画像ごとの相対化はしない） */
export function ridgeNormalize(raw: Float32Array, fullScale: number): Float32Array {
  const out = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = Math.min(1, raw[i] / fullScale);
  return out;
}

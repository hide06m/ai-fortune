/**
 * ミニゲーム共通の、描く道具（森ラン・どんぐりキャッチ…）
 * - 画面の細かさに合わせて、画像を、高画質に縮めて描く
 * - 絵の、透明な余白を除いた範囲
 * - ハートの図形、つなぎ目のないループ背景の並べ方
 * - ムスビの、コマごとの、大きさ・顔の位置の補正（musubi_scale.json）
 */

// 画面の細かさ（スマホは、画面の点が細かいので、2倍で描く）
export const RES = Math.min(2, Math.max(1, Math.ceil(window.devicePixelRatio || 1)));

/**
 * 画像を、画面に出す大きさまで、段階的に小さくして（半分ずつ）、高画質で縮める。
 * 元の画像は、大きすぎるので、そのまま縮めて描くと、ざらざらに見える。
 * 同じ大きさのものは、1回だけ作って、使い回す。
 */
const scaledCache = new WeakMap<HTMLImageElement, Map<string, HTMLCanvasElement>>();

export function scaled(img: HTMLImageElement, sx: number, sy: number, sw: number, sh: number, dw: number, dh: number): HTMLCanvasElement | HTMLImageElement {
  const tw = Math.max(1, Math.round(dw * RES));
  const th = Math.max(1, Math.round(dh * RES));
  if (!img.naturalWidth) return img;
  let map = scaledCache.get(img);
  if (!map) {
    map = new Map();
    scaledCache.set(img, map);
  }
  const key = `${sx},${sy},${sw},${sh},${tw},${th}`;
  const hit = map.get(key);
  if (hit) return hit;
  // 元の絵から、必要な範囲を切り出す
  let cur = document.createElement('canvas');
  cur.width = sw;
  cur.height = sh;
  let cx = cur.getContext('2d')!;
  cx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  // 半分ずつ、小さくする
  while (cur.width / 2 >= tw && cur.height / 2 >= th) {
    const next = document.createElement('canvas');
    next.width = Math.ceil(cur.width / 2);
    next.height = Math.ceil(cur.height / 2);
    cx = next.getContext('2d')!;
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(cur, 0, 0, next.width, next.height);
    cur = next;
  }
  const out = document.createElement('canvas');
  out.width = tw;
  out.height = th;
  cx = out.getContext('2d')!;
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(cur, 0, 0, tw, th);
  map.set(key, out);
  return out;
}

/** 画像の一部（sx,sy,sw,sh）を、(x,y) に、大きさ w×h で描く */
export function dI(ctx: CanvasRenderingContext2D, img: HTMLImageElement, sx: number, sy: number, sw: number, sh: number, x: number, y: number, w: number, h: number) {
  ctx.drawImage(scaled(img, sx, sy, sw, sh, w, h), x, y, w, h);
}

/** 画像の全体を、(x,y) に、大きさ w×h で描く */
export function dFull(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  if (!img.naturalWidth) return;
  dI(ctx, img, 0, 0, img.naturalWidth, img.naturalHeight, x, y, w, h);
}

export interface Box {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}
/** 絵の、透明な余白を除いた範囲（余白があると、障害物が、地面から浮いて見えるため） */
export const boxes: Record<string, Box> = {};

export function opaqueBox(img: HTMLImageElement): Box {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return { sx: 0, sy: 0, sw: w || 1, sh: h || 1 };
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d')!;
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      if (d[(yy * w + xx) * 4 + 3] > 40) {
        if (xx < minX) minX = xx;
        if (xx > maxX) maxX = xx;
        if (yy < minY) minY = yy;
        if (yy > maxY) maxY = yy;
      }
    }
  }
  if (maxX < minX) return { sx: 0, sy: 0, sw: w, sh: h };
  return { sx: minX, sy: minY, sw: maxX - minX + 1, sh: maxY - minY + 1 };
}

/** ハートの図形（文字の「♥」は、スマホで、絵文字になり、色がかえられないので、線で描く） */
export function heartPath(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath();
  ctx.moveTo(0, s * 0.38);
  ctx.bezierCurveTo(s * 0.7, -s * 0.02, s * 0.4, -s * 0.62, 0, -s * 0.2);
  ctx.bezierCurveTo(-s * 0.4, -s * 0.62, -s * 0.7, -s * 0.02, 0, s * 0.38);
  ctx.closePath();
}

/**
 * つなぎ目を混ぜてある絵（_loop）を、反転せずに、そのまま、横に並べる
 * 並べる位置は、「1枚の幅の、整数倍」で、きっちり、決める（小数のまま、1枚ずつ別々に丸めると、つなぎ目が、1コマごとに、1pxずつ揺れて、震えて見える）
 */
export function drawLoopPlain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, offset: number, y: number, w: number, h: number, viewW = 540) {
  if (!img.naturalWidth) return;
  const unit = 1 / RES; // 画面の1点の大きさ
  const tw = Math.max(unit, Math.round(w / unit) * unit); // 1枚の幅（画面の点にそろえる）
  const shift = Math.round((((offset % tw) + tw) % tw) / unit) * unit; // 動かした量（画面の点にそろえる）
  for (let i = 0, x = -shift; x < viewW && i < 40; i++, x = -shift + i * tw) dFull(ctx, img, x, y, tw + unit, h);
}

/** コマごとの、大きさの倍率（tools/musubi_sizes.py が作る）。頭の大きさを、そろえるため */
export const sizeAdj: Record<string, { a: number; fx: number }> = {};

/** 画像を、名前の一覧から、まとめて読みこむ（読めない絵があっても、止まらない） */
export function loadImageList(base: string, names: string[]): Promise<Record<string, HTMLImageElement>> {
  return Promise.all(
    names.map(
      (name) =>
        new Promise<[string, HTMLImageElement]>((resolve) => {
          const img = new Image();
          img.onload = () => resolve([name, img]);
          img.onerror = () => resolve([name, img]);
          img.src = `${base}${name}.png`;
        })
    )
  ).then((pairs) => Object.fromEntries(pairs));
}

/** ムスビの、コマごとの補正（musubi_scale.json）を読みこむ */
export function loadMusubiScale(base: string): Promise<void> {
  return fetch(`${base}musubi_scale.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .then((j) => {
      Object.assign(sizeAdj, j);
    })
    .catch(() => {});
}

/**
 * どんぐりキャッチ：木から落ちてくるどんぐりを、ムスビが、左右に動いて、受けとめる。
 * 赤いキノコ（毒）に当たると、ハートが減る。時間内に、目標の数を集めたらクリア。
 */

import { dFull, boxes, opaqueBox, sizeAdj, drawLoopPlain } from './canvasUtil';
import type { Difficulty, GameApi, Images, InputState, MiniGameSpec } from './MiniGameShell';

const W = 540;
const H = 960;
const GY = 730;
const MUSUBI_H = 132;
const MUSUBI_SINK = 12;
const FACE_DX = 26;
const CATCH_HALF = 62; // 受けとめられる、横の幅（ムスビの中心から）
const RUN_FRAMES = Array.from({ length: 4 }, (_, i) => `musubi_walk_${String(i + 1).padStart(2, '0')}`);

interface Conf {
  target: number; // 集める点数
  timeLimit: number; // 秒
  interval: number; // 落ちてくる間隔（秒）
  fall: number; // 落ちる速さ（px/秒）
  poison: number; // キノコの割合
  gold: number; // 金のどんぐりの割合
  big: number; // 大きいどんぐりの割合
  speed: number; // ムスビの最高速（px/秒）
}
const CONF: Record<Difficulty, Conf> = {
  easy: { target: 12, timeLimit: 45, interval: 0.95, fall: 250, poison: 0.1, gold: 0.05, big: 0.2, speed: 520 },
  normal: { target: 20, timeLimit: 45, interval: 0.78, fall: 320, poison: 0.2, gold: 0.06, big: 0.2, speed: 520 },
  hard: { target: 30, timeLimit: 45, interval: 0.62, fall: 400, poison: 0.28, gold: 0.07, big: 0.2, speed: 540 },
  extra: { target: 42, timeLimit: 45, interval: 0.5, fall: 480, poison: 0.34, gold: 0.08, big: 0.22, speed: 560 },
};

type ItemKind = 'acorn' | 'acorn_big' | 'acorn_gold' | 'mushroom';
interface Item {
  kind: ItemKind;
  img: string;
  x: number;
  y: number;
  w: number;
  h: number;
  vy: number;
  spin: number;
  rot: number;
  dead: boolean;
}
const POINTS: Record<ItemKind, number> = { acorn: 1, acorn_big: 3, acorn_gold: 5, mushroom: 0 };
const SIZE: Record<ItemKind, number> = { acorn: 50, acorn_big: 68, acorn_gold: 58, mushroom: 62 };

interface Pop {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
}

export interface AcornState {
  x: number;
  dir: 1 | -1;
  moving: boolean;
  anim: number;
  items: Item[];
  spawnTimer: number;
  score: number;
  elapsed: number;
  hitTimer: number;
  catchTimer: number;
  pops: Pop[];
  seed: number;
  conf: Conf;
}

function rand(s: AcornState) {
  // 小さな乱数（遊ぶたびに変わっても、よい）
  s.seed = (s.seed * 1664525 + 1013904223) >>> 0;
  return s.seed / 4294967296;
}

function spawn(s: AcornState, imgs: Images) {
  const c = s.conf;
  const r = rand(s);
  let kind: ItemKind;
  if (r < c.poison) kind = 'mushroom';
  else if (r < c.poison + c.gold) kind = 'acorn_gold';
  else if (r < c.poison + c.gold + c.big) kind = 'acorn_big';
  else kind = 'acorn';
  const img = kind === 'mushroom' ? `run_mushroom_${1 + Math.floor(rand(s) * 3)}` : kind;
  const im = imgs[img];
  const h = SIZE[kind];
  const w = im && im.naturalWidth ? h * (im.naturalWidth / im.naturalHeight) : h;
  const x = 40 + rand(s) * (W - 80);
  s.items.push({ kind, img, x, y: -h, w, h, vy: c.fall * (0.9 + rand(s) * 0.25), spin: (rand(s) - 0.5) * 2, rot: 0, dead: false });
}

function init(diff: Difficulty, imgs: Images): AcornState {
  for (const n of ['acorn', 'acorn_big', 'acorn_gold', 'run_mushroom_1', 'run_mushroom_2', 'run_mushroom_3']) {
    if (imgs[n] && imgs[n].naturalWidth && !boxes[n]) boxes[n] = opaqueBox(imgs[n]);
  }
  const st: AcornState = {
    x: W / 2,
    dir: 1,
    moving: false,
    anim: 0,
    items: [],
    spawnTimer: 0.6,
    score: 0,
    elapsed: 0,
    hitTimer: 0,
    catchTimer: 0,
    pops: [],
    seed: (Date.now() ^ 0x9e3779b9) >>> 0,
    conf: CONF[diff],
  };
  if (import.meta.env.DEV) (window as unknown as { __acorn?: AcornState }).__acorn = st; // 開発用：自動操縦のテストで、状態を読む
  return st;
}

function update(s: AcornState, dt: number, api: GameApi, input: InputState, diff: Difficulty, imgs: Images) {
  const c = CONF[diff];
  s.conf = c;
  s.elapsed += dt;
  s.anim += dt;

  // ムスビの移動：指（マウス）の位置へ、向かう。キーでも、動かせる
  let move = 0;
  if (input.left && !input.right) move = -c.speed * 0.85 * dt;
  else if (input.right && !input.left) move = c.speed * 0.85 * dt;
  else if (input.pointerX !== null) {
    const diffX = input.pointerX - s.x;
    const step = c.speed * dt;
    move = Math.abs(diffX) <= step ? diffX : Math.sign(diffX) * step;
  }
  s.moving = Math.abs(move) > 0.5;
  if (move) s.dir = move > 0 ? 1 : -1;
  s.x = Math.max(50, Math.min(W - 50, s.x + move));

  // 落ちてくる
  s.spawnTimer -= dt;
  while (s.spawnTimer <= 0) {
    s.spawnTimer += c.interval * (0.8 + Math.random() * 0.4);
    spawn(s, imgs);
  }
  if (s.hitTimer > 0) s.hitTimer -= dt;
  if (s.catchTimer > 0) s.catchTimer -= dt;

  const headY = GY - MUSUBI_H + 10;
  for (const it of s.items) {
    if (it.dead) continue;
    it.y += it.vy * dt;
    it.rot += it.spin * dt;
    // ムスビの頭・肩のあたりに来たら、受けとめる
    const cy = it.y + it.h / 2;
    if (cy >= headY && cy <= GY - 20 && Math.abs(it.x - s.x) < CATCH_HALF) {
      it.dead = true;
      if (it.kind === 'mushroom') {
        api.hurt();
        s.hitTimer = 0.5;
        s.pops.push({ x: it.x, y: headY - 10, text: '✕', color: '#ff6b6b', t: 0 });
      } else {
        const p = POINTS[it.kind];
        s.score += p;
        s.catchTimer = 0.25;
        s.pops.push({ x: it.x, y: headY - 10, text: `+${p}`, color: it.kind === 'acorn_gold' ? '#ffd84a' : '#fff4d0', t: 0 });
      }
    } else if (it.y + it.h > GY + 6) {
      it.dead = true; // 落ちてしまった（どんぐりを逃しても、ペナルティはない）
    }
  }
  s.items = s.items.filter((i) => !i.dead);
  for (const p of s.pops) p.t += dt;
  s.pops = s.pops.filter((p) => p.t < 0.7);

  api.setProgress(s.score / c.target);
  if (s.score >= c.target) api.clear();
  else if (s.elapsed >= c.timeLimit) api.fail();
}

function draw(ctx: CanvasRenderingContext2D, s: AcornState, imgs: Images, info: { phase: string; time: number; lives: number; lostFlash: number }) {
  const sky = imgs['runbg_sky'];
  if (sky && sky.naturalWidth) {
    const k = Math.max(W / sky.naturalWidth, H / sky.naturalHeight);
    dFull(ctx, sky, (W - sky.naturalWidth * k) / 2, 0, sky.naturalWidth * k, sky.naturalHeight * k);
  }
  const t = s.anim;
  const far = imgs['runbg_far_loop'];
  if (far && far.naturalWidth) drawLoopPlain(ctx, far, t * 4, GY - 435, 700 * (far.naturalWidth / far.naturalHeight) * (768 / 1376), 700 * (768 / 1376));
  const mid = imgs['runbg_mid2_loop'];
  if (mid && mid.naturalWidth) drawLoopPlain(ctx, mid, t * 10, GY - 210, 250 * (mid.naturalWidth / mid.naturalHeight), 250);

  const gr = imgs['run_ground_loop'];
  if (gr && gr.naturalWidth) {
    const gh = H - GY + 8;
    drawLoopPlain(ctx, gr, 0, GY - 4, gh * (gr.naturalWidth / gr.naturalHeight), gh);
  }

  // 落ちてくるもの
  for (const it of s.items) {
    const im = imgs[it.img];
    if (!im || !im.naturalWidth) continue;
    const b = boxes[it.img];
    ctx.save();
    ctx.translate(it.x, it.y + it.h / 2);
    ctx.rotate(it.rot * 0.5);
    if (b) {
      ctx.drawImage(im, b.sx, b.sy, b.sw, b.sh, -it.w / 2, -it.h / 2, it.w, it.h);
    } else {
      dFull(ctx, im, -it.w / 2, -it.h / 2, it.w, it.h);
    }
    ctx.restore();
  }

  // ムスビ
  let name: string;
  if (info.phase === 'clear') name = 'musubi_cheer_front_1';
  else if (info.phase === 'miss') name = 'musubi_sad_front';
  else if (s.hitTimer > 0) name = 'musubi_hit_right';
  else name = RUN_FRAMES[Math.floor(s.moving ? s.anim * 10 : 0) % RUN_FRAMES.length];
  const mi = imgs[name];
  if (mi && mi.naturalWidth) {
    const isWalk = name.startsWith('musubi_walk');
    const sc = (isWalk ? (MUSUBI_H / 290) * (300 / mi.naturalWidth) : MUSUBI_H / 945) * (sizeAdj[name]?.a ?? 1);
    const mw = mi.naturalWidth * sc;
    const mh = mi.naturalHeight * sc;
    if (!boxes[name]) boxes[name] = opaqueBox(mi);
    const b = boxes[name];
    const footY = isWalk ? mi.naturalHeight * (360 / 380) * sc : b ? (b.sy + b.sh) * sc : mh;
    const faceX = sizeAdj[name]?.fx;
    const left = faceX !== undefined ? FACE_DX - faceX * mw : -mw / 2;
    const flip = s.dir === -1 && name !== 'musubi_cheer_front_1' && name !== 'musubi_sad_front';
    ctx.save();
    ctx.translate(s.x, 0);
    if (flip) ctx.scale(-1, 1);
    // 受けとめたとき、ちょっと、はずむ
    const bounce = s.catchTimer > 0 ? -Math.sin((s.catchTimer / 0.25) * Math.PI) * 6 : 0;
    dFull(ctx, mi, left, GY - footY + MUSUBI_SINK + bounce, mw, mh);
    ctx.restore();
  }

  // +点の表示
  ctx.font = '900 30px "Zen Maru Gothic", sans-serif';
  ctx.textAlign = 'center';
  for (const p of s.pops) {
    ctx.globalAlpha = 1 - p.t / 0.7;
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(40,20,10,0.8)';
    ctx.strokeText(p.text, p.x, p.y - p.t * 60);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y - p.t * 60);
  }
  ctx.globalAlpha = 1;

  // 点数と残り時間
  const left = Math.max(0, Math.ceil(s.conf.timeLimit - s.elapsed));
  ctx.textAlign = 'left';
  ctx.font = '900 26px "Zen Maru Gothic", sans-serif';
  const label = `${s.score} / ${s.conf.target}　のこり ${left}秒`;
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(40,20,10,0.85)';
  ctx.strokeText(label, 24, 176);
  ctx.fillStyle = '#fff4d0';
  ctx.fillText(label, 24, 176);
  ctx.textAlign = 'start';
}

export const acornCatchSpec: MiniGameSpec<AcornState> = {
  game: 'acorn_catch',
  storageKey: 'acornCatchDifficulty',
  imageNames: [
    'acorn',
    'acorn_big',
    'acorn_gold',
    'run_mushroom_1',
    'run_mushroom_2',
    'run_mushroom_3',
    ...RUN_FRAMES,
    'musubi_hit_right',
    'musubi_cheer_front_1',
    'musubi_sad_front',
    'runbg_sky',
    'runbg_far_loop',
    'runbg_mid2_loop',
    'run_ground_loop',
  ],
  lives: { easy: 4, normal: 3, hard: 2, extra: 1 },
  hint: '落ちてくる どんぐりを うけとめよう。赤いキノコは さけてね',
  pcHint: 'ゆびを おいた方へ うごく ／ ← → キーでも うごく',
  init,
  update,
  draw: (ctx, s, imgs, info) => draw(ctx, s, imgs, info),
};

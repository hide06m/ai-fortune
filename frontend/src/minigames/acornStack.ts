/**
 * どんぐり積み：ゆれているどんぐりを、タップで落として、切り株の上に積んでいく。
 * 下のどんぐりに、うまく重ねられないと、落ちてハートが減る。目標の数まで積んだらクリア。
 */

import { ACORN_STACK_HOWTO } from '../components/MiniGameHowTo';
import { dFull, boxes, opaqueBox, drawLoopPlain } from './canvasUtil';
import { playSe, preloadSe } from '../sound';
import type { Difficulty, GameApi, Images, InputState, MiniGameSpec } from './MiniGameShell';

const W = 540;
const H = 960;
const GROUND_Y = 600; // 積みはじめの、切り株の上の高さ（積むほど、画面が下がる）
const STUMP_VIS = 130; // 切り株の、見える高さ
const BH = 84; // どんぐり1つの、見た目の高さ
const STEP = 58; // 1つ積むごとの、高さ
const HANG = 230; // ゆれるどんぐりと、塔のてっぺんの、はなれ
const SWING_AMP = 170;
const GRAVITY = 2600;
const PERFECT = 9; // これ以内のずれは「ぴったり」
const STUMP_W = 250;

interface Conf {
  target: number;
  tol: number; // 重ねられる、横のずれ（片側）
  omega: number; // ゆれる速さ（rad/秒）
}
const CONF: Record<Difficulty, Conf> = {
  easy: { target: 8, tol: 74, omega: 2.0 },
  normal: { target: 12, tol: 62, omega: 2.5 },
  hard: { target: 15, tol: 54, omega: 3.0 },
  extra: { target: 18, tol: 46, omega: 3.5 },
};

interface Piece {
  x: number;
  rot: number;
}
interface Falling {
  x: number;
  y: number; // 画面ではなく、塔の座標（上に行くほど小さい）
  vy: number;
  vx: number;
  rot: number;
  spin: number;
  landed: boolean;
}
interface Pop {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
}

export interface StackState {
  conf: Conf;
  pieces: Piece[]; // 積んだもの（切り株の上から）
  swingT: number;
  swingX: number;
  drop: Falling | null;
  lost: Falling[];
  cooldown: number;
  camY: number;
  pops: Pop[];
  combo: number;
  shake: number;
  anim: number;
}

const topX = (s: StackState) => (s.pieces.length ? s.pieces[s.pieces.length - 1].x : W / 2);
// 次の1つが、おさまる高さ（塔の座標：地面が 0、上が マイナス）
const nextY = (s: StackState) => -(s.pieces.length + 1) * STEP;
const camTarget = (s: StackState) => GROUND_Y + Math.max(0, s.pieces.length - 4) * STEP;
const swingCenter = (s: StackState) => Math.max(SWING_AMP + 50, Math.min(W - SWING_AMP - 50, topX(s)));

function init(diff: Difficulty, imgs: Images): StackState {
  preloadSe(['run_land', 'acorn_big', 'acorn_miss', 'acorn_gold']);
  for (const n of ['acorn', 'run_stump_l']) {
    if (imgs[n] && imgs[n].naturalWidth && !boxes[n]) boxes[n] = opaqueBox(imgs[n]);
  }
  const s: StackState = {
    conf: CONF[diff],
    pieces: [],
    swingT: 0,
    swingX: W / 2,
    drop: null,
    lost: [],
    cooldown: 0.2,
    camY: GROUND_Y,
    pops: [],
    combo: 0,
    shake: 0,
    anim: 0,
  };
  return s;
}

function update(s: StackState, dt: number, api: GameApi, input: InputState, diff: Difficulty) {
  const c = CONF[diff];
  s.conf = c;
  s.anim += dt;
  const k = s.pieces.length;
  const taps = input.taps;
  input.taps = 0;

  // 画面（カメラ）を、なめらかに動かす
  s.camY += (camTarget(s) - s.camY) * Math.min(1, dt * 6);
  if (s.shake > 0) s.shake -= dt;

  // ゆれるどんぐり：積むほど、少しずつ、速くなる
  const omega = c.omega * Math.min(1.6, 1 + 0.035 * k);
  s.swingT += dt * omega;
  s.swingX = swingCenter(s) + Math.sin(s.swingT) * SWING_AMP;

  if (s.cooldown > 0) s.cooldown -= dt;
  if (!s.drop && s.cooldown <= 0 && taps > 0) {
    s.drop = { x: s.swingX, y: nextY(s) - HANG, vy: 0, vx: 0, rot: 0, spin: 0, landed: false };
  }

  const d = s.drop;
  if (d) {
    d.vy += GRAVITY * dt;
    d.y += d.vy * dt;
    d.x += d.vx * dt;
    d.rot += d.spin * dt;
    const target = nextY(s);
    if (!d.landed && d.vx === 0 && d.y >= target) {
      const dx = d.x - topX(s);
      const tol = k === 0 ? Math.max(c.tol, STUMP_W / 2 - 30) : c.tol;
      if (Math.abs(dx) <= tol) {
        // 積めた
        const perfect = Math.abs(dx) <= PERFECT;
        const px = perfect ? topX(s) : d.x;
        s.pieces.push({ x: px, rot: perfect ? 0 : Math.max(-0.25, Math.min(0.25, (dx / tol) * 0.25)) });
        s.drop = null;
        s.cooldown = 0.12;
        if (perfect) {
          s.combo += 1;
          playSe('acorn_big');
          s.pops.push({ x: px, y: 0, text: s.combo >= 2 ? `ぴったり！ ×${s.combo}` : 'ぴったり！', color: '#ffd84a', t: 0 });
        } else {
          s.combo = 0;
          playSe('run_land');
        }
        api.setProgress(s.pieces.length / c.target);
        if (s.pieces.length >= c.target) api.clear();
      } else {
        // ずれすぎて、すべり落ちる
        d.landed = true;
        d.vx = Math.sign(dx) * 170;
        d.spin = Math.sign(dx) * 5;
        d.vy = -260;
        s.combo = 0;
        s.shake = 0.25;
        playSe('acorn_miss');
        api.hurt();
        s.lost.push(d);
        s.drop = null;
        s.cooldown = 0.6;
      }
    }
  }
  for (const f of s.lost) {
    f.vy += GRAVITY * dt;
    f.y += f.vy * dt;
    f.x += f.vx * dt;
    f.rot += f.spin * dt;
  }
  s.lost = s.lost.filter((f) => f.y < 900);
  for (const p of s.pops) p.t += dt;
  s.pops = s.pops.filter((p) => p.t < 0.8);
}

function drawAcorn(ctx: CanvasRenderingContext2D, imgs: Images, x: number, sy: number, rot: number) {
  const im = imgs['acorn'];
  if (!im || !im.naturalWidth) return;
  const b = boxes['acorn'];
  const w = b ? BH * (b.sw / b.sh) : BH;
  ctx.save();
  ctx.translate(x, sy);
  ctx.rotate(rot);
  if (b) ctx.drawImage(im, b.sx, b.sy, b.sw, b.sh, -w / 2, -BH / 2, w, BH);
  else dFull(ctx, im, -w / 2, -BH / 2, w, BH);
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, s: StackState, imgs: Images, info: { phase: string; time: number; lives: number; lostFlash: number }) {
  const sky = imgs['runbg_sky'];
  if (sky && sky.naturalWidth) {
    const k = Math.max(W / sky.naturalWidth, H / sky.naturalHeight);
    dFull(ctx, sky, (W - sky.naturalWidth * k) / 2, 0, sky.naturalWidth * k, sky.naturalHeight * k);
  }
  const drop = s.camY - GROUND_Y; // どれだけ、画面が下がったか
  ctx.save();
  if (s.shake > 0) ctx.translate((Math.random() - 0.5) * 8 * (s.shake / 0.25), 0);
  const far = imgs['runbg_far_loop'];
  if (far && far.naturalWidth) drawLoopPlain(ctx, far, 0, GROUND_Y + STUMP_VIS - 6 - 435 + drop * 0.25, 700 * (far.naturalWidth / far.naturalHeight) * (768 / 1376), 700 * (768 / 1376));
  const mid = imgs['runbg_mid2_loop'];
  if (mid && mid.naturalWidth) drawLoopPlain(ctx, mid, 0, GROUND_Y + STUMP_VIS - 6 - 210 + drop * 0.6, 250 * (mid.naturalWidth / mid.naturalHeight), 250);
  const gr = imgs['run_ground_loop'];
  const groundTop = s.camY + STUMP_VIS - 6;
  if (gr && gr.naturalWidth) {
    const gh = H - GROUND_Y + 8;
    drawLoopPlain(ctx, gr, 0, groundTop, gh * (gr.naturalWidth / gr.naturalHeight), gh);
  }

  // 切り株（高い切り株の、上のほうだけを使う）
  const st = imgs['run_stump_l'];
  if (st && st.naturalWidth) {
    const b = boxes['run_stump_l'];
    const sx = b ? b.sx : 0;
    const sy = b ? b.sy : 0;
    const sw = b ? b.sw : st.naturalWidth;
    const sh = b ? b.sh : st.naturalHeight;
    const k = STUMP_W / sw; // 画面の長さ ÷ 元の長さ
    const cropH = Math.min(sh, (STUMP_VIS + 14) / k);
    ctx.drawImage(st, sx, sy, sw, cropH, W / 2 - STUMP_W / 2, s.camY - 14, STUMP_W, cropH * k);
  }

  // 積んだどんぐり
  s.pieces.forEach((p, i) => drawAcorn(ctx, imgs, p.x, s.camY - (i + 1) * STEP + 8, p.rot));
  for (const f of s.lost) drawAcorn(ctx, imgs, f.x, s.camY + f.y, f.rot);

  // ゆれるどんぐり（ひもつき）か、落ちているどんぐり
  const d = s.drop;
  if (d) {
    drawAcorn(ctx, imgs, d.x, s.camY + d.y + 8, d.rot);
  } else if (info.phase !== 'clear') {
    const hy = s.camY + nextY(s) - HANG + 8;
    ctx.strokeStyle = 'rgba(70, 45, 25, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(s.swingX, 205);
    ctx.lineTo(s.swingX, Math.max(205, hy - BH / 2 + 6));
    ctx.stroke();
    drawAcorn(ctx, imgs, s.swingX, Math.max(250, hy), Math.sin(s.swingT) * 0.15);
  }
  ctx.restore();

  // ムスビ（画面の下のほうで、見守る）
  const nm = info.phase === 'clear' ? 'musubi_cheer_front_1' : info.phase === 'miss' || info.lostFlash > 0 ? 'musubi_sad_front' : 'musubi_idle_right';
  const mi = imgs[nm];
  if (mi && mi.naturalWidth) {
    if (!boxes[nm]) boxes[nm] = opaqueBox(mi);
    const b = boxes[nm];
    const sc = 120 / 945;
    const mw = mi.naturalWidth * sc;
    const mh = mi.naturalHeight * sc;
    const footY = b ? (b.sy + b.sh) * sc : mh;
    dFull(ctx, mi, 74 - mw / 2, H - 28 - footY, mw, mh);
  }

  // ぴったりの表示
  ctx.font = '900 32px "Zen Maru Gothic", sans-serif';
  ctx.textAlign = 'center';
  for (const p of s.pops) {
    const top = s.pieces.length ? topX(s) : W / 2;
    const y = s.camY - s.pieces.length * STEP - 60 - p.t * 50;
    ctx.globalAlpha = 1 - p.t / 0.8;
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(40,20,10,0.85)';
    ctx.strokeText(p.text, Math.max(110, Math.min(W - 110, top)), y);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, Math.max(110, Math.min(W - 110, top)), y);
  }
  ctx.globalAlpha = 1;

  // つんだ数
  ctx.textAlign = 'left';
  ctx.font = '900 26px "Zen Maru Gothic", sans-serif';
  const label = `${s.pieces.length} / ${s.conf.target}　こ つんだ`;
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(40,20,10,0.85)';
  ctx.strokeText(label, 24, 176);
  ctx.fillStyle = '#fff4d0';
  ctx.fillText(label, 24, 176);
  ctx.textAlign = 'start';
}

export const acornStackSpec: MiniGameSpec<StackState> = {
  game: 'acorn_stack',
  storageKey: 'acornStackDifficulty',
  bgm: 'bgm_acorn',
  imageNames: [
    'acorn',
    'run_stump_l',
    'musubi_idle_right',
    'musubi_cheer_front_1',
    'musubi_sad_front',
    'runbg_sky',
    'runbg_far_loop',
    'runbg_mid2_loop',
    'run_ground_loop',
  ],
  lives: { easy: 4, normal: 3, hard: 2, extra: 1 },
  hint: 'ゆれる どんぐりを タップで おとして つみあげよう',
  pcHint: 'クリック か スペースキーで おとす',
  howTo: ACORN_STACK_HOWTO,
  init,
  update: (s, dt, api, input, diff) => update(s, dt, api, input, diff),
  draw: (ctx, s, imgs, info) => draw(ctx, s, imgs, info),
};

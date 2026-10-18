/**
 * ムスビの森ラン（待ち時間ミニゲーム・試作）：ワンタップ（スペース／↑）でジャンプして、障害物をよけながらゴールまで走る
 * 画面は、縦長 9:16 の1つの遊び場（540×960）。スマホは画面いっぱい、PCは中央に縦長で表示する
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const W = 540;
const H = 960;
const GY = 730; // 走る面（地面の上の縁）
const BASE = '/assets/games/';

// 世界の長さ（px）と速さ（px/秒）
const LEVEL_LENGTH = 9000;
const SPEED = 300;

// ムスビ
const MUSUBI_X = 120;
const MUSUBI_H = 132;
const GRAVITY = 1800;
const JUMP_V = -760;
const LIVES = 3;

type Phase = 'ready' | 'playing' | 'paused' | 'clear' | 'miss';

interface ObstacleKind {
  img: string;
  w: number;
  h: number;
  // 当たり判定（絵に対する割合）
  hx: number;
  hy: number;
  low?: boolean;
}

// 幅 w・高さ h は、画面上の大きさ。hx/hy は、当たり判定を絵より小さくする割合
const KINDS: Record<string, ObstacleKind> = {
  stump_s: { img: 'run_stump_s', w: 92, h: 67, hx: 0.7, hy: 0.8 },
  rock_s: { img: 'run_rock_s', w: 92, h: 62, hx: 0.7, hy: 0.8 },
  stump_l: { img: 'run_stump_l', w: 82, h: 140, hx: 0.65, hy: 0.85 },
  rock_l: { img: 'run_rock_l', w: 82, h: 130, hx: 0.65, hy: 0.85 },
  log: { img: 'run_log', w: 170, h: 63, hx: 0.8, hy: 0.8 },
  puddle: { img: 'run_puddle', w: 160, h: 19, hx: 0.85, hy: 1, low: true },
  mushroom_1: { img: 'run_mushroom_1', w: 56, h: 68, hx: 0.7, hy: 0.85 },
  mushroom_2: { img: 'run_mushroom_2', w: 56, h: 68, hx: 0.7, hy: 0.85 },
  mushroom_3: { img: 'run_mushroom_3', w: 56, h: 68, hx: 0.7, hy: 0.85 },
};
const KIND_KEYS = Object.keys(KINDS);

const RUN_FRAMES = ['musubi_run_right_1', 'musubi_run_right_2', 'musubi_run_right_3p', 'musubi_run_right_4p', 'musubi_run_right_5p', 'musubi_run_right_6'];
const IMAGE_NAMES = [
  ...RUN_FRAMES,
  'musubi_jump_up_right',
  'musubi_fall_right',
  'musubi_land_right',
  'musubi_hit_right',
  'musubi_cheer_front_1',
  'musubi_sad_front',
  'runbg_sky',
  'runbg_far',
  'runbg_mid2',
  'runbg_near',
  'run_ground',
  'run_start_sign',
  'run_goal_gate',
  'run_marker',
  'ui_run_progress',
  'ui_run_head',
  ...Object.values(KINDS).map((k) => k.img),
];

type Images = Record<string, HTMLImageElement>;

function loadImages(): Promise<Images> {
  return Promise.all(
    IMAGE_NAMES.map(
      (name) =>
        new Promise<[string, HTMLImageElement]>((resolve) => {
          const img = new Image();
          img.onload = () => resolve([name, img]);
          img.onerror = () => resolve([name, img]); // 読めなくても、ゲームは続ける（絵だけ出ない）
          img.src = `${BASE}${name}.png`;
        })
    )
  ).then((pairs) => Object.fromEntries(pairs));
}

interface Obstacle {
  kind: string;
  x: number; // 世界の座標（左端）
  hit: boolean;
}

function buildCourse(): Obstacle[] {
  const list: Obstacle[] = [];
  let x = 900; // スタート看板から少し走ってから
  let last = '';
  while (x < LEVEL_LENGTH - 700) {
    let kind = KIND_KEYS[Math.floor(Math.random() * KIND_KEYS.length)];
    if (kind === last) kind = KIND_KEYS[(KIND_KEYS.indexOf(kind) + 1) % KIND_KEYS.length];
    last = kind;
    list.push({ kind, x, hit: false });
    // 次までの間隔：大きい障害物の後は、広めにあける
    x += 360 + Math.random() * 260 + KINDS[kind].w;
  }
  return list;
}

/** 左右を交互に反転して、横にならべる（端の絵がつながらないため） */
function drawLoop(ctx: CanvasRenderingContext2D, img: HTMLImageElement, offset: number, y: number, w: number, h: number) {
  if (!img.naturalWidth) return;
  const start = -(((offset % (w * 2)) + w * 2) % (w * 2));
  for (let i = 0; start + i * w < W + w; i++) {
    const x = start + i * w;
    const flip = i % 2 === 1;
    ctx.save();
    if (flip) {
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, w, h);
    } else {
      ctx.drawImage(img, x, y, w, h);
    }
    ctx.restore();
  }
}

export function ForestRun({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<Images | null>(null);
  const phaseRef = useRef<Phase>('ready');
  const [phase, setPhase] = useState<Phase>('ready');
  const [loaded, setLoaded] = useState(false);
  const [lives, setLives] = useState(LIVES);

  const game = useRef({
    dist: 0,
    y: 0, // 地面からの高さ（上向きが正）
    vy: 0,
    onGround: true,
    landTimer: 0,
    invuln: 0,
    hitTimer: 0,
    lives: LIVES,
    obstacles: buildCourse(),
    time: 0,
  });

  const changePhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const reset = useCallback(() => {
    const g = game.current;
    g.dist = 0;
    g.y = 0;
    g.vy = 0;
    g.onGround = true;
    g.landTimer = 0;
    g.invuln = 0;
    g.hitTimer = 0;
    g.lives = LIVES;
    g.obstacles = buildCourse();
    g.time = 0;
    setLives(LIVES);
  }, []);

  const jump = useCallback(() => {
    const g = game.current;
    if (phaseRef.current === 'ready') {
      changePhase('playing');
      return;
    }
    if (phaseRef.current !== 'playing') return;
    if (g.onGround && g.hitTimer <= 0) {
      g.vy = JUMP_V;
      g.onGround = false;
    }
  }, [changePhase]);

  // 開発中の確認用：ブラウザの開発ツールから、ゲームの状態を見られるようにする
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __run?: unknown }).__run = { game, jump, phaseRef };
  }, [jump]);

  const restart = useCallback(() => {
    reset();
    changePhase('ready');
  }, [reset, changePhase]);

  useEffect(() => {
    loadImages().then((imgs) => {
      imagesRef.current = imgs;
      setLoaded(true);
    });
  }, []);

  // 操作：キー（スペース・↑）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      } else if (e.code === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [jump, onClose]);

  // ゲームのループ
  useEffect(() => {
    if (!loaded) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const imgs = imagesRef.current!;
    let raf = 0;
    let prev = performance.now();

    const frame = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      const g = game.current;
      const phaseNow = phaseRef.current;

      // ───── 更新 ─────
      if (phaseNow === 'playing') {
        g.time += dt;
        g.dist += SPEED * dt;
        if (!g.onGround) {
          g.vy += GRAVITY * dt;
          g.y -= g.vy * dt;
          if (g.y <= 0) {
            g.y = 0;
            g.vy = 0;
            g.onGround = true;
            g.landTimer = 0.12;
          }
        }
        if (g.landTimer > 0) g.landTimer -= dt;
        if (g.invuln > 0) g.invuln -= dt;
        if (g.hitTimer > 0) g.hitTimer -= dt;

        // 当たり判定（世界の座標 → 画面の座標）
        const mx0 = g.dist + MUSUBI_X - 20;
        const mx1 = g.dist + MUSUBI_X + 20;
        const my0 = g.y; // 足の高さ
        const my1 = g.y + 92;
        for (const o of g.obstacles) {
          if (o.hit) continue;
          const k = KINDS[o.kind];
          const ox0 = o.x + (k.w * (1 - k.hx)) / 2;
          const ox1 = o.x + k.w - (k.w * (1 - k.hx)) / 2;
          const oh = k.h * k.hy;
          if (mx1 > ox0 && mx0 < ox1 && my0 < oh && my1 > 0 && g.invuln <= 0) {
            o.hit = true;
            g.lives -= 1;
            g.invuln = 1.2;
            g.hitTimer = 0.45;
            setLives(g.lives);
            if (g.lives <= 0) changePhase('miss');
          }
        }
        // ゴール
        if (g.dist + MUSUBI_X >= LEVEL_LENGTH) changePhase('clear');
      }

      // ───── 描く ─────
      ctx.clearRect(0, 0, W, H);
      const sky = imgs['runbg_sky'];
      if (sky.naturalWidth) {
        const s = Math.max(W / sky.naturalWidth, H / sky.naturalHeight);
        ctx.drawImage(sky, (W - sky.naturalWidth * s) / 2, 0, sky.naturalWidth * s, sky.naturalHeight * s);
      }
      const d = g.dist;
      const far = imgs['runbg_far'];
      drawLoop(ctx, far, d * 0.12, GY - 360, 700, 700 * (far.naturalHeight / (far.naturalWidth || 1)));
      const mid = imgs['runbg_mid2'];
      const midH = 250;
      drawLoop(ctx, mid, d * 0.4, GY - midH + 40, midH * (mid.naturalWidth / (mid.naturalHeight || 1)), midH);

      // 地面
      const gr = imgs['run_ground'];
      const gh = H - GY + 8;
      const gw = gh * (gr.naturalWidth / (gr.naturalHeight || 1));
      drawLoop(ctx, gr, d, GY - 4, gw, gh);

      // 看板・目印・ゴールの門
      const world = (wx: number) => wx - d + MUSUBI_X;
      const drawSprite = (name: string, wx: number, h: number) => {
        const im = imgs[name];
        if (!im.naturalWidth) return;
        const w = h * (im.naturalWidth / im.naturalHeight);
        const x = world(wx);
        if (x > W + 50 || x + w < -50) return;
        ctx.drawImage(im, x, GY - h + 8, w, h);
      };
      drawSprite('run_start_sign', 300, 150);
      for (let m = 2000; m < LEVEL_LENGTH - 600; m += 2000) drawSprite('run_marker', m, 120);
      drawSprite('run_goal_gate', LEVEL_LENGTH, 240);

      // 障害物
      for (const o of g.obstacles) {
        const k = KINDS[o.kind];
        const im = imgs[k.img];
        const x = world(o.x);
        if (!im.naturalWidth || x > W + 20 || x + k.w < -20) continue;
        ctx.globalAlpha = o.hit ? 0.55 : 1;
        ctx.drawImage(im, x, GY - k.h + 6, k.w, k.h);
        ctx.globalAlpha = 1;
      }

      // ムスビ
      let name: string;
      if (phaseNow === 'clear') name = 'musubi_cheer_front_1';
      else if (phaseNow === 'miss') name = 'musubi_sad_front';
      else if (g.hitTimer > 0) name = 'musubi_hit_right';
      else if (!g.onGround) name = g.vy < 0 ? 'musubi_jump_up_right' : 'musubi_fall_right';
      else if (g.landTimer > 0) name = 'musubi_land_right';
      else name = RUN_FRAMES[Math.floor((phaseNow === 'playing' ? g.time : 0) * 11) % RUN_FRAMES.length];
      const mi = imgs[name];
      if (mi.naturalWidth) {
        const sc = MUSUBI_H / 945;
        const mw = mi.naturalWidth * sc;
        const mh = mi.naturalHeight * sc;
        const blink = phaseNow === 'playing' && g.invuln > 0 && Math.floor(g.invuln * 14) % 2 === 0;
        if (!blink) ctx.drawImage(mi, MUSUBI_X - mw / 2, GY - g.y - mh + 10, mw, mh);
      }

      // 手前の草
      const near = imgs['runbg_near'];
      const nearH = 200;
      drawLoop(ctx, near, d * 1.25, H - nearH + 20, nearH * (near.naturalWidth / (near.naturalHeight || 1)), nearH);

      // 道のり
      const bar = imgs['ui_run_progress'];
      if (bar.naturalWidth) {
        const bw = 400;
        const bh = bw * (bar.naturalHeight / bar.naturalWidth);
        const bx = (W - bw) / 2;
        const by = 26;
        ctx.drawImage(bar, bx, by, bw, bh);
        const head = imgs['ui_run_head'];
        const p = Math.min(1, g.dist / LEVEL_LENGTH);
        const hs = 42;
        if (head.naturalWidth) ctx.drawImage(head, bx + bw * 0.1 + bw * 0.8 * p - hs / 2, by + bh / 2 - hs / 2, hs, hs);
      }
      // 残りのハート
      ctx.font = '30px sans-serif';
      ctx.textBaseline = 'top';
      for (let i = 0; i < LIVES; i++) {
        ctx.fillStyle = i < g.lives ? '#ff6b8b' : 'rgba(255,255,255,0.3)';
        ctx.fillText('♥', 24 + i * 34, 112);
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [loaded, changePhase]);

  const togglePause = () => {
    if (phaseRef.current === 'playing') changePhase('paused');
    else if (phaseRef.current === 'paused') changePhase('playing');
  };

  return (
    <div className="run-backdrop">
      <div className="run-stage" onPointerDown={jump}>
        <canvas ref={canvasRef} width={W} height={H} className="run-canvas" />

        {!loaded && <div className="run-overlay">読み込んでいます…</div>}

        {loaded && phase === 'ready' && (
          <div className="run-overlay run-overlay-ready">
            <p>タップで、ジャンプ</p>
            <small>（スペース・↑キーでも）</small>
            <p className="run-start">タップで、スタート</p>
          </div>
        )}

        {phase === 'paused' && (
          <div className="run-overlay">
            <p>一時停止中</p>
            <button type="button" className="daily-btn" onPointerDown={(e) => e.stopPropagation()} onClick={togglePause}>つづける</button>
          </div>
        )}

        {(phase === 'clear' || phase === 'miss') && (
          <div className="run-overlay">
            <p className="run-result">{phase === 'clear' ? 'ゴール！' : 'ざんねん…'}</p>
            <button type="button" className="daily-btn" onPointerDown={(e) => e.stopPropagation()} onClick={restart}>もういちど</button>
          </div>
        )}

        <div className="run-top-buttons" onPointerDown={(e) => e.stopPropagation()}>
          {(phase === 'playing' || phase === 'paused') && (
            <button type="button" onClick={togglePause} aria-label="一時停止">
              <img src={`${BASE}${phase === 'paused' ? 'ui_play_btn' : 'ui_pause_btn'}.png`} alt="" />
            </button>
          )}
          <button type="button" className="run-close" onClick={onClose}>閉じる</button>
        </div>
        <span className="run-lives-sr" aria-live="polite">のこり {lives}</span>
      </div>
    </div>
  );
}

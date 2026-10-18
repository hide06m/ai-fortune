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
const MUSUBI_SINK = 12; // ムスビの足もとを、地面に、少しうめる
const GROUND_EDGE = 4; // 障害物を切る位置（地面の草の線の、少し下）
const GATE_H = 240; // ゴールの門の高さ
const GATE_PASS = 170; // 門のまん中を過ぎてから、クリアにするまでの距離

// 画面の細かさ（スマホは、画面の点が細かいので、2倍で描く）
const RES = Math.min(2, Math.max(1, Math.ceil(window.devicePixelRatio || 1)));

/**
 * 画像を、画面に出す大きさまで、段階的に小さくして（半分ずつ）、高画質で縮める。
 * 元の画像は、大きすぎるので、そのまま縮めて描くと、ざらざらに見える。
 * 同じ大きさのものは、1回だけ作って、使い回す。
 */
const scaledCache = new WeakMap<HTMLImageElement, Map<string, HTMLCanvasElement>>();

function scaled(img: HTMLImageElement, sx: number, sy: number, sw: number, sh: number, dw: number, dh: number): HTMLCanvasElement | HTMLImageElement {
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
function dI(ctx: CanvasRenderingContext2D, img: HTMLImageElement, sx: number, sy: number, sw: number, sh: number, x: number, y: number, w: number, h: number) {
  ctx.drawImage(scaled(img, sx, sy, sw, sh, w, h), x, y, w, h);
}

/** 画像の全体を、(x,y) に、大きさ w×h で描く */
function dFull(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  if (!img.naturalWidth) return;
  dI(ctx, img, 0, 0, img.naturalWidth, img.naturalHeight, x, y, w, h);
}

type Phase = 'ready' | 'playing' | 'paused' | 'clear' | 'miss';

interface ObstacleKind {
  img: string;
  w: number;
  h: number;
  // 当たり判定（絵に対する割合）
  hx: number;
  hy: number;
  low?: boolean;
  /** 地面にうめる割合（根や足もとが、地面の上に見えないように、下の部分を、地面の中にかくす） */
  sink: number;
}

// 幅 w・高さ h は、画面上の大きさ。hx/hy は、当たり判定を絵より小さくする割合
const KINDS: Record<string, ObstacleKind> = {
  stump_s: { img: 'run_stump_s', w: 92, h: 67, hx: 0.7, hy: 0.8, sink: 0.2 },
  rock_s: { img: 'run_rock_s', w: 92, h: 62, hx: 0.7, hy: 0.8, sink: 0.14 },
  stump_l: { img: 'run_stump_l', w: 82, h: 140, hx: 0.65, hy: 0.85, sink: 0.1 },
  rock_l: { img: 'run_rock_l', w: 82, h: 130, hx: 0.65, hy: 0.85, sink: 0.08 },
  puddle: { img: 'run_puddle', w: 160, h: 19, hx: 0.85, hy: 1, low: true, sink: 0.45 },
  mushroom_1: { img: 'run_mushroom_1', w: 56, h: 68, hx: 0.7, hy: 0.85, sink: 0.08 },
  mushroom_2: { img: 'run_mushroom_2', w: 56, h: 68, hx: 0.7, hy: 0.85, sink: 0.08 },
  mushroom_3: { img: 'run_mushroom_3', w: 56, h: 68, hx: 0.7, hy: 0.85, sink: 0.08 },
};
const KIND_KEYS = Object.keys(KINDS);

const RUN_FRAMES = Array.from({ length: 12 }, (_, i) => `musubi_walk_${String(i + 1).padStart(2, '0')}`);
const MUSUBI_NAMES = [...RUN_FRAMES, 'musubi_jump_up_right', 'musubi_fall_right', 'musubi_land_right', 'musubi_hit_right', 'musubi_cheer_front_1', 'musubi_sad_front'];
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
  'ui_run_progress',
  'ui_run_head',
  ...Object.values(KINDS).map((k) => k.img),
];

type Images = Record<string, HTMLImageElement>;

interface Box {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}
/** 絵の、透明な余白を除いた範囲（余白があると、障害物が、地面から浮いて見えるため） */
const boxes: Record<string, Box> = {};

function opaqueBox(img: HTMLImageElement): Box {
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
  ).then((pairs) => {
    const imgs: Images = Object.fromEntries(pairs);
    // 障害物は、余白を除いた形で、高さに合わせて幅を決める
    for (const k of Object.values(KINDS)) {
      const b = opaqueBox(imgs[k.img]);
      boxes[k.img] = b;
      k.w = k.h * (b.sw / b.sh);
    }
    for (const n of MUSUBI_NAMES) boxes[n] = opaqueBox(imgs[n]);
    return imgs;
  });
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
      dFull(ctx, img, 0, 0, w, h);
    } else {
      dFull(ctx, img, x, y, w, h);
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
    ctx.setTransform(RES, 0, 0, RES, 0, 0);
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
        // 世界の座標では、ムスビは g.dist の位置（画面の MUSUBI_X に、描く）にいる
        const mx0 = g.dist - 20;
        const mx1 = g.dist + 20;
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
        // ゴール：門のまん中がムスビの位置に来たあと、門をくぐり抜けてから、クリアにする
        // （空中でゴールしたときは、着地してから、クリアにする）
        if (g.dist >= LEVEL_LENGTH + GATE_PASS && g.onGround) changePhase('clear');
      }

      // ───── 描く ─────
      ctx.clearRect(0, 0, W, H);
      const sky = imgs['runbg_sky'];
      if (sky.naturalWidth) {
        const s = Math.max(W / sky.naturalWidth, H / sky.naturalHeight);
        dFull(ctx, sky, (W - sky.naturalWidth * s) / 2, 0, sky.naturalWidth * s, sky.naturalHeight * s);
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
        dFull(ctx, im, x, GY - h + 8, w, h);
      };
      drawSprite('run_start_sign', 300, 150);
      // ゴールの門は、左右に半分ずつ。左半分は、ムスビの後ろ（先に描く）、右半分は、ムスビの前（あとで描く）に置いて、くぐり抜けるように見せる
      const gate = imgs['run_goal_gate'];
      const drawGateHalf = (half: 'left' | 'right') => {
        if (!gate.naturalWidth) return;
        const gw2 = GATE_H * (gate.naturalWidth / gate.naturalHeight);
        const gx = world(LEVEL_LENGTH) - gw2 / 2; // 門のまん中が、LEVEL_LENGTH
        if (gx > W + 50 || gx + gw2 < -50) return;
        const sw = gate.naturalWidth / 2;
        dI(ctx, gate, half === 'left' ? 0 : sw, 0, sw, gate.naturalHeight, gx + (half === 'left' ? 0 : gw2 / 2), GY - GATE_H + 8, gw2 / 2, GATE_H);
      };
      drawGateHalf('left');

      // 障害物
      for (const o of g.obstacles) {
        const k = KINDS[o.kind];
        const im = imgs[k.img];
        const x = world(o.x);
        if (!im.naturalWidth || x > W + 20 || x + k.w < -20) continue;
        ctx.globalAlpha = o.hit ? 0.55 : 1;
        const b = boxes[k.img];
        // 下の部分を、地面の線で切って、地面の中に、うめる（根や足もとが、地面の上に、浮いて見えない）
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, GY + GROUND_EDGE);
        ctx.clip();
        dI(ctx, im, b.sx, b.sy, b.sw, b.sh, x, GY - k.h + k.h * k.sink + GROUND_EDGE, k.w, k.h);
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      // ムスビ
      let name: string;
      if (phaseNow === 'clear') name = 'musubi_cheer_front_1';
      else if (phaseNow === 'miss') name = 'musubi_sad_front';
      else if (g.hitTimer > 0) name = 'musubi_hit_right';
      else if (!g.onGround) name = g.vy < 0 ? 'musubi_jump_up_right' : 'musubi_fall_right';
      else if (g.landTimer > 0) name = 'musubi_land_right';
      else name = RUN_FRAMES[Math.floor((phaseNow === 'playing' ? g.time : 0) * 13) % RUN_FRAMES.length];
      const mi = imgs[name];
      if (mi.naturalWidth) {
        // 走り（歩き）のコマは、切り出した大きさが違うので、人物の高さが同じになるよう、倍率を変える
        const sc = name.startsWith('musubi_walk') ? MUSUBI_H / 290 : MUSUBI_H / 945;
        const mw = mi.naturalWidth * sc;
        const mh = mi.naturalHeight * sc;
        const blink = phaseNow === 'playing' && g.invuln > 0 && Math.floor(g.invuln * 14) % 2 === 0;
        if (!blink) {
          // 絵の下の透明な余白を除いて、足もとを、地面に合わせる（空中では、その分、上がる）
          const b = boxes[name];
          // 走り（歩き）のコマは、体の上下を、絵の中で、そろえてあるので、足もとの基準線（キャンバスの上から360）で、そろえる
          const footY = name.startsWith('musubi_walk') ? 360 * sc : b ? (b.sy + b.sh) * sc : mh;
          dFull(ctx, mi, MUSUBI_X - mw / 2, GY - g.y - footY + MUSUBI_SINK, mw, mh);
        }
      }

      drawGateHalf('right');

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
        dFull(ctx, bar, bx, by, bw, bh);
        const head = imgs['ui_run_head'];
        const p = Math.min(1, g.dist / LEVEL_LENGTH);
        const hs = 42;
        if (head.naturalWidth) dFull(ctx, head, bx + bw * 0.1 + bw * 0.8 * p - hs / 2, by + bh / 2 - hs / 2, hs, hs);
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
        <canvas ref={canvasRef} width={W * RES} height={H * RES} className="run-canvas" />

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

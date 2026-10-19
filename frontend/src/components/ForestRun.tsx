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
const SPEED = 300;

// ムスビ
const MUSUBI_X = 120;
const MUSUBI_H = 132;
const GRAVITY = 1800;
const JUMP_V = -760;
const LIVES = 3;
const MUSUBI_FACE_DX = 26; // 顔の中心は、体の中心より、少し前（右）にある
const MUSUBI_SINK = 12; // ムスビの足もとを、地面に、少しうめる
const GROUND_EDGE = 6; // 障害物の底を、地面の線から、さらに下へ置く量
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

type Difficulty = 'easy' | 'normal' | 'hard' | 'extra';

/** 難易度ごとの設定 */
interface DifficultyConfig {
  label: string;
  sub: string;
  length: number; // コースの長さ（px）。約300px/秒
  birds: string[]; // とんでくる鳥の種類（空なら、鳥なし）
  birdStart: number;
  birdGap: [number, number]; // 鳥と鳥の間隔
  groundGap: [number, number]; // 地面の障害物の間隔（絵の幅を足す前）
  bigWeight: number; // 大きい障害物（丸太・高い切り株・高い石）が出る割合
  randomColor: boolean; // 鳥の色を、ランダムにする（高さと、色が、結びつかない）
  clearRadius: number; // 鳥の前後で、地面の障害物を、取りのぞく範囲
}
const DIFFS: Record<Difficulty, DifficultyConfig> = {
  easy: { label: 'かんたん', sub: '地面の障害物だけ・短め', length: 6000, birds: [], birdStart: 0, birdGap: [0, 0], groundGap: [400, 300], bigWeight: 0.12, randomColor: false, clearRadius: 0 },
  normal: { label: 'ふつう', sub: '高い空の鳥が出る', length: 9000, birds: ['fly_high'], birdStart: 2000, birdGap: [1900, 800], groundGap: [360, 260], bigWeight: 0.22, randomColor: false, clearRadius: 400 },
  hard: { label: 'むずかしい', sub: '低い空の鳥も出る・長め', length: 12000, birds: ['fly_high', 'fly_low'], birdStart: 1800, birdGap: [1500, 800], groundGap: [340, 240], bigWeight: 0.3, randomColor: false, clearRadius: 360 },
  extra: { label: 'エクストラ', sub: '鳥の色がバラバラ・大きな障害物が多い・いちばん長い', length: 15000, birds: ['fly_high', 'fly_low'], birdStart: 1600, birdGap: [1150, 700], groundGap: [300, 200], bigWeight: 0.5, randomColor: true, clearRadius: 300 },
};
const DIFF_ORDER: Difficulty[] = ['easy', 'normal', 'hard', 'extra'];
const BIG_KINDS = ['log', 'stump_l', 'rock_l'];
const DIFFICULTY_KEY = 'forestRun.difficulty';

function loadDifficulty(): Difficulty {
  try {
    const v = localStorage.getItem(DIFFICULTY_KEY) as Difficulty | null;
    return v && v in DIFFS ? v : 'easy';
  } catch {
    return 'easy';
  }
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
  log: { img: 'run_log2', w: 176, h: 60, hx: 0.75, hy: 0.8, sink: 0.08 },
  puddle: { img: 'run_puddle', w: 160, h: 19, hx: 0.85, hy: 1, low: true, sink: 0.45 },
  mushroom_1: { img: 'run_mushroom_1', w: 56, h: 68, hx: 0.7, hy: 0.85, sink: 0.08 },
  mushroom_2: { img: 'run_mushroom_2', w: 56, h: 68, hx: 0.7, hy: 0.85, sink: 0.08 },
  mushroom_3: { img: 'run_mushroom_3', w: 56, h: 68, hx: 0.7, hy: 0.85, sink: 0.08 },
};
const KIND_KEYS = Object.keys(KINDS);

/** 空を飛んでくる障害物。低空は、ジャンプで、よける。高空は、ジャンプせず、歩いていれば、くぐれる */
interface FlyerKind {
  alt: number; // 地面から、体の下端までの高さ
  w: number; // 絵の読みこみ後に、縦横比から決める
  h: number;
  hx: number; // 当たり判定の横幅（絵に対する割合）
  hb0: number; // 当たり判定の下端（絵の高さに対する割合。下から）
  hb1: number; // 当たり判定の上端（同上）。羽は、判定に入れない
  speed: number; // 画面に入ってから、こちらへ向かってくる速さ（px/秒）
}
const FLYERS: Record<string, FlyerKind> = {
  fly_low: { alt: 6, w: 60, h: 70, hx: 0.6, hb0: 0.05, hb1: 0.62, speed: 150 },
  fly_high: { alt: 118, w: 60, h: 70, hx: 0.6, hb0: 0.05, hb1: 0.62, speed: 110 },
};
const BIRD_FRAMES = 4;

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
  'runbg_mid2_loop',
  'runbg_near_loop',
  'run_ground_loop',
  'run_start_sign',
  'run_goal_gate',
  'ui_run_progress',
  'ui_run_head',
  ...Object.values(KINDS).map((k) => k.img),
  ...Array.from({ length: BIRD_FRAMES }, (_, i) => `run_bird_${i + 1}`),
  ...Array.from({ length: BIRD_FRAMES }, (_, i) => `run_bird_red_${i + 1}`),
];

type Images = Record<string, HTMLImageElement>;

/** コマごとの、大きさの倍率（tools/musubi_sizes.py が作る）。頭の大きさを、そろえるため */
let sizeAdj: Record<string, { a: number; fx: number }> = {};

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
  fetch(`${BASE}musubi_scale.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .then((j) => {
      sizeAdj = j;
    })
    .catch(() => {});
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
    const b1 = imgs['run_bird_1'];
    if (b1 && b1.naturalWidth) for (const f of Object.values(FLYERS)) f.w = f.h * (b1.naturalWidth / b1.naturalHeight);
    return imgs;
  });
}

interface Obstacle {
  kind: string;
  x: number; // 世界の座標（左端）
  hit: boolean;
  tone?: 'blue' | 'red'; // 鳥の色
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildCourse(diff: Difficulty): Obstacle[] {
  const cfg = DIFFS[diff];
  const list: Obstacle[] = [];
  const common = KIND_KEYS.filter((k) => !BIG_KINDS.includes(k));
  let x = 900; // スタート看板から少し走ってから
  let last = '';
  for (let guard = 0; x < cfg.length - 700 && guard < 400; guard++) {
    let kind = Math.random() < cfg.bigWeight ? pick(BIG_KINDS) : pick(common);
    if (kind === last) kind = kind === common[0] ? common[1] : common[0];
    last = kind;
    list.push({ kind, x, hit: false });
    // 次までの間隔
    x += cfg.groundGap[0] + Math.random() * cfg.groundGap[1] + KINDS[kind].w;
  }
  if (cfg.birds.length === 0) return list;
  // 空を飛ぶ障害物：一定の間隔で、置く。その前後 420px にある、地面の障害物は、取りのぞく
  // （ジャンプしたい場面と、ジャンプしたくない場面が、重ならないように）
  let fx = cfg.birdStart;
  let lastFly = '';
  for (let guard = 0; fx < cfg.length - 900 && guard < 200; guard++) {
    for (let i = list.length - 1; i >= 0; i--) {
      const o = list[i];
      if (!FLYERS[o.kind] && Math.abs(o.x + KINDS[o.kind].w / 2 - (fx - 140)) < cfg.clearRadius) list.splice(i, 1); // 鳥は、画面に入ってから、約140px 手前へ、すすむ
    }
    let kind = pick(cfg.birds);
    if (cfg.birds.length > 1 && kind === lastFly && Math.random() < 0.6) kind = cfg.birds.find((k) => k !== kind) ?? kind;
    lastFly = kind;
    // 鳥の色：ふだんは青。エクストラは、高さと関係なく、ランダム（赤茶の鳥が上に、青の鳥が下に、来ることもある）
    const tone: 'blue' | 'red' = cfg.randomColor ? pick(['blue', 'red'] as const) : 'blue';
    list.push({ kind, x: fx, hit: false, tone });
    fx += cfg.birdGap[0] + Math.random() * cfg.birdGap[1];
  }
  list.sort((a, b) => a.x - b.x);
  return list;
}

/** 鳥の絵ができるまでの、仮の鳥（左向き。羽ばたく） */
function drawPlaceholderBird(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, tone: 'low' | 'high', frame: number) {
  const body = tone === 'low' ? '#7a3b2e' : '#4a6fa5';
  const wing = tone === 'low' ? '#a8503c' : '#7aa0d4';
  const flap = Math.sin((frame / BIRD_FRAMES) * Math.PI * 2);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = wing;
  ctx.beginPath();
  ctx.moveTo(-w * 0.05, -h * 0.05);
  ctx.lineTo(w * 0.25, -h * (0.55 + 0.35 * flap));
  ctx.lineTo(w * 0.32, -h * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.34, h * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath(); // 頭
  ctx.arc(-w * 0.3, -h * 0.08, h * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c14e'; // くちばし
  ctx.beginPath();
  ctx.moveTo(-w * 0.46, -h * 0.1);
  ctx.lineTo(-w * 0.58, -h * 0.04);
  ctx.lineTo(-w * 0.46, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-w * 0.34, -h * 0.12, h * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 左右を交互に反転して、横にならべる（端の絵がつながらないため） */
function drawLoop(ctx: CanvasRenderingContext2D, img: HTMLImageElement, offset: number, y: number, w: number, h: number) {
  if (!img.naturalWidth) return;
  const start = -(((offset % (w * 2)) + w * 2) % (w * 2));
  for (let i = 0; start + i * w < W + w && i < 40; i++) {
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

/** つなぎ目を混ぜてある絵（_loop）を、反転せずに、そのまま、横に並べる */
function drawLoopPlain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, offset: number, y: number, w: number, h: number) {
  if (!img.naturalWidth) return;
  const start = -(((offset % w) + w) % w);
  for (let x = start, n = 0; x < W && n < 40; x += w, n++) dFull(ctx, img, Math.floor(x), y, Math.ceil(w) + 2, h);
}

export function ForestRun({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<Images | null>(null);
  const phaseRef = useRef<Phase>('ready');
  const [phase, setPhase] = useState<Phase>('ready');
  const [loaded, setLoaded] = useState(false);
  const [lives, setLives] = useState(LIVES);
  const [difficulty, setDifficulty] = useState<Difficulty>(loadDifficulty);
  const difficultyRef = useRef<Difficulty>(difficulty);

  const game = useRef({
    dist: 0,
    y: 0, // 地面からの高さ（上向きが正）
    vy: 0,
    onGround: true,
    landTimer: 0,
    invuln: 0,
    hitTimer: 0,
    lives: LIVES,
    obstacles: buildCourse(loadDifficulty()),
    length: DIFFS[loadDifficulty()].length,
    time: 0,
    dying: false,
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
    g.obstacles = buildCourse(difficultyRef.current);
    g.length = DIFFS[difficultyRef.current].length;
    g.time = 0;
    g.dying = false;
    setLives(LIVES);
  }, []);

  const chooseDifficulty = useCallback((d: Difficulty) => {
    difficultyRef.current = d;
    setDifficulty(d);
    game.current.obstacles = buildCourse(d);
    game.current.length = DIFFS[d].length;
    try {
      localStorage.setItem(DIFFICULTY_KEY, d);
    } catch {
      /* 保存できなくても、遊べる */
    }
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

    const frameBody = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      const g = game.current;
      const phaseNow = phaseRef.current;

      // ───── 更新 ─────
      if (phaseNow === 'playing') {
        g.time += dt;
        if (!g.dying) g.dist += SPEED * dt; // ミスが決まったら、前へ進むのを止めて、着地を待つ
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
        if (g.dying && g.onGround) changePhase('miss');
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
          const fk = FLYERS[o.kind];
          if (fk) {
            // 画面に入ったら、こちらへ向かって、飛んでくる
            if (o.x - g.dist + MUSUBI_X < W + 60 && !g.dying) o.x -= fk.speed * dt;
            if (o.hit) continue;
            const fx0 = o.x + (fk.w * (1 - fk.hx)) / 2;
            const fx1 = o.x + fk.w - (fk.w * (1 - fk.hx)) / 2;
            const fy0 = fk.alt + fk.h * fk.hb0;
            const fy1 = fk.alt + fk.h * fk.hb1;
            if (mx1 > fx0 && mx0 < fx1 && my0 < fy1 && my1 > fy0 && g.invuln <= 0 && !g.dying) {
              o.hit = true;
              g.lives -= 1;
              g.invuln = 1.2;
              g.hitTimer = 0.45;
              setLives(g.lives);
              if (g.lives <= 0) g.dying = true;
            }
            continue;
          }
          if (o.hit) continue;
          const k = KINDS[o.kind];
          const ox0 = o.x + (k.w * (1 - k.hx)) / 2;
          const ox1 = o.x + k.w - (k.w * (1 - k.hx)) / 2;
          const oh = k.h * k.hy;
          if (mx1 > ox0 && mx0 < ox1 && my0 < oh && my1 > 0 && g.invuln <= 0 && !g.dying) {
            o.hit = true;
            g.lives -= 1;
            g.invuln = 1.2;
            g.hitTimer = 0.45;
            setLives(g.lives);
            if (g.lives <= 0) g.dying = true; // 空中なら、着地してから、ミスにする
          }
        }
        // ゴール：門のまん中がムスビの位置に来たあと、門をくぐり抜けてから、クリアにする
        // （空中でゴールしたときは、着地してから、クリアにする）
        if (g.dist >= g.length + GATE_PASS && g.onGround) changePhase('clear');
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
      const mid = imgs['runbg_mid2_loop'];
      const midH = 250;
      drawLoopPlain(ctx, mid, d * 0.4, GY - midH + 40, midH * (mid.naturalWidth / (mid.naturalHeight || 1)), midH);

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
        const gx = world(g.length) - gw2 / 2; // 門のまん中が、コースの終わり
        if (gx > W + 50 || gx + gw2 < -50) return;
        const sw = gate.naturalWidth / 2;
        dI(ctx, gate, half === 'left' ? 0 : sw, 0, sw, gate.naturalHeight, gx + (half === 'left' ? 0 : gw2 / 2), GY - GATE_H + 8, gw2 / 2, GATE_H);
      };
      drawGateHalf('left');

      // 障害物：低いもの（水たまり）以外は、地面より先に描き、地面の草が、足もとにかぶさって、うまって見えるようにする
      const drawObstacles = (low: boolean) => {
        for (const o of g.obstacles) {
          const k = KINDS[o.kind];
          if (!k || !!k.low !== low) continue;
          const im = imgs[k.img];
          const x = world(o.x);
          if (!im.naturalWidth || x > W + 20 || x + k.w < -20) continue;
          ctx.globalAlpha = o.hit ? 0.55 : 1;
          const bb = boxes[k.img];
          dI(ctx, im, bb.sx, bb.sy, bb.sw, bb.sh, x, GY - k.h + k.h * k.sink + GROUND_EDGE, k.w, k.h);
          ctx.globalAlpha = 1;
        }
      };
      drawObstacles(false);

      // 地面
      const gr = imgs['run_ground_loop'];
      const gh = H - GY + 8;
      const gw = gh * (gr.naturalWidth / (gr.naturalHeight || 1));
      drawLoopPlain(ctx, gr, d, GY - 4, gw, gh);

      drawObstacles(true);

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
        // （切り出しの基準は、幅300。高画質版（2倍）でも、同じ大きさになるよう、画像の幅で割る）
        const sc = (name.startsWith('musubi_walk') ? (MUSUBI_H / 290) * (300 / mi.naturalWidth) : MUSUBI_H / 945) * (sizeAdj[name]?.a ?? 1);
        const mw = mi.naturalWidth * sc;
        const mh = mi.naturalHeight * sc;
        const blink = phaseNow === 'playing' && g.invuln > 0 && Math.floor(g.invuln * 14) % 2 === 0;
        if (!blink) {
          // 絵の下の透明な余白を除いて、足もとを、地面に合わせる（空中では、その分、上がる）
          const b = boxes[name];
          // 走り（歩き）のコマは、体の上下を、絵の中で、そろえてあるので、足もとの基準線（キャンバスの上から360）で、そろえる
          const footY = name.startsWith('musubi_walk') ? mi.naturalHeight * (360 / 380) * sc : b ? (b.sy + b.sh) * sc : mh;
          // 顔（白い口まわり）の中心の横位置を、どのコマでも、同じ場所にそろえる（コマごとに、位置がずれないように）
          const faceX = sizeAdj[name]?.fx;
          const left = faceX !== undefined ? MUSUBI_X + MUSUBI_FACE_DX - faceX * mw : MUSUBI_X - mw / 2;
          dFull(ctx, mi, left, GY - g.y - footY + MUSUBI_SINK, mw, mh);
        }
      }

      // 空を飛ぶ障害物（ムスビより前に描く）。絵があれば絵を、なければ、仮の鳥を描く
      for (const o of g.obstacles) {
        const fk = FLYERS[o.kind];
        if (!fk) continue;
        const x = world(o.x);
        if (x > W + 40 || x + fk.w < -40) continue;
        const bob = Math.sin(g.time * 7 + o.x * 0.01) * 3;
        const y = GY - fk.alt - fk.h + bob;
        const frameNo = (Math.floor(g.time * 10) + Math.floor(o.x / 50)) % BIRD_FRAMES;
        const bird = imgs[`${o.tone === 'red' ? 'run_bird_red_' : 'run_bird_'}${frameNo + 1}`];
        ctx.globalAlpha = o.hit ? 0.5 : 1;
        if (bird && bird.naturalWidth) {
          dFull(ctx, bird, x, y, fk.w, fk.h);
        } else {
          drawPlaceholderBird(ctx, x + fk.w / 2, y + fk.h / 2, fk.w, fk.h, o.tone === 'red' ? 'low' : 'high', frameNo);
        }
        ctx.globalAlpha = 1;
      }

      drawGateHalf('right');

      // 手前の草
      const near = imgs['runbg_near_loop'];
      const nearH = 200;
      drawLoopPlain(ctx, near, d * 1.25, H - nearH + 20, nearH * (near.naturalWidth / (near.naturalHeight || 1)), nearH);

      // 道のり
      const bar = imgs['ui_run_progress'];
      if (bar.naturalWidth) {
        const bw = 400;
        const bh = bw * (bar.naturalHeight / bar.naturalWidth);
        const bx = (W - bw) / 2;
        const by = 26;
        dFull(ctx, bar, bx, by, bw, bh);
        const head = imgs['ui_run_head'];
        const p = Math.min(1, g.dist / g.length);
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

    };
    // 1コマの描画で、エラーが起きても、ゲームが止まらないようにする（止まると、画面が固まって見える）
    let errorShown = false;
    const frame = (now: number) => {
      try {
        frameBody(now);
      } catch (e) {
        if (!errorShown) console.error('[ForestRun] frame error', e);
        errorShown = true;
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
            <div className="run-difficulty" onPointerDown={(e) => e.stopPropagation()}>
              {DIFF_ORDER.map((d) => (
                <button key={d} type="button" className={difficulty === d ? 'is-on' : ''} onClick={() => chooseDifficulty(d)}>
                  {DIFFS[d].label}
                  <small>{DIFFS[d].sub}</small>
                </button>
              ))}
            </div>
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

/**
 * ムスビの森ラン（待ち時間ミニゲーム・試作）：ワンタップ（スペース／↑）でジャンプして、障害物をよけながらゴールまで走る
 * 画面は、縦長 9:16 の1つの遊び場（540×960）。スマホは画面いっぱい、PCは中央に縦長で表示する
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { RES, boxes, dFull, dI, drawLoopPlain, heartPath, opaqueBox, sizeAdj } from '../minigames/canvasUtil';
import { claimMinigameReward, type RewardResult } from '../api/minigame';
import { StoneGift } from './StoneGift';
import { isJobWaiting, subscribeWaiting } from '../api/asyncJob';

const W = 540;
const H = 960;
const GY = 730; // 走る面（地面の上の縁）
const BASE = '/assets/games/';

// 世界の長さ（px）と速さ（px/秒）

// ムスビ
const MUSUBI_X = 120;
const MUSUBI_H = 132;
const GRAVITY = 1800;
const JUMP_V = -760;
const MUSUBI_FACE_DX = 26; // 顔の中心は、体の中心より、少し前（右）にある
const MUSUBI_SINK = 12; // ムスビの足もとを、地面に、少しうめる
const FRONT_DROP = 16; // 地面より前に描くもの（切り株・ゴール）の足もとを地面の線から下げる量（根が地面にのって見える）
const GATE_DROP = 18; // ゴールの門の足もとを、地面の線から下げる量（切り株より、少なめ）
const GROUND_EDGE = 6; // 障害物の底を、地面の線から、さらに下へ置く量
const GATE_H = 240; // ゴールの門の高さ
const GATE_PASS = 170; // 門のまん中を過ぎてから、クリアにするまでの距離


type Difficulty = 'easy' | 'normal' | 'hard' | 'extra';

/**
 * 難易度ごとの設定
 * 間隔は、「秒」で決める（走る速さをかけて、距離にする）。
 * ジャンプ1回は、約0.84秒（空中）。同じ種類の障害物が続く場合、最短でも、先頭から先頭まで約0.76秒以上の間隔がないと、
 * 着地して、すぐ次をとぶ、という、きわどい連続でも、絶対に、よけられなくなる。そこを下まわらないようにする。
 */
interface DifficultyConfig {
  label: string;
  speed: number; // はしる速さ（px/秒）
  seconds: number; // コースの長さ（秒）
  lives: number; // ハート（ぶつかれる回数）
  groundTime: [number, number]; // 地面の障害物の間隔（秒）。[最短, ばらつき]
  bigWeight: number; // 大きい障害物（丸太・高い切り株・高い石）が出る割合
  birds: string[]; // とんでくる鳥の種類（空なら、鳥なし）
  birdTime: [number, number]; // 鳥と鳥の間隔（秒）。[最短, ばらつき]
  birdStart: number; // 最初の鳥が出る位置（秒）
  birdSpeedMul: number; // 鳥の、こちらへ向かってくる速さの倍率
  hit: number; // 当たり判定の大きさの倍率（大きいほど、ぎりぎりでよけられない）
  /** 鳥の色：blue＝すべて青／byHeight＝低い鳥は赤茶・高い鳥は青／random＝ランダム（高さと、色が、結びつかない） */
  tone: 'blue' | 'byHeight' | 'random';
}
const DIFFS: Record<Difficulty, DifficultyConfig> = {
  // 初見でも、クリアできる（タイミングが、150msずれる人でも、約6割クリア）
  easy: { label: 'かんたん', speed: 240, seconds: 25, lives: 4, groundTime: [1.9, 0.8], bigWeight: 0.06, birds: [], birdTime: [0, 0], birdStart: 0, birdSpeedMul: 1, tone: 'blue', hit: 0.9 },
  // 苦手な人は、ちょっと、クリアがむずかしい（150msずれる人で、約2割。100msで約6割）
  normal: { label: 'ふつう', speed: 290, seconds: 32, lives: 3, groundTime: [1.35, 0.7], bigWeight: 0.25, birds: ['fly_high'], birdTime: [3.2, 1.6], birdStart: 7, birdSpeedMul: 1.1, tone: 'blue', hit: 1 },
  // 何度も、挑戦しないと、クリアできない（60msずれる人で、約4割）
  hard: { label: 'むずかしい', speed: 420, seconds: 55, lives: 2, groundTime: [0.9, 0.3], bigWeight: 0.5, birds: ['fly_high', 'fly_low'], birdTime: [2.0, 1.0], birdStart: 5.5, birdSpeedMul: 1.35, tone: 'byHeight', hit: 1.2 },
  // 1回のミスで終わり。40msずれる人で、約6割。60msで約2割
  extra: { label: 'エクストラ', speed: 520, seconds: 80, lives: 1, groundTime: [0.88, 0.25], bigWeight: 0.7, birds: ['fly_high', 'fly_low'], birdTime: [1.5, 0.7], birdStart: 4.5, birdSpeedMul: 1.6, tone: 'random', hit: 1.25 },
};
const DIFF_ORDER: Difficulty[] = ['easy', 'normal', 'hard', 'extra'];
const BIG_KINDS = ['log', 'stump_l', 'rock_l'];
const DIFFICULTY_KEY = 'forestRun.difficulty';

function loadDifficulty(): Difficulty {
  try {
    const v = localStorage.getItem(DIFFICULTY_KEY) as Difficulty | null;
    return v && v in DIFFS ? v : 'normal'; // はじめは、ふつう
  } catch {
    return 'normal';
  }
}

type Phase = 'ready' | 'countdown' | 'playing' | 'paused' | 'clear' | 'miss';

interface ObstacleKind {
  img: string;
  w: number;
  h: number;
  // 当たり判定（絵に対する割合）
  hx: number;
  hy: number;
  low?: boolean;
  /** 地面より前（手前）に描く：根が、地面の上に、見えるように、うめない（切り株・ゴールの門） */
  front?: boolean;
  /** 地面より前に描くとき、足もとを地面の線から下げる量（未指定なら FRONT_DROP） */
  drop?: number;
  /** 地面にうめる割合（根や足もとが、地面の上に見えないように、下の部分を、地面の中にかくす） */
  sink: number;
}

// 幅 w・高さ h は、画面上の大きさ。hx/hy は、当たり判定を絵より小さくする割合
const KINDS: Record<string, ObstacleKind> = {
  stump_s: { img: 'run_stump_s', w: 92, h: 67, hx: 0.7, hy: 0.8, sink: 0.02, front: true, drop: 22 },
  rock_s: { img: 'run_rock_s', w: 92, h: 62, hx: 0.7, hy: 0.8, sink: 0.14 },
  stump_l: { img: 'run_stump_l', w: 74, h: 122, hx: 0.65, hy: 0.85, sink: 0.02, front: true },
  rock_l: { img: 'run_rock_l', w: 74, h: 114, hx: 0.65, hy: 0.85, sink: 0.08 },
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

const RUN_RATE = 9; // 走りのコマを進める速さ（コマ/秒）
const RUN_FRAMES = Array.from({ length: 4 }, (_, i) => `musubi_walk_${String(i + 1).padStart(2, '0')}`);
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
  'runbg_far_loop',
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



function loadImages(): Promise<Images> {
  fetch(`${BASE}musubi_scale.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .then((j) => {
      Object.assign(sizeAdj, j);
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
  mul?: number; // 鳥の速さの倍率
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildCourse(diff: Difficulty): Obstacle[] {
  const cfg = DIFFS[diff];
  const v = cfg.speed;
  const length = cfg.speed * cfg.seconds;
  const list: Obstacle[] = [];
  const common = KIND_KEYS.filter((k) => !BIG_KINDS.includes(k));
  let x = v * 3; // スタート看板から、少し走ってから
  let last = '';
  for (let guard = 0; x < length - v * 2.2 && guard < 600; guard++) {
    let kind = Math.random() < cfg.bigWeight ? pick(BIG_KINDS) : pick(common);
    if (kind === last) kind = kind === common[0] ? common[1] : common[0];
    last = kind;
    list.push({ kind, x, hit: false });
    // 次の障害物の先頭まで：秒で決める（先頭から先頭）
    x += v * (cfg.groundTime[0] + Math.random() * cfg.groundTime[1]);
  }
  if (cfg.birds.length === 0) return list;
  // 空を飛ぶ障害物：一定の間隔で、置く。鳥の前後の、地面の障害物は、取りのぞく
  // （ジャンプしたい場面と、ジャンプしてはいけない場面が、重ならないよう、鳥が来る前に、着地できる間隔をあける）
  let t = cfg.birdStart;
  let lastFly = '';
  for (let guard = 0; v * t < length - v * 3 && guard < 200; guard++) {
    const fx = v * t;
    const fkey = (() => {
      let k = pick(cfg.birds);
      if (cfg.birds.length > 1 && k === lastFly && Math.random() < 0.6) k = cfg.birds.find((q) => q !== k) ?? k;
      return k;
    })();
    lastFly = fkey;
    // 鳥は、画面に入ってから、こちらへ向かって、すすむので、実際に、ムスビの所へ来る位置は、少し手前
    const bs = FLYERS[fkey].speed * cfg.birdSpeedMul;
    const arrive = fx - (bs * 480) / (v + bs);
    // 鳥の前後の、地面の障害物は、取りのぞく。
    //  高い鳥：ジャンプしてはいけない（空中にいると当たる）。障害物のジャンプ（前後0.42秒）が、鳥が来る時と、重ならない間隔（±0.6秒）
    //  低い鳥：ジャンプが必要。障害物のジャンプから着地して、次のジャンプに入れる間隔（±0.9秒）
    const half = v * (fkey === 'fly_low' ? 0.9 : 0.6);
    for (let i = list.length - 1; i >= 0; i--) {
      const o = list[i];
      if (FLYERS[o.kind]) continue;
      const c = o.x + KINDS[o.kind].w / 2;
      if (Math.abs(c - arrive) < half) list.splice(i, 1);
    }
    // 鳥の色：ふだんは青。むずかしいは、低い鳥だけ赤茶。エクストラは、高さと関係なく、ランダム
    const tone: 'blue' | 'red' = cfg.tone === 'random' ? pick(['blue', 'red'] as const) : cfg.tone === 'byHeight' && fkey === 'fly_low' ? 'red' : 'blue';
    list.push({ kind: fkey, x: fx, hit: false, tone, mul: cfg.birdSpeedMul });
    t += cfg.birdTime[0] + Math.random() * cfg.birdTime[1];
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


interface ForestRunProps {
  onClose: () => void;
  /** ほかのゲームへ切りかえる（診断がまだ終わっていないとき、結果の画面に出す） */
  onSwitchGame?: () => void;
  /** 診断を待っている間に遊ぶときの、診断のジョブ番号。あれば、クリアで、ルーンストーンがもらえる */
  jobId?: string | null;
}

export function ForestRun({ onClose, jobId = null, onSwitchGame }: ForestRunProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<Images | null>(null);
  const phaseRef = useRef<Phase>('ready');
  const [phase, setPhase] = useState<Phase>('ready');
  const [loaded, setLoaded] = useState(false);
  const [lives, setLives] = useState(DIFFS[loadDifficulty()].lives);
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
    lives: DIFFS[loadDifficulty()].lives,
    obstacles: buildCourse(loadDifficulty()),
    length: DIFFS[loadDifficulty()].speed * DIFFS[loadDifficulty()].seconds,
    speed: DIFFS[loadDifficulty()].speed,
    maxLives: DIFFS[loadDifficulty()].lives,
    time: 0,
    dying: false,
    flash: 0, // ぶつかった直後の、ハートと画面の、知らせ（秒）
    lostIndex: -1, // いま、なくなった、ハートの番号
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
    g.lives = DIFFS[difficultyRef.current].lives;
    g.obstacles = buildCourse(difficultyRef.current);
    g.length = DIFFS[difficultyRef.current].speed * DIFFS[difficultyRef.current].seconds;
    g.speed = DIFFS[difficultyRef.current].speed;
    g.maxLives = DIFFS[difficultyRef.current].lives;
    g.time = 0;
    g.dying = false;
    g.flash = 0;
    g.lostIndex = -1;
    setLives(DIFFS[difficultyRef.current].lives);
  }, []);

  // スタート・一時停止からの再開は、3・2・1 のカウントダウンのあとに、はじまる
  const [count, setCount] = useState<number | null>(null);
  const countTimers = useRef<number[]>([]);
  const startCountdown = useCallback(() => {
    countTimers.current.forEach((t) => window.clearTimeout(t));
    changePhase('countdown');
    setCount(3);
    countTimers.current = [
      window.setTimeout(() => setCount(2), 800),
      window.setTimeout(() => setCount(1), 1600),
      window.setTimeout(() => {
        setCount(null);
        changePhase('playing');
      }, 2400),
    ];
  }, [changePhase]);
  useEffect(() => () => countTimers.current.forEach((t) => window.clearTimeout(t)), []);

  const chooseDifficulty = useCallback((d: Difficulty) => {
    difficultyRef.current = d;
    setDifficulty(d);
    game.current.obstacles = buildCourse(d);
    game.current.length = DIFFS[d].speed * DIFFS[d].seconds;
    game.current.speed = DIFFS[d].speed;
    game.current.maxLives = DIFFS[d].lives;
    game.current.lives = DIFFS[d].lives;
    setLives(DIFFS[d].lives);
    try {
      localStorage.setItem(DIFFICULTY_KEY, d);
    } catch {
      /* 保存できなくても、遊べる */
    }
  }, []);

  const jump = useCallback(() => {
    const g = game.current;
    if (phaseRef.current === 'ready') {
      startCountdown();
      return;
    }
    if (phaseRef.current !== 'playing') return;
    if (g.onGround && g.hitTimer <= 0) {
      g.vy = JUMP_V;
      g.onGround = false;
    }
  }, [changePhase, startCountdown]);

  // 開発中の確認用：ブラウザの開発ツールから、ゲームの状態を見られるようにする
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __run?: unknown }).__run = { game, jump, phaseRef, sim: { buildCourse, KINDS, FLYERS, DIFFS, GRAVITY, JUMP_V } };
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

  // 操作：スペースキー（ジャンプ・スタート）。スタート前は、カーソルキー（←→↑↓）で、難易度を選べる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (e.repeat) return;
        // ゴール・ざんねんの画面では、スペースで「もういちど」
        if (phaseRef.current === 'clear' || phaseRef.current === 'miss') restart();
        else jump();
      } else if (e.code === 'Escape') {
        onClose();
      } else if (phaseRef.current === 'ready' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
        e.preventDefault();
        // 難易度は、2×2 の並び（かんたん・ふつう／むずかしい・エクストラ）
        const i = DIFF_ORDER.indexOf(difficultyRef.current);
        const col = i % 2;
        const row = Math.floor(i / 2);
        let nc = col;
        let nr = row;
        if (e.code === 'ArrowLeft') nc = (col + 1) % 2;
        else if (e.code === 'ArrowRight') nc = (col + 1) % 2;
        else nr = (row + 1) % 2;
        chooseDifficulty(DIFF_ORDER[nr * 2 + nc]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [jump, onClose, chooseDifficulty, restart]);

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
        if (!g.dying) g.dist += g.speed * dt; // ミスが決まったら、前へ進むのを止めて、着地を待つ
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
        if (g.flash > 0) g.flash -= dt;

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
            if (o.x - g.dist + MUSUBI_X < W + 60 && !g.dying) o.x -= fk.speed * (o.mul ?? 1) * dt;
            if (o.hit) continue;
            const hm = DIFFS[difficultyRef.current].hit;
            const fhx = Math.min(1, fk.hx * hm);
            const fx0 = o.x + (fk.w * (1 - fhx)) / 2;
            const fx1 = o.x + fk.w - (fk.w * (1 - fhx)) / 2;
            const fy0 = fk.alt + fk.h * fk.hb0;
            const fy1 = fk.alt + fk.h * fk.hb1;
            if (mx1 > fx0 && mx0 < fx1 && my0 < fy1 && my1 > fy0 && g.invuln <= 0 && !g.dying) {
              o.hit = true;
              g.lives -= 1;
              g.flash = 0.7;
              g.lostIndex = g.lives;
              g.invuln = 1.2;
              g.hitTimer = 0.45;
              setLives(g.lives);
              if (g.lives <= 0) g.dying = true;
            }
            continue;
          }
          if (o.hit) continue;
          const k = KINDS[o.kind];
          const hm = DIFFS[difficultyRef.current].hit;
          const hx = Math.min(1, k.hx * hm);
          const ox0 = o.x + (k.w * (1 - hx)) / 2;
          const ox1 = o.x + k.w - (k.w * (1 - hx)) / 2;
          const oh = k.h * k.hy * hm;
          if (mx1 > ox0 && mx0 < ox1 && my0 < oh && my1 > 0 && g.invuln <= 0 && !g.dying) {
            o.hit = true;
            g.lives -= 1;
            g.flash = 0.7;
            g.lostIndex = g.lives;
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
      const far = imgs['runbg_far_loop'];
      drawLoopPlain(ctx, far, d * 0.12, GY - 435, 700 * (far.naturalWidth / (far.naturalHeight || 1)) * (768 / 1376), 700 * (768 / 1376));
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
        dI(ctx, gate, half === 'left' ? 0 : sw, 0, sw, gate.naturalHeight, gx + (half === 'left' ? 0 : gw2 / 2), GY - GATE_H + GATE_DROP, gw2 / 2, GATE_H);
      };
      // 障害物：石・キノコ・丸太は、地面より先に描き、地面の草が、足もとにかぶさって、うまって見えるようにする。
      // 切り株と水たまりは、地面より前に描く（切り株の根が、地面の上に、見えるように）
      const drawObstacles = (after: boolean) => {
        for (const o of g.obstacles) {
          const k = KINDS[o.kind];
          if (!k || !!(k.low || k.front) !== after) continue;
          const im = imgs[k.img];
          const x = world(o.x);
          if (!im.naturalWidth || x > W + 20 || x + k.w < -20) continue;
          ctx.globalAlpha = o.hit ? 0.55 : 1;
          const bb = boxes[k.img];
          dI(ctx, im, bb.sx, bb.sy, bb.sw, bb.sh, x, GY - k.h + k.h * k.sink + (k.front ? (k.drop ?? FRONT_DROP) : GROUND_EDGE), k.w, k.h);
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
      drawGateHalf('left'); // 門の左半分は、地面より前で、ムスビの後ろ

      // ムスビ
      let name: string;
      if (phaseNow === 'clear') name = 'musubi_cheer_front_1';
      else if (phaseNow === 'miss') name = 'musubi_sad_front';
      else if (g.hitTimer > 0) name = 'musubi_hit_right';
      else if (!g.onGround) name = g.vy < 0 ? 'musubi_jump_up_right' : 'musubi_fall_right';
      else if (g.landTimer > 0) name = 'musubi_land_right';
      else {
        const ph = (phaseNow === 'playing' ? g.time : 0) * RUN_RATE * (g.speed / 300);
        const fi = Math.floor(ph);
        name = RUN_FRAMES[fi % RUN_FRAMES.length];
      }
      const blink = phaseNow === 'playing' && g.invuln > 0 && Math.floor(g.invuln * 14) % 2 === 0;
      const drawM = (nm: string, alpha: number) => {
        const mi = imgs[nm];
        if (!mi || !mi.naturalWidth) return;
        // 走り（歩き）のコマは、切り出した大きさが違うので、人物の高さが同じになるよう、倍率を変える
        // （切り出しの基準は、幅300。高画質版でも、同じ大きさになるよう、画像の幅で割る）
        const sc = (nm.startsWith('musubi_walk') ? (MUSUBI_H / 290) * (300 / mi.naturalWidth) : MUSUBI_H / 945) * (sizeAdj[nm]?.a ?? 1);
        const mw = mi.naturalWidth * sc;
        const mh = mi.naturalHeight * sc;
        // 絵の下の透明な余白を除いて、足もとを、地面に合わせる（空中では、その分、上がる）
        const b = boxes[nm];
        // 走り（歩き）のコマは、体の上下を、絵の中で、そろえてあるので、足もとの基準線（キャンバスの上から360）で、そろえる
        const footY = nm.startsWith('musubi_walk') ? mi.naturalHeight * (360 / 380) * sc : b ? (b.sy + b.sh) * sc : mh;
        // 顔とマントの重心の中間を、どのコマでも、同じ場所にそろえる（コマごとに、位置がずれないように）
        const faceX = sizeAdj[nm]?.fx;
        const left = faceX !== undefined ? MUSUBI_X + MUSUBI_FACE_DX - faceX * mw : MUSUBI_X - mw / 2;
        ctx.globalAlpha = alpha;
        dFull(ctx, mi, left, GY - g.y - footY + MUSUBI_SINK, mw, mh);
        ctx.globalAlpha = 1;
      };
      if (!blink) {
        drawM(name, 1);
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
      for (let i = 0; i < g.maxLives; i++) {
        const lost = i >= g.lives;
        // なくなったばかりの、ハートは、大きくなってから、ちぢみながら、色がぬけていく
        const just = lost && i === g.lostIndex && g.flash > 0;
        const k = just ? 1 + (g.flash / 0.7) * 0.8 : 1;
        ctx.save();
        ctx.translate(24 + i * 34 + 15, 112 + 17);
        ctx.scale(k, k);
        heartPath(ctx, 28);
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(40, 20, 20, 0.8)';
        ctx.stroke();
        ctx.fillStyle = lost ? (just ? `rgba(255, 90, 110, ${0.4 + 0.6 * (g.flash / 0.7)})` : 'rgba(70, 45, 45, 0.55)') : '#ff6b8b';
        ctx.fill();
        ctx.restore();
      }
      // ぶつかった直後、画面のふちが、ほんのり、赤くなる
      if (g.flash > 0) {
        const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.7);
        grad.addColorStop(0, 'rgba(255, 40, 60, 0)');
        grad.addColorStop(1, `rgba(255, 40, 60, ${0.38 * (g.flash / 0.7)})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
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

  // 診断を待っている間に遊んでいて、診断ができたら、お知らせを出す
  const [diagnosisDone, setDiagnosisDone] = useState(false);
  useEffect(() => {
    if (!jobId) return;
    const check = () => {
      if (!isJobWaiting(jobId)) setDiagnosisDone(true);
    };
    check();
    return subscribeWaiting(check);
  }, [jobId]);

  // クリアしたら、ルーンストーンを、もらう（診断を待っているとき）。もらえた量は、ゴールのパネルに出す
  const [reward, setReward] = useState<RewardResult | null>(null);
  useEffect(() => {
    if (phase === 'ready' || phase === 'countdown') setReward(null);
    if (phase !== 'clear' || !jobId) return;
    let cancelled = false;
    claimMinigameReward(jobId, difficultyRef.current).then((r) => {
      if (cancelled || !r) return;
      setReward(r);
      if (typeof r.balance === 'number') window.dispatchEvent(new CustomEvent('stone-balance', { detail: r.balance }));
    });
    return () => {
      cancelled = true;
    };
  }, [phase, jobId]);

  // 一時停止メニュー（スタート前にも開ける。「つづける」で、もとの状態に、もどる）
  const pausedFrom = useRef<'ready' | 'playing'>('playing');
  const togglePause = () => {
    if (phaseRef.current === 'playing') {
      pausedFrom.current = 'playing';
      changePhase('paused');
    } else if (phaseRef.current === 'ready') {
      pausedFrom.current = 'ready';
      changePhase('paused');
    } else if (phaseRef.current === 'paused') {
      if (pausedFrom.current === 'ready') changePhase('ready');
      else startCountdown();
    }
  };

  return (
    <div className="run-backdrop">
      <div className="run-stage" onPointerDown={jump}>
        <canvas ref={canvasRef} width={W * RES} height={H * RES} className="run-canvas" />

        {!loaded && <div className="run-overlay">読み込んでいます…</div>}

        {loaded && phase === 'ready' && (
          <div className="run-overlay run-overlay-ready">
            <div className="run-ready-top">
            <p>タップでジャンプ</p>
            <small>PC：スペースキー／難易度は ←→↑↓</small>
            {jobId && <small className="run-reward-hint">クリアでルーンストーン（1日1回・ふつう 1／むずかしい 2／エクストラ 5）</small>}
            <div className="run-difficulty" onPointerDown={(e) => e.stopPropagation()}>
              {DIFF_ORDER.map((d) => (
                <button key={d} type="button" className={`run-btn${difficulty === d ? ' is-on' : ''}`} onClick={() => chooseDifficulty(d)}>
                  <span className="run-btn-label">{DIFFS[d].label}</span>
                </button>
              ))}
            </div>
            </div>
            <div className="run-start-banner"><span className="run-btn-label">タップで<br />スタート</span></div>
          </div>
        )}

        {phase === 'countdown' && count !== null && (
          <div className="run-overlay run-overlay-count">
            <span key={count} className="run-count">{count}</span>
          </div>
        )}

        {phase === 'paused' && (
          <div className="run-overlay">
            <div className="run-panel">
            <p className="run-panel-title">一時停止中</p>
            <div className="run-panel-buttons">
              <button type="button" className="run-btn run-btn-wide" onPointerDown={(e) => e.stopPropagation()} onClick={togglePause}><span className="run-btn-label">つづける</span></button>
            <button type="button" className="run-btn run-btn-wide" onPointerDown={(e) => e.stopPropagation()} onClick={onClose}><span className="run-btn-label">閉じる</span></button>
            </div>
            </div>
          </div>
        )}

        {phase === 'clear' && jobId && reward && reward.granted > 0 && (
          <div className="run-stone-gift" onPointerDown={(e) => e.stopPropagation()}>
            <StoneGift amount={reward.granted} />
          </div>
        )}

        {(phase === 'clear' || phase === 'miss') && (
          <div className="run-overlay">
            <div className="run-panel">
            <p className="run-panel-title run-result">{phase === 'clear' ? 'ゴール！' : 'ざんねん…'}</p>
            {phase === 'clear' && jobId && reward && (
              <p className="run-reward">
                {reward.granted > 0
                  ? ''
                  : reward.reason === 'daily_limit'
                    ? '今日のルーンストーンはもらいました'
                    : reward.reason === 'already'
                      ? '今日のルーンストーンはもらいました'
                      : reward.reason === 'no_reward'
                        ? 'かんたんではルーンストーンはもらえません'
                        : reward.reason === 'not_waiting'
                          ? '診断の待ち時間を大きく過ぎていたので対象外でした'
                          : reward.reason === 'too_fast'
                            ? 'クリアが早すぎたため対象外でした'
                            : reward.reason === 'no_job'
                              ? 'この診断は対象外でした'
                              : ''}
              </p>
            )}
            <div className="run-panel-buttons">
              <button type="button" className="run-btn run-btn-wide" onPointerDown={(e) => e.stopPropagation()} onClick={restart}><span className="run-btn-label">もういちど</span></button>
            {onSwitchGame && !diagnosisDone ? (
              <button type="button" className="run-btn run-btn-wide" onPointerDown={(e) => e.stopPropagation()} onClick={onSwitchGame}><span className="run-btn-label">次のゲーム</span></button>
            ) : (
              <button type="button" className="run-btn run-btn-wide" onPointerDown={(e) => e.stopPropagation()} onClick={onClose}><span className="run-btn-label">閉じる</span></button>
            )}
            </div>
            </div>
          </div>
        )}

        {diagnosisDone && (
          <button type="button" className="run-done-banner" onPointerDown={(e) => e.stopPropagation()} onClick={onClose}>
            占いができました。結果を見る
          </button>
        )}

        <div className="run-top-buttons" onPointerDown={(e) => e.stopPropagation()}>
          {(phase === 'ready' || phase === 'playing' || phase === 'paused') && (
            <button type="button" onClick={togglePause} aria-label="一時停止">
              <img src={`${BASE}${phase === 'paused' ? 'ui_play_btn' : 'ui_pause_btn'}.png`} alt="" />
            </button>
          )}
        </div>
        <span className="run-lives-sr" aria-live="polite">のこり {lives}</span>
      </div>
    </div>
  );
}

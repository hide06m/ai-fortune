/**
 * ミニゲーム共通の、枠組み（どんぐりキャッチなど、森ランの次のゲームが、使う）
 *
 * 枠組みが、受け持つこと：
 *   画面（縦長 9:16・540×960）／読みこみ／難易度の選択（かんたん・ふつう・むずかしい・エクストラ）／3・2・1のカウントダウン／
 *   一時停止メニュー／ハート／現在地バー／ゴール・ざんねんのパネル／診断を待っている間のルーンストーンの報酬と、表示／
 *   「占いができました」のお知らせ／キー・タッチの入力
 * 各ゲームが、受け持つこと（MiniGameSpec）：
 *   使う画像の名前／はじめの状態／1コマの更新／1コマの描画
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { claimMinigameReward, type RewardResult } from '../api/minigame';
import { isJobWaiting, subscribeWaiting } from '../api/asyncJob';
import { StoneGift } from '../components/StoneGift';
import { RES, dFull, heartPath, loadImageList, loadMusubiScale } from './canvasUtil';

export const W = 540;
export const H = 960;
const BASE = '/assets/games/';

export type Difficulty = 'easy' | 'normal' | 'hard' | 'extra';
export const DIFF_ORDER: Difficulty[] = ['easy', 'normal', 'hard', 'extra'];
export const DIFF_LABEL: Record<Difficulty, string> = { easy: 'かんたん', normal: 'ふつう', hard: 'むずかしい', extra: 'エクストラ' };
export type Phase = 'ready' | 'countdown' | 'playing' | 'paused' | 'clear' | 'miss';
export type Images = Record<string, HTMLImageElement>;

/** 各ゲームが、枠組みに、頼むこと */
export interface GameApi {
  /** ハートを1つ、減らす（0になると、ミス） */
  hurt(): void;
  /** クリア・ミスを、決める */
  clear(): void;
  fail(): void;
  /** 現在地バーの進み具合（0〜1） */
  setProgress(p: number): void;
}

/** 入力（タッチ・マウス・キー） */
export interface InputState {
  /** 画面の中の、横の位置（0〜540）。まだ、触れていなければ null */
  pointerX: number | null;
  left: boolean;
  right: boolean;
}

export interface MiniGameSpec<S> {
  /** 報酬の申請に使う、ゲームの名前 */
  game: string;
  /** 難易度の保存先 */
  storageKey: string;
  imageNames: string[];
  /** 難易度ごとの、ハートの数 */
  lives: Record<Difficulty, number>;
  /** スタート前に出す、操作の案内 */
  hint: string;
  pcHint: string;
  init(diff: Difficulty, images: Images): S;
  update(s: S, dt: number, api: GameApi, input: InputState, diff: Difficulty, images: Images): void;
  draw(ctx: CanvasRenderingContext2D, s: S, images: Images, info: { phase: Phase; time: number; lives: number; lostFlash: number }): void;
}

interface ShellProps<S> {
  spec: MiniGameSpec<S>;
  onClose: () => void;
  /** 診断を待っている間に遊ぶときの、診断のジョブ番号。あれば、クリアで、ルーンストーンがもらえる */
  jobId?: string | null;
  /** ほかのゲームへ、切りかえる（診断がまだ終わっていないとき、ゴール・ざんねんの画面に、出す） */
  onSwitchGame?: () => void;
}

function loadDifficulty(key: string): Difficulty {
  try {
    const v = localStorage.getItem(key) as Difficulty | null;
    return v && DIFF_ORDER.includes(v) ? v : 'normal';
  } catch {
    return 'normal';
  }
}

export function MiniGameShell<S>({ spec, onClose, jobId = null, onSwitchGame }: ShellProps<S>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imagesRef = useRef<Images | null>(null);
  const stateRef = useRef<S | null>(null);
  const phaseRef = useRef<Phase>('ready');
  const [phase, setPhase] = useState<Phase>('ready');
  const [loaded, setLoaded] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>(() => loadDifficulty(spec.storageKey));
  const difficultyRef = useRef<Difficulty>(difficulty);
  const [count, setCount] = useState<number | null>(null);
  const countTimers = useRef<number[]>([]);
  const pausedFrom = useRef<'ready' | 'playing'>('playing');
  const input = useRef<InputState>({ pointerX: null, left: false, right: false });

  // ハート・知らせ・進み具合（描画のために、毎コマ、読む）
  const meta = useRef({ lives: spec.lives[difficulty], maxLives: spec.lives[difficulty], flash: 0, lostIndex: -1, progress: 0, time: 0, outcome: null as null | 'clear' | 'miss' });

  const changePhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const resetGame = useCallback(() => {
    const d = difficultyRef.current;
    meta.current = { lives: spec.lives[d], maxLives: spec.lives[d], flash: 0, lostIndex: -1, progress: 0, time: 0, outcome: null };
    if (imagesRef.current) stateRef.current = spec.init(d, imagesRef.current);
  }, [spec]);

  const chooseDifficulty = useCallback(
    (d: Difficulty) => {
      difficultyRef.current = d;
      setDifficulty(d);
      try {
        localStorage.setItem(spec.storageKey, d);
      } catch {
        /* 保存できなくても、遊べる */
      }
      resetGame();
    },
    [spec, resetGame]
  );

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

  const restart = useCallback(() => {
    resetGame();
    changePhase('ready');
  }, [resetGame, changePhase]);

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

  // 画像の読みこみ
  useEffect(() => {
    const names = [...spec.imageNames, 'ui_run_progress', 'ui_run_head'];
    Promise.all([loadImageList(BASE, names), loadMusubiScale(BASE)]).then(([imgs]) => {
      imagesRef.current = imgs;
      stateRef.current = spec.init(difficultyRef.current, imgs);
      setLoaded(true);
    });
  }, [spec]);

  // 診断ができたことの検知
  const [diagnosisDone, setDiagnosisDone] = useState(false);
  useEffect(() => {
    if (!jobId) return;
    const check = () => {
      if (!isJobWaiting(jobId)) setDiagnosisDone(true);
    };
    check();
    return subscribeWaiting(check);
  }, [jobId]);

  // クリアしたら、ルーンストーンを、もらう（診断を待っているとき）
  const [reward, setReward] = useState<RewardResult | null>(null);
  useEffect(() => {
    if (phase === 'ready' || phase === 'countdown') setReward(null);
    if (phase !== 'clear' || !jobId) return;
    let cancelled = false;
    claimMinigameReward(jobId, difficultyRef.current, spec.game).then((r) => {
      if (cancelled || !r) return;
      setReward(r);
      if (typeof r.balance === 'number') window.dispatchEvent(new CustomEvent('stone-balance', { detail: r.balance }));
    });
    return () => {
      cancelled = true;
    };
  }, [phase, jobId, spec.game]);

  // キー
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const down = e.type === 'keydown';
      if (e.code === 'ArrowLeft') input.current.left = down;
      if (e.code === 'ArrowRight') input.current.right = down;
      if (!down) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (e.repeat) return;
        if (phaseRef.current === 'ready') startCountdown();
        else if (phaseRef.current === 'clear' || phaseRef.current === 'miss') restart();
      } else if (e.code === 'Escape') {
        onClose();
      } else if (phaseRef.current === 'ready' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
        e.preventDefault();
        const i = DIFF_ORDER.indexOf(difficultyRef.current);
        const col = i % 2;
        const row = Math.floor(i / 2);
        let nc = col;
        let nr = row;
        if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') nc = (col + 1) % 2;
        else nr = (row + 1) % 2;
        chooseDifficulty(DIFF_ORDER[nr * 2 + nc]);
      } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, [onClose, startCountdown, restart, chooseDifficulty]);

  // タッチ・マウス：画面の中の、横の位置を、ゲームに伝える
  const updatePointer = (e: React.PointerEvent) => {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    input.current.pointerX = Math.max(0, Math.min(W, ((e.clientX - r.left) / r.width) * W));
  };

  // ゲームのループ
  useEffect(() => {
    if (!loaded) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(RES, 0, 0, RES, 0, 0);
    const imgs = imagesRef.current!;
    let raf = 0;
    let prev = performance.now();
    let errorShown = false;

    const api: GameApi = {
      hurt() {
        const m = meta.current;
        if (m.outcome) return;
        m.lives -= 1;
        m.flash = 0.7;
        m.lostIndex = m.lives;
        if (m.lives <= 0) m.outcome = 'miss';
      },
      clear() {
        if (!meta.current.outcome) meta.current.outcome = 'clear';
      },
      fail() {
        if (!meta.current.outcome) meta.current.outcome = 'miss';
      },
      setProgress(p) {
        meta.current.progress = Math.max(0, Math.min(1, p));
      },
    };

    const frameBody = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      const m = meta.current;
      const ph = phaseRef.current;
      const s = stateRef.current;
      if (!s) return;
      if (ph === 'playing') {
        m.time += dt;
        spec.update(s, dt, api, input.current, difficultyRef.current, imgs);
        if (m.flash > 0) m.flash -= dt;
        if (m.outcome) changePhase(m.outcome);
      }
      ctx.clearRect(0, 0, W, H);
      spec.draw(ctx, s, imgs, { phase: ph, time: m.time, lives: m.lives, lostFlash: m.flash });

      // 現在地バー
      const bar = imgs['ui_run_progress'];
      if (bar && bar.naturalWidth) {
        const bw = 400;
        const bh = bw * (bar.naturalHeight / bar.naturalWidth);
        const bx = (W - bw) / 2;
        const by = 26;
        dFull(ctx, bar, bx, by, bw, bh);
        const head = imgs['ui_run_head'];
        const hs = 42;
        if (head && head.naturalWidth) dFull(ctx, head, bx + bw * 0.1 + bw * 0.8 * m.progress - hs / 2, by + bh / 2 - hs / 2, hs, hs);
      }
      // ハート
      for (let i = 0; i < m.maxLives; i++) {
        const lost = i >= m.lives;
        const just = lost && i === m.lostIndex && m.flash > 0;
        const k = just ? 1 + (m.flash / 0.7) * 0.8 : 1;
        ctx.save();
        ctx.translate(24 + i * 34 + 15, 112 + 17);
        ctx.scale(k, k);
        heartPath(ctx, 28);
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(40, 20, 20, 0.8)';
        ctx.stroke();
        ctx.fillStyle = lost ? (just ? `rgba(255, 90, 110, ${0.4 + 0.6 * (m.flash / 0.7)})` : 'rgba(70, 45, 45, 0.55)') : '#ff6b8b';
        ctx.fill();
        ctx.restore();
      }
      // ぶつかった直後、画面のふちが、ほんのり、赤くなる
      if (m.flash > 0) {
        const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.7);
        grad.addColorStop(0, 'rgba(255, 40, 60, 0)');
        grad.addColorStop(1, `rgba(255, 40, 60, ${0.38 * (m.flash / 0.7)})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }
    };
    const frame = (now: number) => {
      try {
        frameBody(now);
      } catch (e) {
        if (!errorShown) console.error('[MiniGame] frame error', e);
        errorShown = true;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [loaded, spec, changePhase]);

  const showSwitch = !!onSwitchGame && !diagnosisDone;

  return (
    <div className="run-backdrop">
      <div
        className="run-stage"
        ref={stageRef}
        onPointerDown={(e) => {
          updatePointer(e);
          if (phaseRef.current === 'ready') startCountdown();
        }}
        onPointerMove={updatePointer}
      >
        <canvas ref={canvasRef} width={W * RES} height={H * RES} className="run-canvas" />

        {!loaded && <div className="run-overlay">読み込んでいます…</div>}

        {loaded && phase === 'ready' && (
          <div className="run-overlay run-overlay-ready">
            <div className="run-ready-top">
              <p>{spec.hint}</p>
              <small>{spec.pcHint}</small>
              {jobId && <small className="run-reward-hint">クリアで、ルーンストーン（1日1回・ふつう 1／むずかしい 2／エクストラ 5）</small>}
              <div className="run-difficulty" onPointerDown={(e) => e.stopPropagation()}>
                {DIFF_ORDER.map((d) => (
                  <button key={d} type="button" className={`run-btn${difficulty === d ? ' is-on' : ''}`} onClick={() => chooseDifficulty(d)}>
                    <span className="run-btn-label">{DIFF_LABEL[d]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="run-start-banner">
              <span className="run-btn-label">
                タップで
                <br />
                スタート
              </span>
            </div>
          </div>
        )}

        {phase === 'countdown' && count !== null && (
          <div className="run-overlay run-overlay-count">
            <span key={count} className="run-count">
              {count}
            </span>
          </div>
        )}

        {phase === 'paused' && (
          <div className="run-overlay">
            <div className="run-panel">
              <p className="run-panel-title">一時停止中</p>
              <div className="run-panel-buttons">
                <button type="button" className="run-btn run-btn-wide" onPointerDown={(e) => e.stopPropagation()} onClick={togglePause}>
                  <span className="run-btn-label">つづける</span>
                </button>
                <button type="button" className="run-btn run-btn-wide" onPointerDown={(e) => e.stopPropagation()} onClick={onClose}>
                  <span className="run-btn-label">閉じる</span>
                </button>
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
                    : reward.reason === 'daily_limit' || reward.reason === 'already'
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
                <button type="button" className="run-btn run-btn-wide" onPointerDown={(e) => e.stopPropagation()} onClick={restart}>
                  <span className="run-btn-label">もういちど</span>
                </button>
                {showSwitch ? (
                  <button type="button" className="run-btn run-btn-wide" onPointerDown={(e) => e.stopPropagation()} onClick={onSwitchGame}>
                    <span className="run-btn-label">次のゲーム</span>
                  </button>
                ) : (
                  <button type="button" className="run-btn run-btn-wide" onPointerDown={(e) => e.stopPropagation()} onClick={onClose}>
                    <span className="run-btn-label">閉じる</span>
                  </button>
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
          {(phase === 'ready' || phase === 'playing' || phase === 'paused' || phase === 'clear' || phase === 'miss') && (
            <button
              type="button"
              onClick={() => {
                if (phase === 'clear' || phase === 'miss') {
                  onClose();
                } else {
                  togglePause();
                }
              }}
              aria-label="一時停止"
            >
              <img src={`${BASE}${phase === 'paused' ? 'ui_play_btn' : 'ui_pause_btn'}.png`} alt="" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

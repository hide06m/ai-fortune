/**
 * 効果音（SE）とミニゲームの BGM
 * - 音量・ON/OFF は、設定画面（audio.ts）の BGM／SE の設定に従う
 * - ミニゲームの間は、館の BGM などを、いったん止める（duckMainBgm）。閉じたら、元に戻す
 * - 音は、最初のタッチのあとでないと、鳴らない（ブラウザの決まり）。タップで始めるので、問題ない
 */

import { useEffect, useRef } from 'react';
import { Howl } from 'howler';
import { getBgmVolume, getSeVolume, isBgmMuted, isSeMuted, subscribeAudioPrefs, duckMainBgm, resumeAudio } from './audio';

const BASE = '/assets/audio/';
const WAV = new Set(['acorn_gold', 'heart_lost', 'mail_open', 'notice_chime', 'pause_close', 'pause_open', 'run_hit', 'run_land', 'ui_difficulty', 'ui_start']);

export type SeName =
  | 'ui_tap' | 'ui_difficulty' | 'ui_start' | 'count_go' | 'pause_open' | 'pause_close'
  | 'heart_lost' | 'clear_fanfare' | 'miss_jingle' | 'stone_get' | 'notice_chime'
  | 'run_jump' | 'run_land' | 'run_hit' | 'run_bird' | 'run_goal'
  | 'acorn_catch' | 'acorn_big' | 'acorn_gold' | 'acorn_poison' | 'acorn_miss' | 'time_warn'
  | 'gacha_walk' | 'gacha_new' | 'gacha_dup' | 'shop_buy' | 'mail_open' | 'stamp';

/** 各音の基準の音量（利用者の SE 音量が 100% のとき） */
const SE_BASE: Partial<Record<SeName, number>> = {
  ui_tap: 0.5, ui_difficulty: 0.6, ui_start: 0.7, count_go: 0.7, pause_open: 0.6, pause_close: 0.6,
  heart_lost: 0.8, clear_fanfare: 0.8, miss_jingle: 0.7, stone_get: 0.8, notice_chime: 0.7,
  run_jump: 0.6, run_land: 0.5, run_hit: 0.8, run_bird: 0.5, run_goal: 0.8,
  acorn_catch: 0.6, acorn_big: 0.7, acorn_gold: 0.8, acorn_poison: 0.7, acorn_miss: 0.25, time_warn: 0.6,
  gacha_walk: 0.7, gacha_new: 0.8, gacha_dup: 0.7, shop_buy: 0.7, mail_open: 0.6, stamp: 0.7,
};

const cache = new Map<string, Howl>();

function howl(name: string): Howl {
  let h = cache.get(name);
  if (!h) {
    h = new Howl({ src: [`${BASE}${name}.${WAV.has(name) ? 'wav' : 'mp3'}`], preload: true });
    cache.set(name, h);
  }
  return h;
}

/** 使う音を、先に読みこんでおく（初めて鳴らすときの、遅れを防ぐ） */
export function preloadSe(names: SeName[]) {
  try {
    names.forEach((n) => howl(n));
  } catch {
    /* 音が読めなくても、遊べる */
  }
}

export function playSe(name: SeName, opts: { volume?: number; rate?: number } = {}) {
  if (isSeMuted()) return;
  resumeAudio();
  try {
    const h = howl(name);
    const id = h.play();
    h.volume((SE_BASE[name] ?? 0.7) * (opts.volume ?? 1) * getSeVolume(), id);
    if (opts.rate) h.rate(opts.rate, id);
  } catch {
    /* 音が鳴らなくても、遊べる */
  }
}

// ───── 歯車（待ち画面）：2〜3秒のあたりを、くりかえす ─────
let gear: Howl | null = null;
let gearId: number | undefined;
let gearWanted = false; // 待ち画面が出ている
let gearHeld = 0; // ミニゲームなどで、一時的に止めている数

function gearVolume() {
  return gearHeld > 0 || isSeMuted() ? 0 : 0.35 * getSeVolume();
}
function gearApply() {
  if (!gear) return;
  if (gearWanted) {
    if (gearId === undefined || !gear.playing(gearId)) gearId = gear.play('loop');
    gear.volume(gearVolume(), gearId);
  } else if (gearId !== undefined) {
    gear.stop(gearId);
    gearId = undefined;
  }
}
export function setGearSound(on: boolean) {
  if (!gear) gear = new Howl({ src: [`${BASE}gear_loop.mp3`], sprite: { loop: [2000, 1000, true] } });
  gearWanted = on;
  gearApply();
}
/** ミニゲームが開いている間は、歯車の音を、止める */
export function holdGearSound(hold: boolean) {
  gearHeld = Math.max(0, gearHeld + (hold ? 1 : -1));
  gearApply();
}

// ───── ミニゲームの BGM ─────
let mini: Howl | null = null;
let miniName = '';
let miniRate = 1;

function miniVolume() {
  return 0.5 * getBgmVolume();
}

export function startMiniBgm(name: string, rate = 1) {
  if (mini && miniName === name) {
    mini.rate(rate);
    miniRate = rate;
    if (!mini.playing()) mini.play();
    mini.volume(miniVolume());
    return;
  }
  stopMiniBgm(false);
  miniName = name;
  miniRate = rate;
  mini = new Howl({ src: [`${BASE}${name}.mp3`], loop: true, volume: miniVolume(), rate, mute: isBgmMuted() });
  mini.play();
}
export function pauseMiniBgm() {
  mini?.pause();
}
export function resumeMiniBgm() {
  if (mini && !mini.playing()) {
    mini.rate(miniRate);
    mini.play();
  }
}
export function stopMiniBgm(fade = true) {
  const h = mini;
  mini = null;
  miniName = '';
  if (!h) return;
  if (fade && h.playing()) {
    h.fade(h.volume(), 0, 500);
    window.setTimeout(() => h.unload(), 520);
  } else h.unload();
}

// 設定（音量・ON/OFF）が変わったとき、鳴っているものに反映する
subscribeAudioPrefs(() => {
  mini?.volume(miniVolume());
  mini?.mute(isBgmMuted());
  gearApply();
});

/** ミニゲームが開いている間、館のBGMを止める（閉じたら戻す）。ゲームの画面の中で、1回だけ使う */
export function useMainBgmDuck(active = true) {
  useEffect(() => {
    if (!active) return;
    duckMainBgm(true);
    holdGearSound(true);
    return () => {
      duckMainBgm(false);
      holdGearSound(false);
    };
  }, [active]);
}

/**
 * ミニゲームの BGM を、ゲームの進み具合に合わせて、鳴らす／止める
 * ready … そのまま（選択画面の BGM）／countdown・playing … 鳴らす／paused … 一時停止／clear・miss … フェードアウト
 */
export function useMiniGameBgm(bgm: string, rate: number, phase: string) {
  const prev = useRef(phase);
  useEffect(() => {
    if (phase === 'ready') {
      // 何もしない（選択画面の BGM が、そのまま続く）
    } else if (phase === 'countdown') startMiniBgm(bgm, rate);
    else if (phase === 'playing') {
      if (prev.current === 'paused') resumeMiniBgm();
      else startMiniBgm(bgm, rate);
    } else if (phase === 'paused') pauseMiniBgm();
    else stopMiniBgm(true);
    prev.current = phase;
  }, [bgm, rate, phase]);
  useEffect(() => () => stopMiniBgm(false), []);
}

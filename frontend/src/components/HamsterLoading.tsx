/**
 * ハムスター走りアニメーション（ローディング画面）
 * 速度調整版：1秒に2回転（0.5秒/1回転）
 *
 * ハムスターは18コマの個別画像（/assets/run/frames/f00.webp〜f17.webp）を
 * requestAnimationFrame で経過時間ベースに切り替えて表示する。
 * 当初はCSSスプライトシート（background-position）方式だったが、
 * ブラウザが画像全体を縮小表示する際に隣接コマが滲んで混ざる問題があり、
 * コマごとの個別画像切り替え方式に変更した。
 */

import React, { useEffect, useRef, useState } from 'react';
import '../styles/hamster-loading.css';
import { pickRandomLoadingMessage } from '../data/loadingMessages';
import { detachWaitingJobs, hasDetachableWaiting, subscribeWaiting } from '../api/asyncJob';

const FRAME_COUNT = 18;
const CYCLE_DURATION_MS = 500; // 0.5秒で1周（車輪の回転と同期、1秒に2回転）
const FRAME_URLS = Array.from(
  { length: FRAME_COUNT },
  (_, i) => `/assets/run/frames/f${String(i).padStart(2, '0')}.webp`
);

interface HamsterLoadingProps {
  message?: string;
  isVisible?: boolean;
  /** 「推定時間：あと○秒」を出すか（所要時間が読めない処理では false にして、代わりに hint を渡す） */
  showEstimate?: boolean;
  /** メッセージの下に出す補足 */
  hint?: string;
}

/** メッセージを切り替える間隔 */
const MESSAGE_INTERVAL_MS = 3000;

// message は後方互換のために残している。待ち受け画面のメッセージは、どの画面でも、世界観の文言からランダムに選び、3秒ごとに切り替える
export function HamsterLoading({ isVisible = true, showEstimate = true, hint }: HamsterLoadingProps) {
  const [flavor, setFlavor] = useState(() => pickRandomLoadingMessage());
  const [estimatedTime, setEstimatedTime] = useState(3); // 推定時間（秒）
  // 長くかかっているとき（AIの混雑など）は、止まったと思われないよう、待っていてよいことを伝える
  const [elapsedSec, setElapsedSec] = useState(0);
  const [detachable, setDetachable] = useState(() => hasDetachableWaiting());
  useEffect(() => subscribeWaiting(() => setDetachable(hasDetachableWaiting())), []);
  useEffect(() => {
    const t = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setFlavor((cur) => pickRandomLoadingMessage(cur)), MESSAGE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);
  const [frameIndex, setFrameIndex] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    // 5秒ごとに推定時間を更新
    const interval = setInterval(() => {
      setEstimatedTime((prev) => Math.min(prev + 2, 10));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // コマ画像を事前読み込み（初回表示時のちらつき防止）
    FRAME_URLS.forEach((url) => {
      const img = new Image();
      img.src = url;
    });

    let rafId: number;
    const tick = (time: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = time;
      }
      const elapsed = time - startTimeRef.current;
      const progress = (elapsed % CYCLE_DURATION_MS) / CYCLE_DURATION_MS;
      setFrameIndex(Math.floor(progress * FRAME_COUNT) % FRAME_COUNT);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="hamster-loading-container">
      <div className="hamster-loader">
        {/* 車輪：CSS で 0.5 秒で 1 回転（1 秒に 2 回転） */}
        <div className="wheel"></div>

        {/* ハムスター：18 コマを 0.5 秒で 1 周 */}
        <img className="hamster" src={FRAME_URLS[frameIndex]} alt="" />

        {/* 影 */}
        <div className="loader-shadow"></div>
      </div>

      {/* メッセージ */}
      <div className="loading-message">
        <p className="main-message">✨ {flavor}</p>
        {showEstimate && elapsedSec < 20 && <p className="estimate">推定時間：あと {estimatedTime} 秒</p>}
        {elapsedSec >= 20 && (
          <p className="estimate">いま占いの依頼が混み合っています。順番に試していますので画面を閉じずにこのままお待ちください（{elapsedSec}秒）</p>
        )}
        {hint && <p className="estimate">{hint}</p>}
        {elapsedSec >= 90 && (
          <p className="estimate">時間がかかっています。もう少しお待ちください。</p>
        )}
        {detachable && elapsedSec >= 3 && (
          <div className="hamster-minigame">
            <button type="button" className="hamster-minigame-btn" onClick={() => window.dispatchEvent(new CustomEvent('open-minigame'))}>
              ミニゲームで待つ
            </button>
            <small>クリアでルーンストーンがもらえます</small>
          </div>
        )}
        {elapsedSec >= 20 && detachable && (
          <button type="button" className="hamster-detach-btn" onClick={detachWaitingJobs}>
            待たずに他のことをする（できたらお知らせします）
          </button>
        )}

        {/* ドット animation */}
        <div className="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  );
}

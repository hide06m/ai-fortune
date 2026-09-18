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

const FRAME_COUNT = 18;
const CYCLE_DURATION_MS = 500; // 0.5秒で1周（車輪の回転と同期、1秒に2回転）
const FRAME_URLS = Array.from(
  { length: FRAME_COUNT },
  (_, i) => `/assets/run/frames/f${String(i).padStart(2, '0')}.webp`
);

interface HamsterLoadingProps {
  message?: string;
  isVisible?: boolean;
}

export function HamsterLoading({ message = 'AI が思考中...', isVisible = true }: HamsterLoadingProps) {
  const [estimatedTime, setEstimatedTime] = useState(3); // 推定時間（秒）
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
        <p className="main-message">✨ {message}</p>
        <p className="estimate">推定時間：あと {estimatedTime} 秒</p>

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

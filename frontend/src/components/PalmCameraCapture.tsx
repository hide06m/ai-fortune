/**
 * 手のひら撮影用カメラコンポーネント（コクウの手相診断で使用）
 * スマホ本体からの直接診断フロー・PC↔スマホQR連携フローの両方で共有する
 */

import React, { useEffect, useRef, useState } from 'react';
import '../styles/palm-capture.css';
import { assessImageQuality, type ImageQualityResult } from '../utils/imageQuality';
import { analyzePalmImage } from '../utils/palmCapture';
import { REQUIRED_HAND, preloadHandLandmarker } from '../utils/palmDetect';
import type { PalmExtras } from '../api/palmistry';

interface PalmCameraCaptureProps {
  onCapture: (imageBase64: string, mimeType: string, extras?: PalmExtras) => void;
}

const HAND_NAME = REQUIRED_HAND === 'left' ? '左手' : '右手';
const CAPTURE_MAX_WIDTH = 1024;
const LIVE_CHECK_INTERVAL_MS = 600;

const REASON_MESSAGES: Record<NonNullable<ImageQualityResult['reason']>, string> = {
  dark: '暗すぎます。明るい場所で撮影してください',
  blurry: 'ピントが合っていません。手のひらとカメラを安定させてください',
};

export function PalmCameraCapture({ onCapture }: PalmCameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState('');
  const [liveQuality, setLiveQuality] = useState<ImageQualityResult | null>(null);
  const [retakeMessage, setRetakeMessage] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  // 手の検出の準備の状況（画面を開いた時点で先に読み込み始める）
  const [detectorState, setDetectorState] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Failed to start camera:', err);
        setCameraError('カメラを起動できませんでした。ブラウザのカメラ権限をご確認ください。');
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // 手の検出の準備を、撮影ボタンを押す前に始めておく
  useEffect(() => {
    const startedAt = performance.now();
    let cancelled = false;
    preloadHandLandmarker().then((ok) => {
      console.info(`[palm] 手の検出の準備 ${ok ? '完了' : '失敗'}（${Math.round(performance.now() - startedAt)}ms）`);
      if (!cancelled) setDetectorState(ok ? 'ready' : 'failed');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ライブプレビュー中、明るさ・ピントを定期的にチェックして先出しでフィードバックする
  useEffect(() => {
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      try {
        setLiveQuality(assessImageQuality(video));
      } catch {
        // 解析失敗時は無視（次の間隔で再試行）
      }
    }, LIVE_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const handleShutter = async () => {
    console.info('[palm] 撮影ボタン', { analyzing, readyState: videoRef.current?.readyState, width: videoRef.current?.videoWidth });
    if (analyzing) return;
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth) {
      // 何も表示せずに無視すると、「押しても何も起こらない」ように見えるので、理由を出す
      setRetakeMessage('カメラの映像を準備しています。映像が映ってから、もう一度押してください。');
      return;
    }

    const scale = Math.min(1, CAPTURE_MAX_WIDTH / video.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const quality = assessImageQuality(canvas);
    if (!quality.ok) {
      setRetakeMessage(REASON_MESSAGES[quality.reason!]);
      return;
    }

    setRetakeMessage('');
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64 = dataUrl.split(',')[1];

    // 手相の線を検出する。手が違う・見つからないときは撮り直し。解析自体が失敗しても診断は続ける（線の表示がなくなるだけ）
    setAnalyzing(true);
    const analysis = await analyzePalmImage(canvas);
    setAnalyzing(false);
    if (analysis.status === 'retake') {
      setRetakeMessage(analysis.message);
      return;
    }
    onCapture(base64, 'image/jpeg', analysis.status === 'ok' ? { lines: analysis.lines } : undefined);
  };

  return (
    <div className="palm-capture">
      {cameraError ? (
        <div className="error">{cameraError}</div>
      ) : (
        <>
          <div className="palm-capture-viewport">
            <video ref={videoRef} autoPlay playsInline muted className="palm-capture-video" />
            <svg className="palm-capture-guide" viewBox="0 0 200 260" preserveAspectRatio="xMidYMid meet">
              <path
                d="M100 250 C70 250 55 220 55 190 L52 110 C52 100 60 92 68 92 C76 92 82 100 82 110 L84 60 C84 50 92 42 100 42 C108 42 116 50 116 60 L116 100 C116 90 124 82 132 82 C140 82 148 90 148 100 L148 150 C160 155 168 168 168 185 C168 220 145 250 100 250 Z"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeDasharray="6 4"
                opacity="0.85"
              />
            </svg>
            {liveQuality && !liveQuality.ok && (
              <div className="palm-capture-hint">{REASON_MESSAGES[liveQuality.reason!]}</div>
            )}
          </div>

          <p className="palm-capture-instruction">{HAND_NAME}の手のひらを、白い枠に合わせてください</p>

          {retakeMessage && <div className="error">{retakeMessage}</div>}

          {detectorState === 'loading' && (
            <p className="palm-capture-hint-line">手の検出の準備中です（初回は数十秒かかることがあります）…</p>
          )}
          {detectorState === 'failed' && (
            <p className="palm-capture-hint-line">この端末では、手相の線の検出を使えません。線の表示なしで診断します。</p>
          )}

          <button type="button" className="primary-button palm-capture-shutter" onClick={handleShutter} disabled={analyzing}>
            {analyzing ? '手相の線を解析しています…（最大30秒）' : '📷 撮影する'}
          </button>
        </>
      )}
    </div>
  );
}

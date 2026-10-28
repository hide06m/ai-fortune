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
  /** false なら、端末では線の解析をせず、撮影した写真をすぐ渡す（解析はPC側で行う） */
  analyzeOnDevice?: boolean;
  /** 最初から表示しておく案内（撮り直しの理由など） */
  initialMessage?: string;
  onCapture: (imageBase64: string, mimeType: string, extras?: PalmExtras) => void;
}

const HAND_NAME = REQUIRED_HAND === 'left' ? '左手' : '右手';
const CAPTURE_MAX_WIDTH = 1024;
const LIVE_CHECK_INTERVAL_MS = 600;
// 手のひらを向けた手の輪郭（親指が画像の左）。5本の指の長さに差をつけ、手首まで描く
const HAND_OUTLINE =
  'M72 255 C66 235 60 215 58 198 C48 188 34 168 26 146 C22 134 24 124 32 122 C40 120 46 128 52 138 C58 148 64 160 68 168 ' +
  'L68 76 C68 64 73 58 78.5 58 C84 58 89 64 89 76 L89 120 Q91.5 127 94 120 L94 48 C94 36 99 32 105 32 C111 32 116 36 116 48 ' +
  'L116 118 Q118.5 125 121 118 L121 62 C121 50 126 47 131.5 47 C137 47 142 50 142 62 L142 124 Q144.5 131 147 124 ' +
  'L147 100 C147 90 151 86 155 86 C159 86 163 90 163 100 L163 150 C166 175 160 215 152 235 C148 245 140 252 130 255';

const REASON_MESSAGES: Record<NonNullable<ImageQualityResult['reason']>, string> = {
  dark: '暗すぎます。明るい場所で撮影してください',
  blurry: 'ピントが合っていません。手のひらとカメラを安定させてください',
};

export function PalmCameraCapture({ onCapture, analyzeOnDevice = true, initialMessage }: PalmCameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState('');
  const [liveQuality, setLiveQuality] = useState<ImageQualityResult | null>(null);
  const [retakeMessage, setRetakeMessage] = useState(initialMessage ?? '');
  const [analyzing, setAnalyzing] = useState(false);
  // 撮影した瞬間の写真（あれば、撮影完了の画面を出す）
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  // 撮影した写真を、本人が見て確かめる段階（「この写真で診断する」か「撮り直す」を選ぶまで、送らない）
  const [reviewing, setReviewing] = useState(false);
  const shotRef = useRef<HTMLCanvasElement | null>(null);
  // ライト（懐中電灯）：端末が対応しているときだけ使える。暗いと自動でつけ、本人がいつでも切り替えられる
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const torchManualRef = useRef(false);
  const darkCountRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  // 画面の一番下に出す、動作の記録（スマホではコンソールが見られないので、画面で確認できるようにする）
  const [trace, setTrace] = useState<string[]>([]);
  const note = (text: string) => setTrace((t) => [...t.slice(-5), text]);
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
        const track = stream.getVideoTracks()[0];
        trackRef.current = track ?? null;
        try {
          const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean };
          if (caps.torch) setTorchSupported(true);
        } catch {
          /* ライトに対応していない端末では、ボタンを出さない */
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

  const torchOnRef = useRef(false);
  const applyTorchRef = useRef<(on: boolean) => Promise<void>>(async () => {});
  const applyTorch = async (on: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      setTorchOn(on);
    } catch (err) {
      console.warn('[palm] ライトを切り替えられませんでした', err);
    }
  };
  torchOnRef.current = torchOn;
  applyTorchRef.current = applyTorch;
  const toggleTorch = () => {
    torchManualRef.current = true; // 本人が切り替えたら、自動の判断は、以後しない
    void applyTorch(!torchOn);
  };

  // ライブプレビュー中、明るさ・ピントを定期的にチェックして先出しでフィードバックする
  useEffect(() => {
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      try {
        const q = assessImageQuality(video);
        setLiveQuality(q);
        // 暗い状態が続いたら（2回連続）、自動でライトをつける。本人が切り替えたあとは、自動では動かさない
        if (!q.ok && q.reason === 'dark') darkCountRef.current += 1;
        else darkCountRef.current = 0;
        if (darkCountRef.current >= 2 && trackRef.current && !torchManualRef.current && !torchOnRef.current) {
          const caps = (trackRef.current.getCapabilities?.() ?? {}) as { torch?: boolean };
          if (caps.torch) void applyTorchRef.current(true);
        }
      } catch {
        // 解析失敗時は無視（次の間隔で再試行）
      }
    }, LIVE_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // 解析中は、経過秒数を数えて「止まっていない」ことを見せる
  useEffect(() => {
    if (!analyzing) return;
    setElapsed(0);
    const timer = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [analyzing]);

  // 撮影ボタン：映像を1枚の写真に固定して、本人に見せる（まだ診断には送らない）
  const handleShutter = () => {
    note('ボタンを押した');
    console.info('[palm] 撮影ボタン', { analyzing, readyState: videoRef.current?.readyState, width: videoRef.current?.videoWidth });
    if (analyzing) return;
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth) {
      // 何も表示せずに無視すると、「押しても何も起こらない」ように見えるので、理由を出す
      note('映像が未準備');
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

    shotRef.current = canvas;
    setRetakeMessage('');
    setCapturedUrl(canvas.toDataURL('image/jpeg', 0.8));
    setReviewing(true);
    note('写真を固定（確認待ち）');
  };

  // 「撮り直す」：写真を捨てて、カメラに戻る（ルーンストーンは、まだ使っていない）
  const handleRetake = () => {
    shotRef.current = null;
    setCapturedUrl(null);
    setReviewing(false);
    setRetakeMessage('');
    note('撮り直し');
  };

  // 「この写真で診断する」：ここで初めて、解析と診断へ進む
  const handleConfirm = async () => {
    const canvas = shotRef.current;
    if (!canvas || analyzing) return;
    setReviewing(false);
    // 重い処理の前に、待ち表示を先に出す（出さないと、数秒、画面が固まって見える）
    setAnalyzing(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    note('処理開始');
    try {
      // 明るさ・ピントの警告は、ライブ表示で出している。ここでは止めずに進める（手の検出が最終的に判断する）
      const quality = assessImageQuality(canvas);
      console.info('[palm] 画質', quality);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const base64 = dataUrl.split(',')[1];
      if (!analyzeOnDevice) {
        // 解析はPC側で行う。写真をすぐ渡して、送信へ進む
        note('送信へ');
        setAnalyzing(false);
        onCapture(base64, 'image/jpeg');
        return;
      }

      // 手相の線を検出する。手が違う・見つからないときは撮り直し。解析自体が失敗しても診断は続ける（線の表示がなくなるだけ）
      const analysis = await analyzePalmImage(canvas);
      setAnalyzing(false);
      note('解析結果: ' + analysis.status + (analysis.status === 'ok' ? '（線' + analysis.lines.length + '本）' : ''));
      if (analysis.status === 'retake') {
        // 撮り直し：カメラの画面へ戻し、理由を出す
        setCapturedUrl(null);
        setRetakeMessage(analysis.message);
        return;
      }
      onCapture(base64, 'image/jpeg', analysis.status === 'ok' ? { lines: analysis.lines } : undefined);
    } catch (error) {
      // 例外で止まると画面が固まって見えるので、カメラに戻して理由を出す
      console.error('[palm] 撮影処理で例外', error);
      note('エラー: ' + (error instanceof Error ? error.message : String(error)));
      setAnalyzing(false);
      setCapturedUrl(null);
      setRetakeMessage('撮影の処理でエラーが起きました。もう一度撮影してください。');
    }
  };

  return (
    <div className="palm-capture">
      {cameraError ? (
        <div className="error">{cameraError}</div>
      ) : (
        <>
          {capturedUrl && (
            <div className="palm-capture-done">
              {reviewing ? (
                <>
                  <h2>📷 この写真でよろしいですか？</h2>
                  <img src={capturedUrl} alt="撮影した手のひら" className="palm-capture-done-image" />
                  <p className="palm-capture-hint-line">手のひらの線がはっきり見えて、ぶれていなければ、診断に進んでください。「診断する」を押すまで、ルーンストーンは使いません。</p>
                  <div className="palm-capture-review-actions">
                    <button type="button" className="palm-capture-retake" onClick={handleRetake}>
                      撮り直す
                    </button>
                    <button type="button" className="primary-button" onClick={handleConfirm}>
                      この写真で診断する
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2>📷 撮影しました</h2>
                  <img src={capturedUrl} alt="撮影した手のひら" className="palm-capture-done-image" />
                  <p className="palm-capture-done-status">
                    {analyzing ? `手相の線を解析しています…（${elapsed}秒）` : analyzeOnDevice ? '診断の準備をしています…' : '写真をPCへ送っています…'}
                  </p>
                  <p className="palm-capture-hint-line">スマホはそのままで大丈夫です。終わると自動で次へ進みます。</p>
                </>
              )}
            </div>
          )}
          <div className="palm-capture-viewport" style={capturedUrl ? { display: 'none' } : undefined}>
            <video ref={videoRef} autoPlay playsInline muted className="palm-capture-video" />
            <svg className="palm-capture-guide" viewBox="0 0 200 260" preserveAspectRatio="xMidYMid meet">
              {/* 手のひらを向けた手の輪郭（親指が画像の左＝左手。右手のときは左右を反転する） */}
              <g transform={REQUIRED_HAND === 'left' ? undefined : 'translate(200 0) scale(-1 1)'}>
                <path
                  d={HAND_OUTLINE}
                  fill="rgba(255,255,255,0.06)"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray="6 4"
                  opacity="0.9"
                />
              </g>
            </svg>
            {torchSupported && (
              <button type="button" className={`palm-capture-torch${torchOn ? ' is-on' : ''}`} onClick={toggleTorch} aria-pressed={torchOn}>
                {torchOn ? '🔦 ライト ON' : '🔦 ライト OFF'}
              </button>
            )}
            {liveQuality && !liveQuality.ok && (
              <div className="palm-capture-hint">{REASON_MESSAGES[liveQuality.reason!]}</div>
            )}
          </div>

          {!capturedUrl && <p className="palm-capture-instruction">{HAND_NAME}の手のひらを、白い枠に合わせてください</p>}

          {retakeMessage && <div className="error">{retakeMessage}</div>}

          {!capturedUrl && detectorState === 'loading' && (
            <p className="palm-capture-hint-line">手の検出の準備中です（初回は数十秒かかることがあります）…</p>
          )}
          {!capturedUrl && detectorState === 'failed' && (
            <p className="palm-capture-hint-line">この端末では、手相の線の検出を使えません。線の表示なしで診断します。</p>
          )}

          {!capturedUrl && (
            <button type="button" className="primary-button palm-capture-shutter" onClick={handleShutter}>
              📷 撮影する
            </button>
          )}
        </>
      )}
      {trace.length > 0 && <p className="palm-capture-trace">{trace.join(' → ')}</p>}
    </div>
  );
}

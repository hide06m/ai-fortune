/**
 * 手相診断のPC側画面：QRコードを表示し、スマホでの撮影完了をポーリングで待つ（コクウ専用）
 */

import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  createPalmSession,
  getPalmSessionStatus,
  fetchPalmSessionImage,
  requestPalmRetake,
  submitPalmistry,
  type PalmistryResponse,
} from '../api/palmistry';
import { analyzePalmImage } from '../utils/palmCapture';

/** base64の写真を、解析用のcanvasに描く */
async function imageToCanvas(base64: string, mimeType: string): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.src = `data:${mimeType};base64,${base64}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d')!.drawImage(img, 0, 0);
  return canvas;
}

interface PalmQRHandoffPageProps {
  onComplete: (response: PalmistryResponse) => void;
  onCancel: () => void;
}

const POLL_INTERVAL_MS = 2500;

export function PalmQRHandoffPage({ onComplete, onCancel }: PalmQRHandoffPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [diagnosing, setDiagnosing] = useState(false);
  // 診断の前に、PC側で手相の線を解析している間の表示
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [notice, setNotice] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [elapsed, setElapsed] = useState(0);
  // onComplete は親の再描画のたびに別の関数になるので、問い合わせの仕組みには ref 経由で渡す
  // （依存に入れると、再描画のたびに問い合わせが作り直される）
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  // 診断の送信は一度だけ（問い合わせが重なって、同じ画像を二重に送らないように）
  const submittedRef = useRef(false);
  // 撮り直しの後に、ポーリングをやり直すための番号
  const [pollKey, setPollKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const session = await createPalmSession();
      if (cancelled) return;
      if (!session.success || !session.token) {
        setError('セッションの作成に失敗しました。');
        return;
      }
      setToken(session.token);

      // スマホ実機テスト時は VITE_QR_ORIGIN（トンネルのURL）を指定する。未指定なら今開いているオリジン
      const qrOrigin = import.meta.env.VITE_QR_ORIGIN || window.location.origin;
      const url = `${qrOrigin}/palm-capture/${session.token}`;
      setQrUrl(url);
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // QRの画面が（再）表示されるたびに描く（撮り直しで画面が切り替わった後も、QRが消えないように）
  useEffect(() => {
    if (!qrUrl || analyzingPhoto || diagnosing || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, qrUrl, { width: 240 }).catch((err) => console.error('Failed to render QR code:', err));
  }, [qrUrl, analyzingPhoto, diagnosing, error]);

  useEffect(() => {
    if (!token) return;

    const interval = setInterval(async () => {
      try {
        const result = await getPalmSessionStatus(token);
        if (result.status === 'uploaded' && !submittedRef.current) {
          submittedRef.current = true;
          clearInterval(interval);
          setNotice('');
          setAnalyzingPhoto(true);
          let lines: unknown[] | undefined;
          try {
            // スマホは重い解析をしない。写真はPCで解析する（手が違う・見つからないときは、スマホへ撮り直しを伝える）
            const image = await fetchPalmSessionImage(token);
            if (image.success && image.imageBase64 && image.mimeType) {
              const analysis = await analyzePalmImage(await imageToCanvas(image.imageBase64, image.mimeType));
              if (analysis.status === 'retake') {
                await requestPalmRetake(token, analysis.message);
                setNotice(`撮り直しをお願いしました：${analysis.message}`);
                setAnalyzingPhoto(false);
                submittedRef.current = false;
                setPollKey((n) => n + 1);
                return;
              }
              if (analysis.status === 'ok') lines = analysis.lines;
            }
          } catch (err) {
            console.error('Palm analysis on PC failed (continuing without lines):', err);
          }
          setAnalyzingPhoto(false);
          setDiagnosing(true);
          setElapsed(0);
          try {
            const response = await submitPalmistry({ token, concern: '', lines });
            if (response.success) {
              onCompleteRef.current(response);
            } else {
              setError(response.message || response.error || '診断に失敗しました。');
              setDiagnosing(false);
            }
          } catch (err) {
            // 診断の呼び出しが例外で終わっても、「読み解いています」のまま固まらないようにする
            console.error('Palmistry diagnosis failed:', err);
            setError('診断に失敗しました。もう一度お試しください。');
            setDiagnosing(false);
          }
        }
      } catch (err) {
        console.error('Failed to poll palm session status:', err);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [token, pollKey]);

  // 診断中は、経過時間を数える（混雑すると1分以上かかるため、止まっていないことを見せる）
  useEffect(() => {
    if (!diagnosing) return;
    const timer = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [diagnosing]);

  if (analyzingPhoto) {
    return (
      <div className="palm-qr-handoff">
        <p>スマホの写真を受け取りました。手相の線を解析しています...</p>
      </div>
    );
  }

  if (diagnosing) {
    return (
      <div className="palm-qr-handoff">
        <p>コクウが手相を読み解いています...</p>
        {elapsed >= 15 && (
          <p className="palm-qr-hint">
            ただいま占いの精霊が混み合っていて、少し時間がかかっています（{elapsed}秒経過）。
            最大で1分半ほどかかることがあります。そのままお待ちください。
          </p>
        )}
      </div>
    );
  }

  // 診断に失敗した（時間切れ・通信エラーなど）ときは、QRの画面ではなく、理由と「戻る」を出す
  if (error && !canvasRef.current) {
    return (
      <div className="palm-qr-handoff">
        <div className="error">{error}</div>
        <button type="button" className="secondary-button" onClick={onCancel}>
          戻る
        </button>
      </div>
    );
  }

  return (
    <div className="palm-qr-handoff">
      <h2>スマホでQRコードを読み取ってください</h2>
      <canvas ref={canvasRef} />
      <p className="palm-qr-hint">スマホのカメラで手相を撮影すると、自動でこの画面に診断結果が表示されます</p>
      {notice && <div className="error">{notice}</div>}
      {error && <div className="error">{error}</div>}
      <button type="button" className="secondary-button" onClick={onCancel}>
        戻る
      </button>
    </div>
  );
}

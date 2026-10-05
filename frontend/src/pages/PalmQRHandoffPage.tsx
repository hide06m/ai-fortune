/**
 * 手相診断のPC側画面：QRコードを表示し、スマホでの撮影完了をポーリングで待つ（コクウ専用）
 */

import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { createPalmSession, getPalmSessionStatus, submitPalmistry, type PalmistryResponse } from '../api/palmistry';

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
      if (canvasRef.current) {
        try {
          await QRCode.toCanvas(canvasRef.current, url, { width: 240 });
        } catch (err) {
          console.error('Failed to render QR code:', err);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!token) return;

    const interval = setInterval(async () => {
      try {
        const result = await getPalmSessionStatus(token);
        if (result.status === 'uploaded') {
          clearInterval(interval);
          setDiagnosing(true);
          const response = await submitPalmistry({ token, concern: '' });
          if (response.success) {
            onComplete(response);
          } else {
            setError(response.error || '診断に失敗しました。');
            setDiagnosing(false);
          }
        }
      } catch (err) {
        console.error('Failed to poll palm session status:', err);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [token, onComplete]);

  if (diagnosing) {
    return (
      <div className="palm-qr-handoff">
        <p>コクウが手相を読み解いています...</p>
      </div>
    );
  }

  return (
    <div className="palm-qr-handoff">
      <h2>スマホでQRコードを読み取ってください</h2>
      <canvas ref={canvasRef} />
      <p className="palm-qr-hint">スマホのカメラで手相を撮影すると、自動でこの画面に診断結果が表示されます</p>
      {error && <div className="error">{error}</div>}
      <button type="button" className="secondary-button" onClick={onCancel}>
        戻る
      </button>
    </div>
  );
}

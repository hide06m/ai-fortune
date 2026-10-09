/**
 * 手相撮影画面（PCからQRコードで飛んできたスマホ側。スタンドアロンで表示される）
 */

import React, { useEffect, useState } from 'react';
import { PalmCameraCapture } from '../components/PalmCameraCapture';
import { uploadPalmImage, getPalmSessionStatusWithRetake, type PalmExtras } from '../api/palmistry';

interface PalmRelayCapturePageProps {
  token: string;
}

export function PalmRelayCapturePage({ token }: PalmRelayCapturePageProps) {
  const [status, setStatus] = useState<'capturing' | 'uploading' | 'done' | 'error'>('capturing');
  const [error, setError] = useState('');
  // 撮り直すときにカメラ部分を作り直すための番号
  const [attempt, setAttempt] = useState(0);
  const [retakeMessage, setRetakeMessage] = useState('');

  const handleCapture = async (imageBase64: string, mimeType: string, extras?: PalmExtras) => {
    setStatus('uploading');
    setError('');
    try {
      const response = await uploadPalmImage(token, imageBase64, mimeType, extras);
      if (response.success) {
        setStatus('done');
      } else {
        setError(response.error || 'アップロードに失敗しました。');
        setStatus('error');
      }
    } catch (err) {
      console.error('Failed to upload palm image:', err);
      setError('アップロードに失敗しました。通信環境をご確認ください。');
      setStatus('error');
    }
  };

  // 送信後は、PC側の解析で撮り直しになっていないかを見守る（なっていたらカメラの画面へ戻す）
  useEffect(() => {
    if (status !== 'done') return;
    const timer = setInterval(async () => {
      try {
        const r = await getPalmSessionStatusWithRetake(token);
        if (r.success && r.status === 'pending' && r.retakeMessage) {
          setRetakeMessage(r.retakeMessage);
          setStatus('capturing');
          setAttempt((n) => n + 1);
        }
      } catch {
        // 通信の一時的な失敗は無視（次の間隔で再試行）
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [status, token]);

  if (status === 'done') {
    return (
      <div className="palm-relay-container">
        <h1>撮影完了！</h1>
        <p>PCの画面に戻って診断結果をご確認ください。</p>
      </div>
    );
  }

  return (
    <div className="palm-relay-container">
      <h1>手相を撮影してください</h1>
      <PalmCameraCapture key={attempt} onCapture={handleCapture} analyzeOnDevice={false} initialMessage={retakeMessage} />
      {status === 'uploading' && <p>PCへ送信中です。そのままお待ちください...</p>}
      {error && (
        <>
          <div className="error">{error}</div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setError('');
              setStatus('capturing');
              setAttempt((n) => n + 1);
            }}
          >
            撮り直す
          </button>
        </>
      )}
    </div>
  );
}

/**
 * 手相撮影画面（PCからQRコードで飛んできたスマホ側。スタンドアロンで表示される）
 */

import React, { useState } from 'react';
import { PalmCameraCapture } from '../components/PalmCameraCapture';
import { uploadPalmImage, type PalmExtras } from '../api/palmistry';

interface PalmRelayCapturePageProps {
  token: string;
}

export function PalmRelayCapturePage({ token }: PalmRelayCapturePageProps) {
  const [status, setStatus] = useState<'capturing' | 'uploading' | 'done' | 'error'>('capturing');
  const [error, setError] = useState('');

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
      <PalmCameraCapture onCapture={handleCapture} />
      {status === 'uploading' && <p>アップロード中...</p>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}

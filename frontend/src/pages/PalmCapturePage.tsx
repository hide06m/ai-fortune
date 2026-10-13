/**
 * 手相撮影画面（スマホ本体からの直接診断フロー。コクウ専用）
 */

import React, { useState } from 'react';
import { PalmCameraCapture } from '../components/PalmCameraCapture';
import { HamsterLoading } from '../components/HamsterLoading';
import { submitPalmistry, type PalmistryResponse, type PalmExtras } from '../api/palmistry';

interface PalmCapturePageProps {
  onComplete: (response: PalmistryResponse) => void;
  onCancel: () => void;
}

export function PalmCapturePage({ onComplete, onCancel }: PalmCapturePageProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleCapture = async (imageBase64: string, mimeType: string, extras?: PalmExtras) => {
    setSubmitting(true);
    setError('');
    try {
      const response = await submitPalmistry({ imageBase64, mimeType, concern: '', ...extras });
      if (response.success) {
        onComplete(response);
      } else if (response.error === 'INSUFFICIENT_STONES') {
        setError('ルーンストーンが足りません。');
      } else {
        setError(response.error || '診断に失敗しました。');
      }
    } catch (err) {
      console.error('Failed to submit palmistry:', err);
      setError('診断に失敗しました。通信環境をご確認ください。');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitting) {
    return <HamsterLoading message="コクウが手相を読み解いています..." showEstimate={false} hint="最大で1分半ほどかかることがあります" />;
  }

  return (
    <div className="palm-capture-page">
      <PalmCameraCapture onCapture={handleCapture} />
      {error && <div className="error">{error}</div>}
      <button type="button" className="secondary-button" onClick={onCancel}>
        戻る
      </button>
    </div>
  );
}

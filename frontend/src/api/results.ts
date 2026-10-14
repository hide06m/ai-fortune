/**
 * 各診断の最新の結果を見返す API クライアント（ルーンストーン不要）
 */

import { getToken, API_URL } from '../api';

export interface LatestResultSummary {
  kind: string;
  savedAt: string;
}

function headers() {
  const token = getToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export async function listLatestResults(): Promise<LatestResultSummary[]> {
  try {
    const response = await fetch(`${API_URL}/api/results/latest`, { headers: headers() });
    if (!response.ok) return [];
    const data = await response.json();
    return data.success ? data.results : [];
  } catch {
    return [];
  }
}

export async function getLatestResult(kind: string): Promise<{ success: boolean; reading?: any; savedAt?: string; message?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/results/latest/${encodeURIComponent(kind)}`, { headers: headers() });
    const data = await response.json();
    if (!response.ok) return { success: false, message: data.message || '結果を読み込めませんでした' };
    return data;
  } catch {
    return { success: false, message: '通信に失敗しました。通信環境をご確認ください。' };
  }
}

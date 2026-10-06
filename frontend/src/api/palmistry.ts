/**
 * 手相診断 API クライアント（コクウ専用）
 */

import { getToken, API_URL } from '../api';

export interface PalmIntimacyResult {
  characterId: number;
  intimacyLevel: number;
  justUnlocked: number | null;
}

export interface PalmLine {
  id: 'heart' | 'head' | 'life' | 'fate';
  label: string;
  /** 画像左上を(0,0)、右下を(1000,1000)とする座標。見つからなかった線は空 */
  points: Array<{ x: number; y: number }>;
  reading: string;
  /** 測定値を言葉にした根拠（候補選択方式のときのみ） */
  evidence?: string[];
}

/** 撮影時に画像処理で取り出した、しわの候補と、番号付きで重ねた画像 */
export interface PalmExtras {
  candidates?: unknown[];
  annotatedBase64?: string;
}

export interface PalmistryResponse {
  success: boolean;
  analysis?: string;
  lines?: PalmLine[];
  image?: { base64: string; mimeType: string } | null;
  intimacy?: PalmIntimacyResult | null;
  stoneBalance?: number | null;
  error?: string;
  message?: string;
}

function authHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** PC側：QR連携用のペアリングセッションを作成 */
export async function createPalmSession(): Promise<{ success: boolean; token?: string; expiresAt?: number; error?: string }> {
  const response = await fetch(`${API_URL}/api/palm-session`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return response.json();
}

/** PC側：スマホの撮影完了をポーリングで確認 */
export async function getPalmSessionStatus(token: string): Promise<{ success: boolean; status?: string; error?: string }> {
  const response = await fetch(`${API_URL}/api/palm-session/${token}`, {
    method: 'GET',
    headers: authHeaders(),
  });
  return response.json();
}

/** スマホ側：撮影した画像をアップロード */
export async function uploadPalmImage(
  token: string,
  imageBase64: string,
  mimeType: string,
  extras?: PalmExtras,
): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(`${API_URL}/api/palm-session/${token}/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ imageBase64, mimeType, ...extras }),
  });
  return response.json();
}

/** 手相診断を実行する（token指定＝PC側フロー／imageBase64直接指定＝スマホ直接フロー） */
export async function submitPalmistry(params: {
  token?: string;
  imageBase64?: string;
  mimeType?: string;
  concern?: string;
  candidates?: unknown[];
  annotatedBase64?: string;
}): Promise<PalmistryResponse> {
  const response = await fetch(`${API_URL}/api/fortune/palmistry`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok) {
    return { success: false, error: data.error || `API error: ${response.status}`, message: data.message };
  }
  return data;
}

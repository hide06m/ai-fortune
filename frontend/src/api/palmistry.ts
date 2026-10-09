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
  id: 'heart' | 'head' | 'life' | 'fate' | 'simian' | 'marriage' | 'sun' | 'health';
  label: string;
  /** 画像左上を(0,0)、右下を(1000,1000)とする座標（検出できた線の形そのもの） */
  points: Array<{ x: number; y: number }>;
  reading: string;
  /** 測定値を言葉にした根拠 */
  evidence?: string[];
}

/** 撮影時に画像処理で取り出した、しわの候補と、番号付きで重ねた画像 */
export interface PalmExtras {
  /** 撮影時に検出できた線（確実に検出できた線だけ） */
  lines?: unknown[];
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

/** PC側：スマホの撮影完了をポーリングで確認（撮り直しの依頼が出ていれば retakeMessage が入る） */
export async function getPalmSessionStatusWithRetake(token: string): Promise<{ success: boolean; status?: string; retakeMessage?: string | null }> {
  const response = await fetch(`${API_URL}/api/palm-session/${token}`, { method: 'GET', headers: authHeaders() });
  return response.json();
}

/** PC側：アップロードされた画像を取得する（解析用。消費しない） */
export async function fetchPalmSessionImage(token: string): Promise<{ success: boolean; imageBase64?: string; mimeType?: string }> {
  const response = await fetch(`${API_URL}/api/palm-session/${token}/image`, { method: 'GET', headers: authHeaders() });
  return response.json();
}

/** PC側：解析の結果、撮り直しが必要だとスマホへ伝える */
export async function requestPalmRetake(token: string, message: string): Promise<void> {
  await fetch(`${API_URL}/api/palm-session/${token}/retake`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ message }),
  });
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
/** サーバー側の診断全体の上限（約100秒）より少し長く待つ。これを超えて応答がなければ、固まったとみなして中断する */
const SUBMIT_TIMEOUT_MS = 130_000;

export async function submitPalmistry(params: {
  token?: string;
  imageBase64?: string;
  mimeType?: string;
  concern?: string;
  lines?: unknown[];
}): Promise<PalmistryResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/fortune/palmistry`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(params),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { success: false, error: 'TIMEOUT', message: '診断に時間がかかりすぎました。しばらくしてから、もう一度お試しください。' };
    }
    return { success: false, error: 'NETWORK', message: '通信に失敗しました。通信環境を確認して、もう一度お試しください。' };
  } finally {
    clearTimeout(timer);
  }
  const data = await response.json();
  if (!response.ok) {
    return { success: false, error: data.error || `API error: ${response.status}`, message: data.message };
  }
  return data;
}

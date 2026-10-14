/**
 * ラブタイプ診断64 API クライアント（クリ専用）
 */

import { getToken, API_URL } from '../api';
import type { LoveType64Result } from '../api';

export interface LoveAnswer {
  id: number;
  val: number;
}

export interface LoveType64IntimacyResult {
  characterId: number;
  intimacyLevel: number;
  justUnlocked: number | null;
}

export interface LoveType64Response {
  success: boolean;
  result?: LoveType64Result;
  analysis?: string;
  cached?: boolean;
  intimacy?: LoveType64IntimacyResult | null;
  stoneBalance?: number | null;
  error?: string;
  message?: string;
}

export async function submitLoveType64Quiz(answers: LoveAnswer[], concern: string, typeOnly = false): Promise<LoveType64Response> {
  const token = getToken();
  const response = await fetch(`${API_URL}/api/fortune/love-type64`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ answers, concern, ...(typeOnly ? { typeOnly: true } : {}) }),
  });

  const data = await response.json();
  if (!response.ok) {
    return { success: false, error: data.error || `API error: ${response.status}`, message: data.message };
  }
  return data;
}

/** 既に外部サイトなどで診断済みのタイプを直接入力して結果を得る（例: "LCPO-VI"） */
export async function submitLoveType64DirectType(fullType: string, concern: string, typeOnly = false): Promise<LoveType64Response> {
  const token = getToken();
  const response = await fetch(`${API_URL}/api/fortune/love-type64`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ directType: fullType, concern, ...(typeOnly ? { typeOnly: true } : {}) }),
  });

  const data = await response.json();
  if (!response.ok) {
    return { success: false, error: data.error || `API error: ${response.status}`, message: data.message };
  }
  return data;
}

/** 前回の診断結果のまま、悩みだけ入力し直して再診断する */
export async function submitLoveType64QuizReuseLatest(concern: string): Promise<LoveType64Response> {
  const token = getToken();
  const response = await fetch(`${API_URL}/api/fortune/love-type64`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ reuseLatest: true, concern }),
  });

  const data = await response.json();
  if (!response.ok) {
    return { success: false, error: data.error || `API error: ${response.status}`, message: data.message };
  }
  return data;
}

/** 直近のラブタイプ診断結果があるか確認する（無ければnull） */
export async function getLatestLoveType64Result(): Promise<{ success: boolean; result: LoveType64Result | null; error?: string }> {
  const token = getToken();
  if (!token) {
    return { success: true, result: null };
  }
  const response = await fetch(`${API_URL}/api/fortune/love-type64/latest`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    return { success: false, result: null, error: data.error || `API error: ${response.status}` };
  }
  return data;
}

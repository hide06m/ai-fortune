/**
 * 性格タイプ診断（16タイプ）API クライアント（クリ専用）
 */

import { getToken, API_URL } from '../api';
import type { MBTIQuizResult } from '../api';

export interface MBTIAnswer {
  id: number;
  val: number;
}

export interface MBTIIntimacyResult {
  characterId: number;
  intimacyLevel: number;
  justUnlocked: number | null;
}

export interface MBTIResponse {
  success: boolean;
  result?: MBTIQuizResult;
  analysis?: string;
  cached?: boolean;
  intimacy?: MBTIIntimacyResult | null;
  stoneBalance?: number | null;
  error?: string;
  message?: string;
}

export async function submitMBTIQuiz(answers: MBTIAnswer[], concern: string, typeOnly = false): Promise<MBTIResponse> {
  const token = getToken();
  const response = await fetch(`${API_URL}/api/fortune/mbti`, {
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

/** 既に外部サイトなどで診断済みのタイプを直接入力して結果を得る（例: "ENTJ-T"） */
export async function submitMBTIDirectType(personalityType: string, concern: string, typeOnly = false): Promise<MBTIResponse> {
  const token = getToken();
  const response = await fetch(`${API_URL}/api/fortune/mbti`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ directType: personalityType, concern, ...(typeOnly ? { typeOnly: true } : {}) }),
  });

  const data = await response.json();
  if (!response.ok) {
    return { success: false, error: data.error || `API error: ${response.status}`, message: data.message };
  }
  return data;
}

/** 前回の診断結果のまま、悩みだけ入力し直して再診断する */
export async function submitMBTIQuizReuseLatest(concern: string): Promise<MBTIResponse> {
  const token = getToken();
  const response = await fetch(`${API_URL}/api/fortune/mbti`, {
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

/** 直近の性格タイプ診断結果があるか確認する（無ければnull） */
export async function getLatestMBTIResult(): Promise<{ success: boolean; result: MBTIQuizResult | null; error?: string }> {
  const token = getToken();
  if (!token) {
    return { success: true, result: null };
  }
  const response = await fetch(`${API_URL}/api/fortune/mbti/latest`, {
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

/**
 * 姓名判断 API クライアント（コクウ）
 */

import { getToken, API_URL } from '../api';

export type SeimeiLevel = '大吉' | '吉' | '半吉' | '凶';
export type SeimeiElement = '木' | '火' | '土' | '金' | '水';

export interface SeimeiChar {
  char: string;
  strokes: number;
}

export interface SeimeiKaku {
  key: 'ten' | 'jin' | 'chi' | 'gai' | 'so';
  label: string;
  meaning: string;
  strokes: number;
  element: SeimeiElement;
  level: SeimeiLevel;
  keyword: string;
  text: string;
}

export interface SeimeiResult {
  surname: SeimeiChar[];
  givenName: SeimeiChar[];
  kaku: SeimeiKaku[];
  sansai: {
    elements: [SeimeiElement, SeimeiElement, SeimeiElement];
    tenJin: '相生' | '比和' | '相剋';
    jinChi: '相生' | '比和' | '相剋';
    /** 三才配置の総合判定 */
    overall?: '吉' | '凶' | '吉凶混合';
  };
}

export interface SeimeiResponse {
  success: boolean;
  result?: SeimeiResult;
  analysis?: string;
  intimacy?: { characterId: number; intimacyLevel: number; justUnlocked: number | null } | null;
  stoneBalance?: number | null;
  error?: string;
  message?: string;
}

export async function submitSeimei(surname: string, givenName: string, concern: string): Promise<SeimeiResponse> {
  const token = getToken();
  const response = await fetch(`${API_URL}/api/fortune/seimei`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ surname, givenName, concern }),
  });
  const data = await response.json();
  if (!response.ok) {
    return { success: false, error: data.error || `API error: ${response.status}`, message: data.message };
  }
  return data;
}

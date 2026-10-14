/**
 * 宿曜占星術 API クライアント（ツキ）
 */

import { getToken, API_URL } from '../api';

export interface SukuyouShuku {
  name: string;
  reading: string;
  youbi: string;
  keywords: string[];
  text: string;
}

export interface SukuyouResult {
  birthDate: string;
  kyureki: { year: number; month: number; day: number; isLeap: boolean };
  mei: SukuyouShuku;
  gyo: SukuyouShuku;
  tai: SukuyouShuku;
  index: number;
}

export interface SukuyouResponse {
  success: boolean;
  result?: SukuyouResult;
  analysis?: string;
  intimacy?: { characterId: number; intimacyLevel: number; justUnlocked: number | null } | null;
  stoneBalance?: number | null;
  error?: string;
  message?: string;
}

export async function submitSukuyou(birthDate: string, concern: string): Promise<SukuyouResponse> {
  const token = getToken();
  const response = await fetch(`${API_URL}/api/fortune/sukuyou`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ birthDate, concern }),
  });
  const data = await response.json();
  if (!response.ok) {
    return { success: false, error: data.error || `API error: ${response.status}`, message: data.message };
  }
  return data;
}

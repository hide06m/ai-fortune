/**
 * 診断履歴 API クライアント
 */

import { getToken, API_URL } from '../api';
import type { BaZiChart, NumerologyResult, WesternZodiac, MBTIQuizResult, LoveType64Result } from '../api';

export interface ReadingSummary {
  id: string;
  concern: string;
  characterId: number | null;
  createdAt: string;
}

export interface ReadingDetail extends ReadingSummary {
  birthDate: string | null;
  birthTime: string | null;
  birthPlace: string | null;
  baZi: BaZiChart | null;
  numerology: NumerologyResult | null;
  kyuseiSeisun: string | null;
  westernZodiac?: WesternZodiac | null;
  mbtiResult?: MBTIQuizResult | null;
  loveTypeResult?: LoveType64Result | null;
  analysis: string;
}

function authHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function getReadingHistory(): Promise<{ success: boolean; readings: ReadingSummary[] }> {
  const response = await fetch(`${API_URL}/api/readings`, {
    method: 'GET',
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

export async function getReadingDetail(id: string): Promise<{ success: boolean; reading: ReadingDetail }> {
  const response = await fetch(`${API_URL}/api/readings/${id}`, {
    method: 'GET',
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

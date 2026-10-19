/**
 * 石（診断に使う仮想通貨）関連 API クライアント
 */

import { getToken, API_URL } from '../api';

export interface StoneBalanceResponse {
  success: boolean;
  balance: number;
  /** 今日あと何回、広告視聴ボーナスを受け取れるか */
  adRemaining?: number;
}

export interface StoneClaimResponse {
  success: boolean;
  granted: boolean;
  balance: number;
  reason?: string;
  adRemaining?: number;
}

function authHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function getStoneBalance(): Promise<StoneBalanceResponse> {
  const response = await fetch(`${API_URL}/api/stones/balance`, {
    method: 'GET',
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

export async function claimDailyBonus(): Promise<StoneClaimResponse> {
  const response = await fetch(`${API_URL}/api/stones/claim-daily-bonus`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

export async function watchAdForStone(): Promise<StoneClaimResponse> {
  const response = await fetch(`${API_URL}/api/stones/watch-ad`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

export interface StoneSummary {
  success: boolean;
  balance: number;
  loginBonusClaimed: boolean;
  adRemaining: number;
  adLimit: number;
  /** 今日ミニゲームでもらった石 */
  minigameStonesToday: number;
  history: { amount: number; reason: string; createdAt: string }[];
}

export async function getStoneSummary(): Promise<StoneSummary> {
  const response = await fetch(`${API_URL}/api/stones/summary`, { method: 'GET', headers: authHeaders() });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

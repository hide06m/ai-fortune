/**
 * 石（診断に使う仮想通貨）関連 API クライアント
 */

import { getToken, API_URL } from '../api';

export interface StoneBalanceResponse {
  success: boolean;
  balance: number;
}

export interface StoneClaimResponse {
  success: boolean;
  granted: boolean;
  balance: number;
  reason?: string;
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

/**
 * 今日の運勢・デイリーミッション API クライアント
 */

import { getToken, API_URL } from '../api';

export interface DailyFortune {
  day: string;
  personalDay: number;
  title: string;
  message: string;
  advice: string;
  luckyColor: { name: string; hex: string };
  luckyNumber: number;
  stars: { total: number; love: number; work: number; money: number };
}

export interface DailyMission {
  id: 'fortune' | 'diagnose' | 'gift';
  title: string;
  desc: string;
  reward: number;
  done: boolean;
  claimed: boolean;
}

export interface DailySnapshot {
  success: boolean;
  day: string;
  birthDate: string | null;
  fortune: DailyFortune | null;
  missions: DailyMission[];
  allBonus: { reward: number; ready: boolean; claimed: boolean };
  balance: number;
  error?: string;
  message?: string;
}

function headers() {
  const token = getToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function call(path: string, method: 'GET' | 'POST', body?: unknown): Promise<DailySnapshot> {
  try {
    const res = await fetch(`${API_URL}/api/daily${path}`, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
    return await res.json();
  } catch {
    return { success: false, error: 'NETWORK', message: '通信に失敗しました', day: '', birthDate: null, fortune: null, missions: [], allBonus: { reward: 0, ready: false, claimed: false }, balance: 0 };
  }
}

export const getDaily = () => call('', 'GET');
export const saveBirthDate = (birthDate: string) => call('/birthdate', 'POST', { birthDate });
export const markFortuneViewed = () => call('/fortune/view', 'POST');
export const claimMission = (id: string) => call(`/missions/${id}/claim`, 'POST');

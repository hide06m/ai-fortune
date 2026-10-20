/**
 * ホームの機能（交換所・出会いのガチャ・ウィークリーミッション）の API クライアント
 */

import { getToken, API_URL } from '../api';

function headers() {
  const token = getToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const r = await fetch(`${API_URL}${path}`, { method, headers: headers(), ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await r.json().catch(() => ({}));
  return data as T;
}

// ───── 交換所 ─────
export interface ShopItem {
  id: string;
  kind: 'title' | 'background';
  name: string;
  desc: string;
  price: number;
  image?: string;
  owned: boolean;
  equipped: boolean;
}
export interface ShopSnapshot {
  success: boolean;
  balance: number;
  equipped: { title: string; background: string };
  items: ShopItem[];
  error?: string;
  message?: string;
}
export const getShop = () => call<ShopSnapshot>('/api/shop');
export const buyItem = (itemId: string) => call<ShopSnapshot>('/api/shop/buy', 'POST', { itemId });
export const equipItem = (itemId: string) => call<ShopSnapshot>('/api/shop/equip', 'POST', { itemId });

export interface HomeProfile {
  success: boolean;
  title: { id: string; name: string } | null;
  background: { id: string; image?: string } | null;
}
export const getHomeProfile = () => call<HomeProfile>('/api/shop/profile');

// ───── 出会いのガチャ ─────
export interface GachaInfo {
  success: boolean;
  cost: number;
  refund: number;
  total: number;
  collected: number;
  complete: boolean;
  balance: number;
}
export interface GachaResult {
  success: boolean;
  kind?: 'mbti' | 'love' | 'sukuyou';
  code?: string;
  isNew?: boolean;
  refunded?: number;
  balance?: number;
  collected?: number;
  total?: number;
  error?: string;
  message?: string;
}
export const getGachaInfo = () => call<GachaInfo>('/api/gacha');
export const pullGacha = () => call<GachaResult>('/api/gacha/pull', 'POST');

// ───── ウィークリーミッション ─────
export interface WeeklyMission {
  id: string;
  title: string;
  desc: string;
  target: number;
  reward: number;
  progress: number;
  done: boolean;
  claimed: boolean;
}
export interface WeeklySnapshot {
  success: boolean;
  weekStart: string;
  missions: WeeklyMission[];
  balance: number;
  message?: string;
}
export const getWeekly = () => call<WeeklySnapshot>('/api/weekly');
export const claimWeekly = (id: string) => call<WeeklySnapshot>(`/api/weekly/${id}/claim`, 'POST');

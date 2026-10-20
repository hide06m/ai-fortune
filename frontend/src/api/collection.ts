/**
 * 図鑑・実績 API クライアント
 */

import { getToken, API_URL } from '../api';

export interface CollectionItem {
  code: string;
  name?: string;
  reading?: string;
  collected: boolean;
  count: number;
}

export interface CollectionData {
  success: boolean;
  /** 森での出会い（ガチャ）が、解放されているか */
  gachaEnabled?: boolean;
  mbti: CollectionItem[];
  love: CollectionItem[];
  sukuyou: CollectionItem[];
}

export interface AchievementItem {
  id: string;
  title: string;
  desc: string;
  progress: number;
  target: number;
  done: boolean;
}

function headers() {
  const token = getToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export async function getCollection(): Promise<CollectionData | null> {
  try {
    const res = await fetch(`${API_URL}/api/collection`, { headers: headers() });
    const data = await res.json();
    return data.success ? data : null;
  } catch {
    return null;
  }
}

export async function getAchievements(): Promise<AchievementItem[] | null> {
  try {
    const res = await fetch(`${API_URL}/api/achievements`, { headers: headers() });
    const data = await res.json();
    return data.success ? data.achievements : null;
  } catch {
    return null;
  }
}

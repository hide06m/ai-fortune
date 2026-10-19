/**
 * ミニゲームの報酬 API クライアント（診断を待っている間に、クリアしたら、ルーンストーンがもらえる）
 */

import { getToken, API_URL } from '../api';

export interface RewardResult {
  success: boolean;
  /** もらえた石の数（0なら、もらえなかった） */
  granted: number;
  balance?: number;
  /** 今日、あと、もらえる石 */
  remaining?: number;
  limit?: number;
  /** もらえなかった理由：daily_limit＝今日の上限／already＝この診断では、もらった／その他は、表示しない */
  reason?: string;
}

export async function claimMinigameReward(jobId: string, difficulty: string): Promise<RewardResult | null> {
  try {
    const token = getToken();
    const res = await fetch(`${API_URL}/api/minigame/reward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ jobId, game: 'forest_run', difficulty }),
    });
    const data = await res.json();
    return data.success ? data : null;
  } catch {
    return null;
  }
}

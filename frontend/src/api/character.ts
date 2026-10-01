/**
 * キャラクター関連 API クライアント
 */

import { getToken, API_URL } from '../api';

export interface GuideGreetingResponse {
  success: boolean;
  tier?: 'first' | 'regular' | 'veteran';
  intimacyLevel?: number | null;
  dialogue?: string;
  expression?: 1 | 2 | 3 | 4;
  noSplit?: boolean;
  error?: string;
}

/**
 * 案内役（ムスビ）のドア挨拶を取得（ログイン済みなら来館回数が進む）
 */
export async function greetGuide(): Promise<GuideGreetingResponse> {
  const token = getToken();
  const response = await fetch(`${API_URL}/api/character/greet`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    return { success: false, error: `API error: ${response.status}` };
  }

  return response.json();
}

/**
 * 全キャラクター情報を取得
 */
export async function getCharacterList() {
  try {
    const response = await fetch(`${API_URL}/api/character/list`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch character list:', error);
    throw error;
  }
}

/**
 * ユーザーの全キャラクター親密度を取得
 */
export async function getUnlockedCharacters() {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/api/character/intimacy`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch unlocked characters:', error);
    throw error;
  }
}

/**
 * 特定キャラクターの親密度情報を取得
 */
export async function getCharacterIntimacy(characterId: number) {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/api/character/${characterId}/intimacy`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch character ${characterId} intimacy:`, error);
    throw error;
  }
}

/**
 * キャラクターを解放
 */
export async function unlockCharacter(characterId: number) {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/api/character/${characterId}/unlock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Failed to unlock character ${characterId}:`, error);
    throw error;
  }
}

/**
 * 「ちょっとした挨拶（ミニ贈り物）」：石1個で少量の親密度を上げる
 * （診断コストが高いキャラ＝GIFT_ELIGIBLE_CHARACTERSのみ対象）
 */
export async function sendCharacterGift(characterId: number) {
  const token = getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_URL}/api/character/${characterId}/gift`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    return { success: false, error: data.error || `API error: ${response.status}`, message: data.message };
  }
  return data;
}

/**
 * 解放済みだが初対面イベント未再生のキャラを1件取得（無ければ characterId: null）
 */
export async function getNextUnmetCharacter(): Promise<{ success: boolean; characterId: number | null; error?: string }> {
  try {
    const token = getToken();
    if (!token) {
      return { success: true, characterId: null };
    }

    const response = await fetch(`${API_URL}/api/character/next-unmet`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch next unmet character:', error);
    throw error;
  }
}

/**
 * 初対面イベントを再生済みとして記録する
 */
export async function markCharacterMet(characterId: number) {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/api/character/${characterId}/met`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Failed to mark character ${characterId} met:`, error);
    throw error;
  }
}

/**
 * 診断キャラの再訪問時の一言挨拶を取得（初対面イベントとは別物）
 */
export async function getCharacterGreeting(characterId: number): Promise<{ success: boolean; text?: string; tier?: 'regular' | 'veteran'; error?: string }> {
  const token = getToken();
  if (!token) {
    return { success: false, error: 'Not authenticated' };
  }

  const response = await fetch(`${API_URL}/api/character/${characterId}/greeting`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    return { success: false, error: data.error || `API error: ${response.status}` };
  }
  return data;
}

/**
 * 親密度解放情報を取得
 */
export async function getUnlockInfo() {
  try {
    const response = await fetch(`${API_URL}/api/character/unlocks/info`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch unlock info:', error);
    throw error;
  }
}

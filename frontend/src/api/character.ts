/**
 * キャラクター関連 API クライアント
 */

import { getToken, API_URL } from '../api';

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

/**
 * キャラクター・親密度関連のデータベース操作
 */

import { query } from './client.js';
import { CharacterId, CharacterIntimacy } from '../types/character.js';

/**
 * DBの行（snake_case）を CharacterIntimacy（camelCase）へ変換
 * pg はカラム名をそのまま返す（自動でキャメルケース化しない）ため、
 * SELECT結果をそのまま `as CharacterIntimacy` でキャストすると
 * intimacyLevel 等が実行時には undefined になる。必ずこの関数を経由すること。
 */
function mapIntimacyRow(row: any): CharacterIntimacy {
  return {
    id: row.id,
    userId: row.user_id,
    characterId: row.character_id,
    intimacyLevel: row.intimacy_level,
    totalDiagnoses: row.total_diagnoses,
    lastDiagnosisDate: row.last_diagnosis_date,
    unlockedAt: row.unlocked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * ユーザーの特定キャラクターの親密度情報を取得
 */
export async function getUserCharacterIntimacy(
  userId: string,
  characterId: CharacterId
): Promise<CharacterIntimacy | null> {
  try {
    const result = await query(
      `SELECT id, user_id, character_id, intimacy_level, total_diagnoses,
              last_diagnosis_date, unlocked_at, created_at, updated_at
       FROM character_intimacy
       WHERE user_id = $1 AND character_id = $2`,
      [userId, characterId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapIntimacyRow(result.rows[0]);
  } catch (error) {
    console.error('[DB] Failed to get character intimacy:', error);
    throw error;
  }
}

/**
 * ユーザーの全キャラクター親密度を取得
 */
export async function getUserAllIntimacies(userId: string): Promise<CharacterIntimacy[]> {
  try {
    const result = await query(
      `SELECT id, user_id, character_id, intimacy_level, total_diagnoses,
              last_diagnosis_date, unlocked_at, created_at, updated_at
       FROM character_intimacy
       WHERE user_id = $1
       ORDER BY character_id ASC`,
      [userId]
    );

    return result.rows.map(mapIntimacyRow);
  } catch (error) {
    console.error('[DB] Failed to get all intimacies:', error);
    throw error;
  }
}

/**
 * 親密度を作成（初回診断時）
 */
export async function createCharacterIntimacy(
  userId: string,
  characterId: CharacterId
): Promise<CharacterIntimacy> {
  try {
    const result = await query(
      `INSERT INTO character_intimacy (user_id, character_id, intimacy_level, total_diagnoses, last_diagnosis_date)
       VALUES ($1, $2, 0, 1, NOW())
       ON CONFLICT (user_id, character_id)
       DO UPDATE SET
         total_diagnoses = total_diagnoses + 1,
         last_diagnosis_date = NOW()
       RETURNING id, user_id, character_id, intimacy_level, total_diagnoses,
                 last_diagnosis_date, unlocked_at, created_at, updated_at`,
      [userId, characterId]
    );

    return mapIntimacyRow(result.rows[0]);
  } catch (error) {
    console.error('[DB] Failed to create character intimacy:', error);
    throw error;
  }
}

/**
 * 診断完了後に親密度をインクリメント
 */
export async function incrementCharacterIntimacy(
  userId: string,
  characterId: CharacterId
): Promise<CharacterIntimacy> {
  try {
    const result = await query(
      `UPDATE character_intimacy
       SET intimacy_level = CASE
             WHEN intimacy_level < 10 THEN intimacy_level + 1
             ELSE 10
           END,
           total_diagnoses = total_diagnoses + 1,
           last_diagnosis_date = NOW()
       WHERE user_id = $1 AND character_id = $2
       RETURNING id, user_id, character_id, intimacy_level, total_diagnoses,
                 last_diagnosis_date, unlocked_at, created_at, updated_at`,
      [userId, characterId]
    );

    if (result.rows.length === 0) {
      // レコードがない場合は作成
      return createCharacterIntimacy(userId, characterId);
    }

    return mapIntimacyRow(result.rows[0]);
  } catch (error) {
    console.error('[DB] Failed to increment character intimacy:', error);
    throw error;
  }
}

/**
 * キャラクターを解放（親密度達成時）
 */
export async function unlockCharacter(
  userId: string,
  characterId: CharacterId
): Promise<CharacterIntimacy> {
  try {
    const result = await query(
      `UPDATE character_intimacy
       SET unlocked_at = NOW()
       WHERE user_id = $1 AND character_id = $2 AND unlocked_at IS NULL
       RETURNING id, user_id, character_id, intimacy_level, total_diagnoses,
                 last_diagnosis_date, unlocked_at, created_at, updated_at`,
      [userId, characterId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Failed to unlock character ${characterId} for user ${userId}`);
    }

    return mapIntimacyRow(result.rows[0]);
  } catch (error) {
    console.error('[DB] Failed to unlock character:', error);
    throw error;
  }
}

/**
 * ユーザーの解放済みキャラクター一覧を取得
 */
export async function getUnlockedCharacters(userId: string): Promise<CharacterId[]> {
  try {
    const result = await query(
      `SELECT character_id FROM character_intimacy
       WHERE user_id = $1 AND unlocked_at IS NOT NULL
       ORDER BY character_id ASC`,
      [userId]
    );

    return result.rows.map((row) => row.character_id as CharacterId);
  } catch (error) {
    console.error('[DB] Failed to get unlocked characters:', error);
    throw error;
  }
}

/**
 * 初期化：ユーザーの全キャラクターに対して親密度を初期化
 * （新規ユーザー作成時に呼ばれる）
 */
export async function initializeUserCharacterIntimacies(userId: string): Promise<void> {
  try {
    // ムスビ（0）は常に未解放、ナツメ（1）は初期解放
    const values: Array<[string, CharacterId]> = [
      [userId, 0], // ムスビ: 未解放
      [userId, 1], // ナツメ: 初期解放
      [userId, 2], // ツキ: 未解放
      [userId, 3], // コクウ: 未解放
      [userId, 4], // クリ: 未解放
    ];

    for (const [uId, charId] of values) {
      const isInitiallyUnlocked = charId === 1; // ナツメのみ初期解放
      const unlockedAt = isInitiallyUnlocked ? 'NOW()' : 'NULL';

      await query(
        `INSERT INTO character_intimacy (user_id, character_id, intimacy_level, total_diagnoses, unlocked_at)
         VALUES ($1, $2, 0, 0, ${unlockedAt})
         ON CONFLICT (user_id, character_id) DO NOTHING`,
        [uId, charId]
      );
    }

    console.log(`[DB] Initialized character intimacies for user ${userId}`);
  } catch (error) {
    console.error('[DB] Failed to initialize character intimacies:', error);
    throw error;
  }
}

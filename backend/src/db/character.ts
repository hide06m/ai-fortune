/**
 * キャラクター・親密度関連のデータベース操作
 */

import { query } from './client.js';
import { CharacterId, CharacterIntimacy, INTIMACY_POINTS_PER_LEVEL, MAX_INTIMACY_POINTS } from '../types/character.js';

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
    intimacyPoints: row.intimacy_points,
    totalDiagnoses: row.total_diagnoses,
    lastDiagnosisDate: row.last_diagnosis_date,
    unlockedAt: row.unlocked_at,
    metAt: row.met_at,
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
      `SELECT id, user_id, character_id, intimacy_level, intimacy_points, total_diagnoses,
              last_diagnosis_date, unlocked_at, met_at, created_at, updated_at
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
      `SELECT id, user_id, character_id, intimacy_level, intimacy_points, total_diagnoses,
              last_diagnosis_date, unlocked_at, met_at, created_at, updated_at
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
 * 親密度を作成（該当レコードがまだ無い状態で初めて加算しようとした時のフォールバック）
 *
 * @param points 初回付与するポイント数（診断なら100、ちょっとした挨拶なら20）
 * @param countsAsDiagnosis trueの場合のみ total_diagnoses / last_diagnosis_date を更新する
 */
export async function createCharacterIntimacy(
  userId: string,
  characterId: CharacterId,
  points: number = INTIMACY_POINTS_PER_LEVEL,
  countsAsDiagnosis: boolean = true
): Promise<CharacterIntimacy> {
  try {
    const clampedPoints = Math.min(points, MAX_INTIMACY_POINTS);
    const level = Math.floor(clampedPoints / INTIMACY_POINTS_PER_LEVEL);
    const diagnosisCount = countsAsDiagnosis ? 1 : 0;
    const result = await query(
      `INSERT INTO character_intimacy
         (user_id, character_id, intimacy_level, intimacy_points, total_diagnoses, last_diagnosis_date)
       VALUES ($1, $2, $3, $4, $5, CASE WHEN $6 THEN NOW() ELSE NULL END)
       ON CONFLICT (user_id, character_id)
       DO UPDATE SET
         intimacy_points = LEAST(character_intimacy.intimacy_points + $4, ${MAX_INTIMACY_POINTS}),
         intimacy_level = LEAST((character_intimacy.intimacy_points + $4) / ${INTIMACY_POINTS_PER_LEVEL}, 10),
         total_diagnoses = character_intimacy.total_diagnoses + $5,
         last_diagnosis_date = CASE WHEN $6 THEN NOW() ELSE character_intimacy.last_diagnosis_date END
       RETURNING id, user_id, character_id, intimacy_level, intimacy_points, total_diagnoses,
                 last_diagnosis_date, unlocked_at, met_at, created_at, updated_at`,
      [userId, characterId, level, clampedPoints, diagnosisCount, countsAsDiagnosis]
    );

    return mapIntimacyRow(result.rows[0]);
  } catch (error) {
    console.error('[DB] Failed to create character intimacy:', error);
    throw error;
  }
}

/**
 * 親密度ポイントを加算する（診断＝大きな一歩、ちょっとした挨拶＝小さな一歩）
 *
 * intimacy_points（0-1000）を実体として加算し、intimacy_level（0-10、ハート数）は
 * floor(intimacy_points / 100) として都度再計算する。
 *
 * @param points 加算するポイント数（DIAGNOSIS_INTIMACY_POINTS または GIFT_INTIMACY_POINTS を渡す）
 * @param countsAsDiagnosis trueの場合のみ total_diagnoses / last_diagnosis_date を更新する
 *                          （ちょっとした挨拶は「診断」としてカウントしない）
 */
export async function incrementCharacterIntimacy(
  userId: string,
  characterId: CharacterId,
  points: number = INTIMACY_POINTS_PER_LEVEL,
  countsAsDiagnosis: boolean = true
): Promise<CharacterIntimacy> {
  try {
    const diagnosisCount = countsAsDiagnosis ? 1 : 0;
    const result = await query(
      `UPDATE character_intimacy
       SET intimacy_points = LEAST(intimacy_points + $3, ${MAX_INTIMACY_POINTS}),
           intimacy_level = LEAST((intimacy_points + $3) / ${INTIMACY_POINTS_PER_LEVEL}, 10),
           total_diagnoses = total_diagnoses + $4,
           last_diagnosis_date = CASE WHEN $5 THEN NOW() ELSE last_diagnosis_date END
       WHERE user_id = $1 AND character_id = $2
       RETURNING id, user_id, character_id, intimacy_level, intimacy_points, total_diagnoses,
                 last_diagnosis_date, unlocked_at, met_at, created_at, updated_at`,
      [userId, characterId, points, diagnosisCount, countsAsDiagnosis]
    );

    if (result.rows.length === 0) {
      // レコードがない場合は作成
      return createCharacterIntimacy(userId, characterId, points, countsAsDiagnosis);
    }

    return mapIntimacyRow(result.rows[0]);
  } catch (error) {
    console.error('[DB] Failed to increment character intimacy:', error);
    throw error;
  }
}

/**
 * キャラクターを解放（親密度達成時）。
 * 既に解放済みの場合は何もせず現在の状態を返す（冪等）。
 * INTIMACY_UNLOCKS は「達成した親密度レベルの数値」だけで解放先キャラを決めるため、
 * 別キャラの親密度がその数値にたまたま達した時など、既に解放済みのキャラに対して
 * 呼ばれることが普通に起こりうる。これはエラーではない
 */
export async function unlockCharacter(
  userId: string,
  characterId: CharacterId
): Promise<{ intimacy: CharacterIntimacy; wasNewlyUnlocked: boolean }> {
  try {
    const result = await query(
      `UPDATE character_intimacy
       SET unlocked_at = NOW()
       WHERE user_id = $1 AND character_id = $2 AND unlocked_at IS NULL
       RETURNING id, user_id, character_id, intimacy_level, intimacy_points, total_diagnoses,
                 last_diagnosis_date, unlocked_at, met_at, created_at, updated_at`,
      [userId, characterId]
    );

    if (result.rows.length === 0) {
      const existing = await getUserCharacterIntimacy(userId, characterId);
      if (!existing) throw new Error(`Character intimacy not found for user ${userId}, character ${characterId}`);
      return { intimacy: existing, wasNewlyUnlocked: false };
    }

    return { intimacy: mapIntimacyRow(result.rows[0]), wasNewlyUnlocked: true };
  } catch (error) {
    console.error('[DB] Failed to unlock character:', error);
    throw error;
  }
}

/**
 * 「初対面イベント」を再生済みとして記録する（解放直後、次のアクセス時に一度だけ出会いイベントを出すため）
 */
export async function markCharacterMet(
  userId: string,
  characterId: CharacterId
): Promise<CharacterIntimacy> {
  try {
    const result = await query(
      `UPDATE character_intimacy
       SET met_at = NOW()
       WHERE user_id = $1 AND character_id = $2 AND met_at IS NULL
       RETURNING id, user_id, character_id, intimacy_level, intimacy_points, total_diagnoses,
                 last_diagnosis_date, unlocked_at, met_at, created_at, updated_at`,
      [userId, characterId]
    );

    if (result.rows.length === 0) {
      const existing = await getUserCharacterIntimacy(userId, characterId);
      if (!existing) throw new Error(`Character intimacy not found for user ${userId}, character ${characterId}`);
      return existing;
    }

    return mapIntimacyRow(result.rows[0]);
  } catch (error) {
    console.error('[DB] Failed to mark character met:', error);
    throw error;
  }
}

/**
 * 解放済みだが「初対面イベント」がまだの最若ID順のキャラクターを1件取得する（無ければnull）
 * ムスビ（0）・ナツメ（1）は初期化時点でmet_atを済にしてあるため対象外になる
 */
export async function getNextUnmetCharacter(userId: string): Promise<CharacterId | null> {
  try {
    const result = await query(
      `SELECT character_id FROM character_intimacy
       WHERE user_id = $1 AND unlocked_at IS NOT NULL AND met_at IS NULL
       ORDER BY character_id ASC LIMIT 1`,
      [userId]
    );
    return result.rows.length > 0 ? (result.rows[0].character_id as CharacterId) : null;
  } catch (error) {
    console.error('[DB] Failed to get next unmet character:', error);
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
      // ナツメはチュートリアル内でムスビが紹介する形で出会うため、初対面イベントの対象から外す
      const metAt = isInitiallyUnlocked ? 'NOW()' : 'NULL';

      await query(
        `INSERT INTO character_intimacy (user_id, character_id, intimacy_level, intimacy_points, total_diagnoses, unlocked_at, met_at)
         VALUES ($1, $2, 0, 0, 0, ${unlockedAt}, ${metAt})
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

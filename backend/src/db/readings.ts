/**
 * 診断結果（readings）関連のデータベース操作
 */

import { v4 as uuidv4 } from 'uuid'
import { query } from './client.js'
import type { BaZiChart, NumerologyResult, KyuseiSeisun } from '../fortune/types.js'

export interface SaveReadingParams {
  userId: string
  birthDate: string
  birthTime?: string
  birthPlace?: string
  concern: string
  baZi: BaZiChart
  numerology: NumerologyResult
  kyuseiSeisun: KyuseiSeisun
  analysis: string
  characterId?: number | null
}

export interface ReadingSummary {
  id: string
  concern: string
  characterId: number | null
  createdAt: string
}

export interface ReadingDetail extends ReadingSummary {
  birthDate: string
  birthTime: string | null
  birthPlace: string | null
  baZi: BaZiChart
  numerology: NumerologyResult
  kyuseiSeisun: KyuseiSeisun
  analysis: string
}

function mapReadingRow(row: any): ReadingDetail {
  return {
    id: row.id,
    concern: row.concern,
    characterId: row.character_id,
    createdAt: row.created_at,
    birthDate: row.birth_date,
    birthTime: row.birth_time,
    birthPlace: row.birth_place,
    baZi: row.bazi_result,
    numerology: row.numerology_result,
    kyuseiSeisun: row.kyusei_result,
    analysis: row.llm_analysis,
  }
}

/**
 * 診断結果を保存する（ログイン済みユーザーのみ呼ばれる想定）
 */
export async function saveReading(params: SaveReadingParams): Promise<string> {
  const id = uuidv4()
  await query(
    `INSERT INTO readings (
      id, user_id, birth_date, birth_time, birth_place, concern,
      bazi_result, numerology_result, kyusei_result, llm_analysis, character_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id,
      params.userId,
      params.birthDate,
      params.birthTime || null,
      params.birthPlace || null,
      params.concern,
      JSON.stringify(params.baZi),
      JSON.stringify(params.numerology),
      JSON.stringify(params.kyuseiSeisun),
      params.analysis,
      params.characterId ?? null,
    ]
  )
  return id
}

/**
 * ユーザーの診断履歴一覧を取得（新しい順）
 */
export async function getUserReadings(userId: string, limit = 30): Promise<ReadingSummary[]> {
  const result = await query(
    `SELECT id, concern, character_id, created_at FROM readings
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  )
  return result.rows.map((row: any) => ({
    id: row.id,
    concern: row.concern,
    characterId: row.character_id,
    createdAt: row.created_at,
  }))
}

/**
 * 診断履歴を1件取得（本人のものであることを確認）
 */
export async function getReadingById(userId: string, readingId: string): Promise<ReadingDetail | null> {
  const result = await query(
    `SELECT * FROM readings WHERE id = $1 AND user_id = $2`,
    [readingId, userId]
  )
  if (result.rows.length === 0) return null
  return mapReadingRow(result.rows[0])
}

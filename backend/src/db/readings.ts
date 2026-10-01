/**
 * 診断結果（readings）関連のデータベース操作
 */

import { v4 as uuidv4 } from 'uuid'
import { query } from './client.js'
import type { BaZiChart, NumerologyResult, KyuseiSeisun } from '../fortune/types.js'
import type { WesternZodiac } from '../fortune/westernAstrology.js'
import type { MBTIQuizResult } from '../fortune/mbti.js'
import type { LoveType64Result } from '../fortune/loveType64.js'

export interface SaveReadingParams {
  userId: string
  birthDate?: string | null
  birthTime?: string | null
  birthPlace?: string | null
  concern: string
  // 生年月日ベースの占術（ナツメ・ツキ等）でのみ使う。MBTI/ラブタイプ診断では省略する
  baZi?: BaZiChart | null
  numerology?: NumerologyResult | null
  kyuseiSeisun?: KyuseiSeisun | null
  westernZodiac?: WesternZodiac | null
  mbtiResult?: MBTIQuizResult | null
  loveTypeResult?: LoveType64Result | null
  analysis: string
  characterId?: number | null
  baziKey: string
}

export interface ReadingSummary {
  id: string
  concern: string
  characterId: number | null
  createdAt: string
}

export interface ReadingDetail extends ReadingSummary {
  birthDate: string | null
  birthTime: string | null
  birthPlace: string | null
  baZi: BaZiChart | null
  numerology: NumerologyResult | null
  kyuseiSeisun: KyuseiSeisun | null
  westernZodiac: WesternZodiac | null
  mbtiResult: MBTIQuizResult | null
  loveTypeResult: LoveType64Result | null
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
    westernZodiac: row.western_zodiac_result ?? null,
    mbtiResult: row.mbti_result ?? null,
    loveTypeResult: row.love_type_result ?? null,
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
      bazi_result, numerology_result, kyusei_result, western_zodiac_result, mbti_result, love_type_result,
      llm_analysis, character_id, bazi_key
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      id,
      params.userId,
      params.birthDate || null,
      params.birthTime || null,
      params.birthPlace || null,
      params.concern,
      params.baZi ? JSON.stringify(params.baZi) : null,
      params.numerology ? JSON.stringify(params.numerology) : null,
      params.kyuseiSeisun ? JSON.stringify(params.kyuseiSeisun) : null,
      params.westernZodiac ? JSON.stringify(params.westernZodiac) : null,
      params.mbtiResult ? JSON.stringify(params.mbtiResult) : null,
      params.loveTypeResult ? JSON.stringify(params.loveTypeResult) : null,
      params.analysis,
      params.characterId ?? null,
      params.baziKey,
    ]
  )
  return id
}

/**
 * ユーザーが直近に受けたMBTI診断の結果を取得する（「悩みだけ入力し直す」再診断用）
 */
export async function getLatestMBTIResult(userId: string): Promise<MBTIQuizResult | null> {
  const result = await query(
    `SELECT mbti_result FROM readings
     WHERE user_id = $1 AND mbti_result IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  )
  return result.rows.length > 0 ? result.rows[0].mbti_result : null
}

/**
 * ユーザーが直近に受けたラブタイプ診断64の結果を取得する（「悩みだけ入力し直す」再診断用）
 */
export async function getLatestLoveType64Result(userId: string): Promise<LoveType64Result | null> {
  const result = await query(
    `SELECT love_type_result FROM readings
     WHERE user_id = $1 AND love_type_result IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  )
  return result.rows.length > 0 ? result.rows[0].love_type_result : null
}

/**
 * 同一命式・悩みなしの過去診断が既にあるか確認する（重複診断のブロック用）
 */
export async function findDuplicateReading(userId: string, baziKey: string): Promise<{ id: string; createdAt: string } | null> {
  const result = await query(
    `SELECT id, created_at FROM readings
     WHERE user_id = $1 AND bazi_key = $2 AND (concern IS NULL OR concern = '')
     ORDER BY created_at DESC LIMIT 1`,
    [userId, baziKey]
  )
  if (result.rows.length === 0) return null
  return { id: result.rows[0].id, createdAt: result.rows[0].created_at }
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

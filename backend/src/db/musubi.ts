/**
 * ムスビの総合相談：解放の条件と、各占い師のところで得た情報のまとめ
 *
 * 解放の条件：ナツメ・ツキ・コクウ・クリの4人すべてが解放され、親密度がMAX（レベル10）になること。
 * 情報のまとめは、診断のたびに保存している診断履歴（readings）から、その場で取り出す
 * （新しい保存先は作らない。手相の写真は、もともと保存していない。残っているのは、診断の文章だけ）。
 */

import { query } from './client.js'

const MAX_INTIMACY_LEVEL = 10
const OTHER_CHARACTER_IDS = [1, 2, 3, 4]

/** 4人すべての親密度がMAXなら、ムスビを解放する（すでに解放済みなら何もしない）。解放されているかを返す */
export async function ensureMusubiUnlocked(userId: string): Promise<boolean> {
  const own = await query('SELECT unlocked_at FROM character_intimacy WHERE user_id = $1 AND character_id = 0', [userId])
  if (own.rows.length > 0 && own.rows[0].unlocked_at) return true

  const others = await query(
    `SELECT character_id, intimacy_level, unlocked_at FROM character_intimacy
     WHERE user_id = $1 AND character_id = ANY($2::int[])`,
    [userId, OTHER_CHARACTER_IDS]
  )
  const allMax =
    others.rows.length === OTHER_CHARACTER_IDS.length &&
    others.rows.every((r) => r.unlocked_at && r.intimacy_level >= MAX_INTIMACY_LEVEL)
  if (!allMax) return false

  await query(
    `INSERT INTO character_intimacy (user_id, character_id, intimacy_level, intimacy_points, total_diagnoses, unlocked_at)
     VALUES ($1, 0, 0, 0, 0, NOW())
     ON CONFLICT (user_id, character_id) DO UPDATE SET unlocked_at = COALESCE(character_intimacy.unlocked_at, NOW())`,
    [userId]
  )
  return true
}

export interface UserProfileSources {
  /** 生年月日の占い（ナツメ・ツキ）：直近の1件 */
  birth: {
    birthDate: string | null
    birthTime: string | null
    birthPlace: string | null
    baZi: any
    numerology: any
    kyuseiSeisun: any
    westernZodiac: any
  } | null
  mbti: any | null
  loveType: any | null
  /** 手相（コクウ）の診断文（写真は保存していない） */
  palmAnalysis: string | null
  /** 姓名判断（コクウ）の診断文（先頭に、名前と五格の要約が付く） */
  seimeiAnalysis: string | null
}

async function latestRow(userId: string, where: string): Promise<any | null> {
  const r = await query(`SELECT * FROM readings WHERE user_id = $1 AND ${where} ORDER BY created_at DESC LIMIT 1`, [userId])
  return r.rows[0] ?? null
}

export async function getUserProfileSources(userId: string): Promise<UserProfileSources> {
  const birthRow = await latestRow(userId, 'bazi_result IS NOT NULL')
  const mbtiRow = await latestRow(userId, 'mbti_result IS NOT NULL')
  const loveRow = await latestRow(userId, 'love_type_result IS NOT NULL')
  const palmRow = await latestRow(userId, "bazi_key LIKE 'palm:%'")
  const seimeiRow = await latestRow(userId, "bazi_key LIKE 'seimei:%'")
  const dateOnly = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v ? String(v).slice(0, 10) : null)
  return {
    birth: birthRow
      ? {
          birthDate: dateOnly(birthRow.birth_date),
          birthTime: birthRow.birth_time ? String(birthRow.birth_time).slice(0, 5) : null,
          birthPlace: birthRow.birth_place ?? null,
          baZi: birthRow.bazi_result,
          numerology: birthRow.numerology_result,
          kyuseiSeisun: birthRow.kyusei_result,
          westernZodiac: birthRow.western_zodiac_result,
        }
      : null,
    mbti: mbtiRow?.mbti_result ?? null,
    loveType: loveRow?.love_type_result ?? null,
    palmAnalysis: palmRow?.llm_analysis ?? null,
    seimeiAnalysis: seimeiRow?.llm_analysis ?? null,
  }
}

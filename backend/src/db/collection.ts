/**
 * 図鑑（出会ったタイプの記録）と、実績のための集計
 *
 *   collection_entries … kind（mbti＝性格タイプ／love＝恋愛タイプ／sukuyou＝宿曜の本命宿）ごとに、出会ったタイプと、その回数
 *   user_stats         … 診断の回数（全体と、種類ごと）
 */

import { query } from './client.js'

export type CollectionKind = 'mbti' | 'love' | 'sukuyou'

export async function recordCollection(userId: string, kind: CollectionKind, code: string): Promise<void> {
  await query(
    `INSERT INTO collection_entries (user_id, kind, code) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, kind, code) DO UPDATE SET count = collection_entries.count + 1, last_at = NOW()`,
    [userId, kind, code]
  )
}

export async function incrementStat(userId: string, key: string): Promise<void> {
  await query(
    `INSERT INTO user_stats (user_id, key, value) VALUES ($1, $2, 1)
     ON CONFLICT (user_id, key) DO UPDATE SET value = user_stats.value + 1`,
    [userId, key]
  )
}

export async function getStats(userId: string): Promise<Record<string, number>> {
  const r = await query('SELECT key, value FROM user_stats WHERE user_id = $1', [userId])
  return Object.fromEntries(r.rows.map((x) => [x.key as string, Number(x.value)]))
}

export interface CollectedEntry {
  kind: CollectionKind
  code: string
  count: number
  firstAt: string
}

/** 保存済みの「最新の結果」から、まだ図鑑にないタイプを、補う（図鑑を作る前の診断の分） */
async function backfillFromLatest(userId: string): Promise<void> {
  const r = await query("SELECT kind, payload FROM latest_results WHERE user_id = $1 AND kind IN ('mbti', 'love64', 'sukuyou')", [userId])
  for (const row of r.rows) {
    const p = row.payload as any
    let kind: CollectionKind | null = null
    let code: string | null = null
    if (row.kind === 'mbti') {
      kind = 'mbti'
      code = String(p?.mbtiResult?.personalityType ?? '').split('-')[0] || null
    } else if (row.kind === 'love64') {
      kind = 'love'
      code = String(p?.loveTypeResult?.type1 ?? p?.loveTypeResult?.fullType ?? '').split('-')[0] || null
    } else if (row.kind === 'sukuyou') {
      kind = 'sukuyou'
      code = p?.sukuyouResult?.mei?.name ?? null
    }
    if (kind && code) {
      await query(
        `INSERT INTO collection_entries (user_id, kind, code) VALUES ($1, $2, $3) ON CONFLICT (user_id, kind, code) DO NOTHING`,
        [userId, kind, code]
      )
    }
  }
}

export async function listCollection(userId: string): Promise<CollectedEntry[]> {
  // （自分の診断結果からの補いは、しない。backfillFromLatest は、使わない）
  void backfillFromLatest
  const r = await query(
    `SELECT kind, code, count, first_at FROM collection_entries WHERE user_id = $1 ORDER BY first_at`,
    [userId]
  )
  return r.rows.map((x) => ({ kind: x.kind, code: x.code, count: x.count, firstAt: x.first_at }))
}

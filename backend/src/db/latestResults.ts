/**
 * 各診断の「最新の結果」の保存
 *
 * 一度診断した各診断の最新の結果は、ルーンストーンなしで、いつでも見返せる。
 * 診断の種類（kind）ごとに、ユーザーあたり1件だけ持ち、診断のたびに上書きする。
 * 保存するのは、画面にそのまま出せる形の結果（手相は、撮影した写真と、線の座標も含む）。
 *
 * kind：
 *   fortune:1  … ナツメ（四柱推命・数秘術・九星気学）  fortune:2 … ツキ（西洋占星術）
 *   sukuyou    … ツキ（宿曜占星術）
 *   mbti / love64 … クリ（性格16タイプ・ラブタイプ64）
 *   palm / seimei … コクウ（手相・姓名判断）
 *   musubi     … ムスビ（総合相談）
 */

import { query } from './client.js'

export const LATEST_KINDS = ['fortune:1', 'fortune:2', 'sukuyou', 'mbti', 'love64', 'palm', 'seimei', 'musubi'] as const
export type LatestKind = (typeof LATEST_KINDS)[number]

export function isLatestKind(v: unknown): v is LatestKind {
  return typeof v === 'string' && (LATEST_KINDS as readonly string[]).includes(v)
}

/** 最新の結果を保存する（上書き）。失敗しても、診断そのものは失敗させない（呼び出し側で握りつぶす） */
export async function saveLatestResult(userId: string, kind: LatestKind, payload: unknown): Promise<void> {
  await query(
    `INSERT INTO latest_results (user_id, kind, payload, saved_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (user_id, kind) DO UPDATE SET payload = EXCLUDED.payload, saved_at = NOW()`,
    [userId, kind, JSON.stringify(payload)]
  )
}

export async function getLatestResult(userId: string, kind: LatestKind): Promise<{ payload: any; savedAt: string } | null> {
  const r = await query('SELECT payload, saved_at FROM latest_results WHERE user_id = $1 AND kind = $2', [userId, kind])
  if (r.rows.length === 0) return null
  return { payload: r.rows[0].payload, savedAt: new Date(r.rows[0].saved_at).toISOString() }
}

export async function listLatestResults(userId: string): Promise<Array<{ kind: string; savedAt: string }>> {
  const r = await query('SELECT kind, saved_at FROM latest_results WHERE user_id = $1 ORDER BY saved_at DESC', [userId])
  return r.rows.map((row) => ({ kind: row.kind, savedAt: new Date(row.saved_at).toISOString() }))
}

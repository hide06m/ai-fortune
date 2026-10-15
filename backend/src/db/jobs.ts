/**
 * 「受付して、できたら知らせる」診断のジョブ（受付状況と、結果の保存）
 */

import { randomUUID } from 'node:crypto'
import { query } from './client.js'

export interface JobRow {
  id: string
  kind: string
  status: 'running' | 'done'
  httpStatus: number | null
  body: unknown
  createdAt: string
  finishedAt: string | null
}

export async function createJob(userId: string, kind: string): Promise<string> {
  const id = randomUUID()
  await query('INSERT INTO diagnosis_jobs (id, user_id, kind) VALUES ($1, $2, $3)', [id, userId, kind])
  return id
}

export async function finishJob(id: string, httpStatus: number, body: unknown): Promise<void> {
  await query("UPDATE diagnosis_jobs SET status = 'done', http_status = $2, body = $3, finished_at = NOW() WHERE id = $1", [id, httpStatus, JSON.stringify(body)])
}

export async function getJob(userId: string, id: string): Promise<JobRow | null> {
  const r = await query('SELECT id, kind, status, http_status, body, created_at, finished_at FROM diagnosis_jobs WHERE id = $1 AND user_id = $2', [id, userId])
  if (r.rows.length === 0) return null
  const x = r.rows[0]
  return { id: x.id, kind: x.kind, status: x.status, httpStatus: x.http_status, body: x.body, createdAt: x.created_at, finishedAt: x.finished_at }
}

const RESTART_BODY = { success: false, error: 'SERVER_RESTART', message: '診断の途中で、サーバーが再起動しました。お手数ですが、もう一度お試しください。' }

/** サーバーが止まって、途中で終わってしまったジョブを、失敗として閉じる。古いジョブは消す */
export async function closeStaleJobs(): Promise<void> {
  await query("UPDATE diagnosis_jobs SET status = 'done', http_status = 503, finished_at = NOW(), body = $1 WHERE status = 'running'", [JSON.stringify(RESTART_BODY)])
  await query("DELETE FROM diagnosis_jobs WHERE created_at < NOW() - INTERVAL '3 days'")
}

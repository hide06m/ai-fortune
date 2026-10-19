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

/**
 * できあがった結果は、まず、メモリに残す（DBへの保存が、一時的に失敗しても、画面に、結果を返せるように）。
 * 古いものは、1時間で、消す。
 */
const memoryResults = new Map<string, { userId: string; httpStatus: number; body: unknown; finishedAt: number }>()
const MEMORY_TTL_MS = 60 * 60 * 1000

function rememberResult(userId: string | null, id: string, httpStatus: number, body: unknown) {
  const now = Date.now()
  for (const [k, v] of memoryResults) if (now - v.finishedAt > MEMORY_TTL_MS) memoryResults.delete(k)
  if (userId) memoryResults.set(id, { userId, httpStatus, body, finishedAt: now })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function finishJob(id: string, httpStatus: number, body: unknown, userId: string | null = null): Promise<void> {
  rememberResult(userId, id, httpStatus, body)
  // DBへの保存が、一時的な接続のエラーで失敗しても、あきらめず、間をあけて、やり直す（最大で約1分）
  const waits = [0, 1000, 3000, 6000, 12000, 20000]
  let lastError: unknown
  for (const w of waits) {
    if (w) await sleep(w)
    try {
      await query("UPDATE diagnosis_jobs SET status = 'done', http_status = $2, body = $3, finished_at = NOW() WHERE id = $1", [id, httpStatus, JSON.stringify(body)])
      return
    } catch (error) {
      lastError = error
      console.error(`[jobs] finishJob の保存に失敗（${w / 1000}秒待ったあと）:`, (error as Error).message)
    }
  }
  throw lastError
}

export async function getJob(userId: string, id: string): Promise<JobRow | null> {
  const r = await query('SELECT id, kind, status, http_status, body, created_at, finished_at FROM diagnosis_jobs WHERE id = $1 AND user_id = $2', [id, userId])
  if (r.rows.length === 0) return null
  const x = r.rows[0]
  // DBでは、まだ「進行中」でも、メモリに、結果があれば、それを返す（DBへの保存が、遅れているとき）
  const mem = memoryResults.get(id)
  if (x.status === 'running' && mem && mem.userId === userId) {
    return { id: x.id, kind: x.kind, status: 'done', httpStatus: mem.httpStatus, body: mem.body, createdAt: x.created_at, finishedAt: new Date(mem.finishedAt).toISOString() }
  }
  return { id: x.id, kind: x.kind, status: x.status, httpStatus: x.http_status, body: x.body, createdAt: x.created_at, finishedAt: x.finished_at }
}

const RESTART_BODY = { success: false, error: 'SERVER_RESTART', message: '診断の途中でサーバーが再起動しました。お手数ですがもう一度お試しください。' }

/** サーバーが止まって、途中で終わってしまったジョブを、失敗として閉じる。古いジョブは消す */
export async function closeStaleJobs(): Promise<void> {
  await query("UPDATE diagnosis_jobs SET status = 'done', http_status = 503, finished_at = NOW(), body = $1 WHERE status = 'running'", [JSON.stringify(RESTART_BODY)])
  await query("DELETE FROM diagnosis_jobs WHERE created_at < NOW() - INTERVAL '3 days'")
}

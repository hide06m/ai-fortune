/**
 * Cloudflare Workers の入口。Express のアプリ（index.ts）を、そのまま動かす。
 * - fetch：普通のリクエスト
 * - queue：診断の裏処理（AI の生成は数分かかることがあるので、リクエストとは別に、最後まで進める）
 * DB の表は、ここでは作らない（scripts/init-db.ts を、デプロイの前に一度実行する）。
 */
import { httpServerHandler } from 'cloudflare:node'
import app from './index.js'
import { finishJob } from './db/jobs.js'
import { withDbScope } from './db/client.js'
import { internalJobKey } from './middleware/asyncJob.js'

const PORT = 3000
app.listen(PORT)
const handler = httpServerHandler({ port: PORT })

interface JobMessage {
  jobId: string
  userId: string
  path: string
  payload: string
  auth: string
}

const WATCHDOG_MS = 330_000

async function runJob(m: JobMessage, env: unknown, ctx: unknown): Promise<void> {
  const failure = (status: number, error: string, message: string) => finishJob(m.jobId, status, { success: false, error, message }, m.userId)
  try {
    const req = new Request(`https://internal${m.path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: m.auth, 'x-job-internal': internalJobKey() },
      body: m.payload,
    })
    const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), WATCHDOG_MS))
    const res = await Promise.race([handler.fetch(req, env, ctx), timeout])
    if (res === 'timeout') {
      await failure(504, 'JOB_TIMEOUT', '診断に時間がかかりすぎました。もう一度お試しください。')
      return
    }
    let body: unknown
    try {
      body = JSON.parse(await res.text())
    } catch {
      body = { success: false, error: 'BAD_RESPONSE', message: '診断の結果を読み取れませんでした。もう一度お試しください。' }
    }
    await withDbScope(() => finishJob(m.jobId, res.status, body, m.userId))
  } catch (error) {
    console.error('[queue] job failed:', error)
    await withDbScope(() => failure(503, 'JOB_FAILED', '診断を続けられませんでした。もう一度お試しください。')).catch(() => undefined)
  }
}

export default {
  fetch(request: Request, env: unknown, ctx: unknown): Promise<Response> {
    return handler.fetch(request, env, ctx)
  },
  async queue(batch: { messages: { body: JobMessage; ack: () => void }[] }, env: unknown, ctx: unknown): Promise<void> {
    for (const msg of batch.messages) {
      // 石の消費を伴う処理なので、やり直し（再配信）はしない。結果は、成功でも失敗でも、必ず、DBに書く
      msg.ack()
      await runJob(msg.body, env, ctx)
    }
  },
}

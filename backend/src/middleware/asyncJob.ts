/**
 * 「受付して、できたら知らせる」診断
 *
 * 診断（AI）は、混雑すると、数分かかることがある。1回の通信を、そのまま待たせ続けると、通信が途中で切れたとき（回線・サーバー側の
 * 接続時間の制限）に、診断が成功していても、結果を受け取れない。そこで、依頼（ヘッダ X-Async-Job: 1）を受け付けたら、すぐに
 * ジョブ番号を返し（202）、診断は、サーバーの中で、普通の診断と同じ経路（石の消費・払い戻し・親密度・保存を含む）で最後まで行う。
 * 画面は、ジョブ番号で結果を取りに来る（GET /api/jobs/:id）。画面を閉じても、診断は続き、結果は「前回の結果」にも保存される。
 *
 * ログイン済みの利用者だけが対象（ゲストは、従来どおり、その場で待つ）。タイプだけの診断（AIなし）も、対象外。
 */

import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { Request, Response, NextFunction } from 'express'
import { createJob, finishJob } from '../db/jobs.js'

/** 自分自身への内部の呼び出しだと示す合図（外から偽装できないよう、起動のたびに作る） */
export const INTERNAL_JOB_KEY = randomUUID()

export function asyncJob(kindOf: (req: Request) => string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const wanted = req.headers['x-async-job'] === '1'
    const internal = req.headers['x-job-internal'] === INTERNAL_JOB_KEY
    if (!wanted || internal || !req.isAuthenticated || !req.user || req.body?.typeOnly === true) return next()

    let jobId: string
    try {
      jobId = await createJob(req.user.userId, kindOf(req))
    } catch (error) {
      console.error('[asyncJob] failed to create job, falling back to sync:', error)
      return next()
    }
    res.status(202).json({ success: true, async: true, jobId })

    // 同じサーバーの、同じ経路を、もう一度通す（認証つき）。画面との通信が切れても、ここは最後まで進む
    const payload = JSON.stringify(req.body ?? {})
    const port = Number(process.env.PORT) || 3000
    const inner = http.request(
      {
        host: '127.0.0.1',
        port,
        path: req.originalUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          Authorization: req.headers.authorization ?? '',
          'x-job-internal': INTERNAL_JOB_KEY,
        },
        timeout: 0,
      },
      (r) => {
        const chunks: Buffer[] = []
        r.on('data', (c) => chunks.push(c))
        r.on('end', async () => {
          let body: unknown
          try {
            body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          } catch {
            body = { success: false, error: 'BAD_RESPONSE', message: '診断の結果を読み取れませんでした。もう一度お試しください。' }
          }
          await finishJob(jobId, r.statusCode ?? 500, body, req.user!.userId).catch((e) => console.error('[asyncJob] finishJob failed:', e))
        })
      }
    )
    inner.on('error', async (error) => {
      console.error('[asyncJob] inner request failed:', error)
      await finishJob(jobId, 503, { success: false, error: 'JOB_FAILED', message: '診断を続けられませんでした。もう一度お試しください。' }, req.user!.userId).catch(() => {})
    })
    inner.write(payload)
    inner.end()
  }
}

/**
 * 受付した診断の、結果を取りに来るエンドポイント
 * GET /api/jobs/:id … { status: 'running' } または { status: 'done', httpStatus, body }
 */

import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { getJob } from '../db/jobs.js'

const router = Router()

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ success: false, error: 'bad id' })
    const job = await getJob(req.user!.userId, req.params.id)
    if (!job) return res.status(404).json({ success: false, error: 'NOT_FOUND' })
    res.json({ success: true, kind: job.kind, status: job.status, httpStatus: job.httpStatus, body: job.body })
  } catch (error) {
    console.error('[API] Failed to get job:', error)
    res.status(500).json({ success: false, error: 'failed to get job' })
  }
})

export default router

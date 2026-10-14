/**
 * 各診断の最新の結果を見返すエンドポイント（ルーンストーン不要）
 * GET /api/results/latest         … 保存されている結果の一覧（kind と保存日時）
 * GET /api/results/latest/:kind   … その種類の最新の結果（画面にそのまま出せる形）
 */

import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { getLatestResult, isLatestKind, listLatestResults } from '../db/latestResults.js'

const router = Router()

router.get('/latest', requireAuth, async (req: Request, res: Response) => {
  try {
    res.json({ success: true, results: await listLatestResults(req.user!.userId) })
  } catch (error) {
    console.error('[API] Failed to list latest results:', error)
    res.status(500).json({ success: false, error: 'failed to list results' })
  }
})

router.get('/latest/:kind', requireAuth, async (req: Request, res: Response) => {
  try {
    const kind = req.params.kind
    if (!isLatestKind(kind)) return res.status(400).json({ success: false, error: 'unknown kind' })
    const found = await getLatestResult(req.user!.userId, kind)
    if (!found) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'この診断の結果は、まだありません' })
    res.json({ success: true, kind, savedAt: found.savedAt, reading: found.payload })
  } catch (error) {
    console.error('[API] Failed to get latest result:', error)
    res.status(500).json({ success: false, error: 'failed to get result' })
  }
})

export default router

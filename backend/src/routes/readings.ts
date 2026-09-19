/**
 * 診断履歴（readings）関連 API エンドポイント
 * GET /api/readings      - 自分の診断履歴一覧
 * GET /api/readings/:id  - 診断履歴の詳細
 */

import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { getUserReadings, getReadingById } from '../db/readings.js'

const router = Router()

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).userId
    const readings = await getUserReadings(userId)
    res.json({ success: true, readings })
  } catch (error) {
    console.error('[API] Failed to get readings:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get readings',
    })
  }
})

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).userId
    const reading = await getReadingById(userId, req.params.id)
    if (!reading) {
      return res.status(404).json({ success: false, error: 'Reading not found' })
    }
    res.json({ success: true, reading })
  } catch (error) {
    console.error('[API] Failed to get reading:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get reading',
    })
  }
})

export default router

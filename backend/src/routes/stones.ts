/**
 * 石（診断に使う仮想通貨）関連 API エンドポイント
 * GET  /api/stones/balance            - 残高・ログインボーナス受取可否を取得
 * POST /api/stones/claim-daily-bonus  - ログインボーナスを受け取る（1日1回、+1石）
 * POST /api/stones/watch-ad           - 広告視聴ボーナスを受け取る（1日5回まで、+1石）
 */

import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { getStoneBalance, claimDailyLoginBonus, claimAdWatchBonus } from '../db/stones.js'

const router = Router()

router.get('/balance', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).userId
    const balance = await getStoneBalance(userId)
    res.json({ success: true, balance })
  } catch (error) {
    console.error('[API] Failed to get stone balance:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get stone balance',
    })
  }
})

router.post('/claim-daily-bonus', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).userId
    const result = await claimDailyLoginBonus(userId)
    res.json({ success: true, ...result })
  } catch (error) {
    console.error('[API] Failed to claim daily bonus:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to claim daily bonus',
    })
  }
})

router.post('/watch-ad', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).userId
    const result = await claimAdWatchBonus(userId)
    res.json({ success: true, ...result })
  } catch (error) {
    console.error('[API] Failed to claim ad-watch bonus:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to claim ad-watch bonus',
    })
  }
})

export default router

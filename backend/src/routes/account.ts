/**
 * アカウントの削除
 *   DELETE /api/account   body: { confirm: 'DELETE' } … 本人のデータを、すべて消す（元に戻せない）
 * 子の表は、users への外部キーの ON DELETE CASCADE で、まとめて消える。
 * 招待リンクで、ほかの人が答えた縁帳の回答（person_results）も、people ごと消える。
 */

import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { query } from '../db/client.js'

const router = Router()

router.delete('/', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.body?.confirm !== 'DELETE') return res.status(400).json({ success: false, error: 'confirm が必要です' })
    const userId = req.user!.userId
    const r = await query('DELETE FROM users WHERE id = $1', [userId])
    console.log(`[ACCOUNT] deleted user ${userId} (rows: ${r.rowCount})`)
    res.json({ success: true })
  } catch (error) {
    console.error('[API] account delete failed:', error)
    res.status(500).json({ success: false, error: 'failed' })
  }
})

export default router

/**
 * 受信箱
 *   GET  /api/inbox              … 自分の受信箱（未読数・受け取れる石つき）
 *   POST /api/inbox/:id/read     … 既読にする
 *   POST /api/inbox/:id/claim    … 石を受け取る
 *   POST /api/inbox/claim-all    … 受け取れる石を、まとめて受け取る
 */

import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { listInbox, markRead, claimMessage, claimAll } from '../db/inbox.js'

const router = Router()

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const messages = await listInbox(req.user!.userId)
    res.json({
      success: true,
      messages,
      unread: messages.filter((m) => !m.read).length,
      claimable: messages.filter((m) => m.stones > 0 && !m.claimed).length,
    })
  } catch (error) {
    console.error('[API] inbox list failed:', error)
    res.status(500).json({ success: false, error: 'failed' })
  }
})

router.post('/claim-all', requireAuth, async (req: Request, res: Response) => {
  try {
    res.json({ success: true, ...(await claimAll(req.user!.userId)) })
  } catch (error) {
    console.error('[API] inbox claim-all failed:', error)
    res.status(500).json({ success: false, error: 'failed' })
  }
})

router.post('/:id/read', requireAuth, async (req: Request, res: Response) => {
  try {
    res.json({ success: await markRead(req.user!.userId, String(req.params.id)) })
  } catch {
    res.status(500).json({ success: false, error: 'failed' })
  }
})

router.post('/:id/claim', requireAuth, async (req: Request, res: Response) => {
  try {
    res.json({ success: true, ...(await claimMessage(req.user!.userId, String(req.params.id))) })
  } catch (error) {
    console.error('[API] inbox claim failed:', error)
    res.status(500).json({ success: false, error: 'failed' })
  }
})

export default router

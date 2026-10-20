/**
 * 運営用の API（受信箱への送信）。環境変数 ADMIN_TOKEN（16文字以上）が設定されているときだけ使える。
 *   POST   /api/admin/inbox        … 送信（userEmail を省略すると、全員向け）
 *   GET    /api/admin/inbox        … 最近の全員向けメッセージ
 *   DELETE /api/admin/inbox/:id    … 取り消し
 * 認証：ヘッダー x-admin-token（ADMIN_TOKEN と同じ値）。送信は、tools/send_notice.mjs が簡単
 */

import { Router, Request, Response, NextFunction } from 'express'
import crypto from 'node:crypto'
import { query } from '../db/client.js'
import { createMessage, deleteMessage, listBroadcasts, INBOX_KINDS, type InboxKind } from '../db/inbox.js'

const router = Router()

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.ADMIN_TOKEN
  if (!expected || expected.length < 16) return res.status(404).json({ success: false, error: 'not found' })
  const given = String(req.headers['x-admin-token'] ?? '')
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ success: false, error: 'unauthorized' })
  next()
}

router.post('/inbox', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { title, body, kind, stones, userEmail, showOnHome, expiresInDays } = req.body ?? {}
    if (typeof title !== 'string' || !title.trim() || typeof body !== 'string' || !body.trim()) {
      return res.status(400).json({ success: false, error: 'title と body が必要です' })
    }
    const k: InboxKind = INBOX_KINDS.includes(kind) ? kind : 'notice'
    let userId: string | null = null
    if (userEmail) {
      const u = await query('SELECT id FROM users WHERE email = $1', [String(userEmail)])
      if (u.rows.length === 0) return res.status(404).json({ success: false, error: 'ユーザーが見つかりません' })
      userId = u.rows[0].id
    }
    const id = await createMessage({ userId, kind: k, title, body, stones: Number(stones) || 0, showOnHome: !!showOnHome, expiresInDays: Number(expiresInDays) || null })
    res.json({ success: true, id, audience: userId ? 'personal' : 'everyone' })
  } catch (error) {
    console.error('[API] admin inbox create failed:', error)
    res.status(500).json({ success: false, error: 'failed' })
  }
})

router.get('/inbox', requireAdmin, async (_req: Request, res: Response) => {
  res.json({ success: true, messages: await listBroadcasts() })
})

router.delete('/inbox/:id', requireAdmin, async (req: Request, res: Response) => {
  res.json({ success: await deleteMessage(String(req.params.id)) })
})

export default router

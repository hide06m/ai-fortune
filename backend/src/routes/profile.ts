/**
 * プロフィール（呼び名）
 *   GET  /api/profile            … 呼び名（まだ決めていなければ null）
 *   POST /api/profile/nickname   … 呼び名を決める・変える（body: { name }）。1〜12文字
 * 呼び名は、最初の会話でムスビに聞かれて決める。ホームの表示（称号の横）に使う。
 */

import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { query } from '../db/client.js'

const router = Router()

export const NICKNAME_MAX = 12

/** 呼び名として使える形に整える。使えないときは null */
export function normalizeNickname(input: unknown): string | null {
  if (typeof input !== 'string') return null
  // 制御文字・改行を取り、前後と連続する空白を整える
  const cleaned = input.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()
  const chars = Array.from(cleaned)
  if (chars.length < 1 || chars.length > NICKNAME_MAX) return null
  // URL やメールのような、連絡先の書きこみは、避ける
  if (/https?:|@|\.com|\.jp/i.test(cleaned)) return null
  return cleaned
}

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const r = await query('SELECT nickname FROM user_profile WHERE user_id = $1', [req.user!.userId])
    res.json({ success: true, nickname: r.rows[0]?.nickname ?? null })
  } catch (error) {
    console.error('[API] profile get failed:', error)
    res.status(500).json({ success: false, error: 'failed' })
  }
})

router.post('/nickname', requireAuth, async (req: Request, res: Response) => {
  try {
    const name = normalizeNickname(req.body?.name)
    if (!name) return res.status(400).json({ success: false, error: 'INVALID_NAME', message: `呼び名は、1〜${NICKNAME_MAX}文字で入力してください（URLやメールアドレスは使えません）` })
    await query(
      `INSERT INTO user_profile (user_id, nickname) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET nickname = EXCLUDED.nickname`,
      [req.user!.userId, name]
    )
    res.json({ success: true, nickname: name })
  } catch (error) {
    console.error('[API] profile nickname failed:', error)
    res.status(500).json({ success: false, error: 'failed' })
  }
})

export default router

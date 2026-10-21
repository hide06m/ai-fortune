/**
 * 長期ミッション（一度だけ受け取れる。報酬は、基本、石。手間のかかるものは、かけらも）
 *   GET  /api/missions/long             … 長期ミッションと、進み具合・かけらの数
 *   POST /api/missions/long/:id/claim   … 達成したものの報酬を、受け取る
 */

import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { query } from '../db/client.js'
import { getStoneBalance, grantStones } from '../db/stones.js'
import { LONG_MISSIONS } from '../missions/defs.js'

const router = Router()

async function getShards(userId: string): Promise<number> {
  const r = await query("SELECT value FROM user_stats WHERE user_id = $1 AND key = 'shards'", [userId])
  return Number(r.rows[0]?.value ?? 0)
}

async function snapshot(userId: string) {
  const claimed = new Set((await query('SELECT mission_id FROM long_claims WHERE user_id = $1', [userId])).rows.map((x) => x.mission_id as string))
  const missions = await Promise.all(
    LONG_MISSIONS.map(async (m) => {
      const progress = Math.min(await m.progress(userId), m.target)
      return { id: m.id, title: m.title, desc: m.desc, target: m.target, reward: m.reward, progress, done: progress >= m.target, claimed: claimed.has(m.id) }
    })
  )
  return { success: true, missions, shards: await getShards(userId), balance: await getStoneBalance(userId) }
}

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    res.json(await snapshot(req.user!.userId))
  } catch (error) {
    console.error('[API] long missions failed:', error)
    res.status(500).json({ success: false, error: 'failed' })
  }
})

router.post('/:id/claim', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId
    const m = LONG_MISSIONS.find((x) => x.id === req.params.id)
    if (!m) return res.status(400).json({ success: false, error: 'UNKNOWN_MISSION' })
    if ((await m.progress(userId)) < m.target) return res.status(400).json({ success: false, error: 'NOT_DONE', message: 'まだ達成していません' })
    // 先に「受け取った」記録を入れる（二重に押されても、1回だけ）
    const ins = await query('INSERT INTO long_claims (user_id, mission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING mission_id', [userId, m.id])
    if (ins.rows.length === 0) return res.status(409).json({ success: false, error: 'ALREADY_CLAIMED', message: 'もう受け取っています' })
    try {
      await grantStones(userId, m.reward.stones, 'mission_reward')
      if (m.reward.shards) {
        await query(
          `INSERT INTO user_stats (user_id, key, value) VALUES ($1, 'shards', $2)
           ON CONFLICT (user_id, key) DO UPDATE SET value = user_stats.value + EXCLUDED.value`,
          [userId, m.reward.shards]
        )
      }
    } catch (error) {
      await query('DELETE FROM long_claims WHERE user_id = $1 AND mission_id = $2', [userId, m.id])
      throw error
    }
    res.json(await snapshot(userId))
  } catch (error) {
    console.error('[API] long mission claim failed:', error)
    res.status(500).json({ success: false, error: 'failed' })
  }
})

export default router

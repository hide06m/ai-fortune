/**
 * ミニゲーム（診断の待ち時間に遊ぶ）の報酬
 *   GET  /api/minigame/status  今日、あと、もらえる石の数
 *   POST /api/minigame/reward  クリアの報告 → 石を渡す（診断を待っている間だけ・診断1回につき1回・1日の上限あり）
 *
 * 画面（クライアント）の「クリアした」という報告は、うたがうこともできるので、次の条件で、渡しすぎを防ぐ。
 *  - 診断のジョブが、本人のもので、待っている間（または、できてから2分以内）であること
 *  - ジョブの受付から、クリアに必要な最短の時間（20秒）以上たっていること
 *  - 診断1回につき、1回だけ（同じジョブでは、2回目はもらえない）
 *  - 1日（日本時間）の上限
 */

import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { query } from '../db/client.js'
import { grantMissionReward } from '../db/stones.js'

const router = Router()

export const MINIGAME_REWARD_STONES = 1 // 1回のクリアでもらえる石
export const MINIGAME_DAILY_LIMIT = 3 // 1日にもらえる石の上限
const MIN_PLAY_SECONDS = 20 // ジョブの受付から、クリアまでの、最短の時間

async function earnedToday(userId: string): Promise<number> {
  const r = await query(
    "SELECT COALESCE(SUM(stones), 0)::int AS n FROM minigame_rewards WHERE user_id = $1 AND day = (NOW() AT TIME ZONE 'Asia/Tokyo')::date",
    [userId]
  )
  return r.rows[0].n
}

router.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const n = await earnedToday(req.user!.userId)
    res.json({ success: true, limit: MINIGAME_DAILY_LIMIT, earned: n, remaining: Math.max(0, MINIGAME_DAILY_LIMIT - n) })
  } catch (error) {
    console.error('[API] minigame status failed:', error)
    res.status(500).json({ success: false, error: 'failed' })
  }
})

router.post('/reward', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId
    const { jobId, game, difficulty } = req.body
    if (typeof jobId !== 'string' || !/^[0-9a-f-]{36}$/i.test(jobId)) return res.status(400).json({ success: false, error: 'jobId が正しくありません' })
    if (game !== 'forest_run') return res.status(400).json({ success: false, error: 'game が正しくありません' })
    const diff = ['easy', 'normal', 'hard', 'extra'].includes(difficulty) ? difficulty : 'easy'

    const job = await query(
      `SELECT status, EXTRACT(EPOCH FROM (NOW() - created_at)) AS age,
              EXTRACT(EPOCH FROM (NOW() - COALESCE(finished_at, NOW()))) AS since_finish
       FROM diagnosis_jobs WHERE id = $1 AND user_id = $2`,
      [jobId, userId]
    )
    if (job.rows.length === 0) return res.json({ success: true, granted: 0, reason: 'no_job' })
    const j = job.rows[0]
    const waiting = j.status === 'running' || Number(j.since_finish) <= 120
    if (!waiting) return res.json({ success: true, granted: 0, reason: 'not_waiting' })
    if (Number(j.age) < MIN_PLAY_SECONDS) return res.json({ success: true, granted: 0, reason: 'too_fast' })

    const n = await earnedToday(userId)
    const room = Math.max(0, MINIGAME_DAILY_LIMIT - n)
    if (room <= 0) return res.json({ success: true, granted: 0, reason: 'daily_limit', remaining: 0, limit: MINIGAME_DAILY_LIMIT })
    const amount = Math.min(MINIGAME_REWARD_STONES, room)

    // 診断1回につき1回：先に、記録を入れて（同じジョブは、入らない）、入れたときだけ、石を渡す
    const ins = await query(
      'INSERT INTO minigame_rewards (job_id, user_id, game, difficulty, stones) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (job_id) DO NOTHING RETURNING job_id',
      [jobId, userId, game, diff, amount]
    )
    if (ins.rows.length === 0) return res.json({ success: true, granted: 0, reason: 'already', remaining: room, limit: MINIGAME_DAILY_LIMIT })
    const balance = await grantMissionReward(userId, amount)
    res.json({ success: true, granted: amount, balance, remaining: room - amount, limit: MINIGAME_DAILY_LIMIT })
  } catch (error) {
    console.error('[API] minigame reward failed:', error)
    res.status(500).json({ success: false, error: 'failed' })
  }
})

export default router

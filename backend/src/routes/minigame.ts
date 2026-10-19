/**
 * ミニゲーム（診断の待ち時間に遊ぶ）の報酬
 *   GET  /api/minigame/status  今日、あと、もらえる石の数
 *   POST /api/minigame/reward  クリアの報告 → 石を渡す（診断を待っている間だけ・1日に1回だけ）
 *
 * 画面（クライアント）の「クリアした」という報告は、うたがうこともできるので、次の条件で、渡しすぎを防ぐ。
 *  - 診断のジョブが、本人のもので、待っている間（または、できてから10分以内。ゲームを開いたのは、待っている間なので）であること
 *  - ジョブの受付から、クリアに必要な最短の時間（20秒）以上たっていること
 *  - 1日に1回だけ（日本時間の朝4時に切り替わる）。何個もらえる難易度でも、1回だけ
 *  - 同じ診断のジョブでは、1回だけ（1日1回なので、当然）
 */

import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { query } from '../db/client.js'
import { grantMissionReward } from '../db/stones.js'
import { GAME_DAY_DATE_SQL } from '../time/gameDay.js'

const router = Router()

/** 難易度ごとにもらえる石の数（かんたんは、なし） */
export const MINIGAME_REWARD_BY_DIFFICULTY: Record<string, number> = { easy: 0, normal: 1, hard: 2, extra: 5 }
export const MINIGAME_DAILY_LIMIT = 1 // 1日（日本時間の朝4時に切り替わる）に、もらえる回数。1日に1回だけ
const MIN_PLAY_SECONDS = 20 // ジョブの受付から、クリアまでの、最短の時間

async function earnedToday(userId: string): Promise<number> {
  const r = await query(
    `SELECT COUNT(*)::int AS n FROM minigame_rewards WHERE user_id = $1 AND day = ${GAME_DAY_DATE_SQL}`,
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
    const diff = difficulty in MINIGAME_REWARD_BY_DIFFICULTY ? difficulty : 'easy'
    const amount = MINIGAME_REWARD_BY_DIFFICULTY[diff]
    // かんたんは、石が、もらえない（ジョブも、使わない。あとで、ふつう以上でクリアすれば、もらえる）
    if (amount <= 0) return res.json({ success: true, granted: 0, reason: 'no_reward' })

    const job = await query(
      `SELECT status, EXTRACT(EPOCH FROM (NOW() - created_at)) AS age,
              EXTRACT(EPOCH FROM (NOW() - COALESCE(finished_at, NOW()))) AS since_finish
       FROM diagnosis_jobs WHERE id = $1 AND user_id = $2`,
      [jobId, userId]
    )
    if (job.rows.length === 0) {
      console.log('[minigame] no reward: no_job', { jobId })
      return res.json({ success: true, granted: 0, reason: 'no_job' })
    }
    const j = job.rows[0]
    // 診断が早く終わっても（20秒ほど）、ゲームは、30秒以上かかる。ゲームを開いたのは、診断を待っている間なので、できてから10分までは、有効にする
    const waiting = j.status === 'running' || Number(j.since_finish) <= 600
    if (!waiting) {
      console.log('[minigame] no reward: not_waiting', { jobId, sinceFinish: j.since_finish })
      return res.json({ success: true, granted: 0, reason: 'not_waiting' })
    }
    if (Number(j.age) < MIN_PLAY_SECONDS) {
      console.log('[minigame] no reward: too_fast', { jobId, age: j.age })
      return res.json({ success: true, granted: 0, reason: 'too_fast' })
    }

    const n = await earnedToday(userId)
    const room = Math.max(0, MINIGAME_DAILY_LIMIT - n)
    if (room <= 0) return res.json({ success: true, granted: 0, reason: 'daily_limit', remaining: 0, limit: MINIGAME_DAILY_LIMIT })

    // 診断1回につき1回：先に、記録を入れて（同じジョブは、入らない）、入れたときだけ、石を渡す
    const ins = await query(
      'INSERT INTO minigame_rewards (job_id, user_id, game, difficulty, stones) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (job_id) DO NOTHING RETURNING job_id',
      [jobId, userId, game, diff, amount]
    )
    if (ins.rows.length === 0) return res.json({ success: true, granted: 0, reason: 'already', remaining: room, limit: MINIGAME_DAILY_LIMIT })
    const balance = await grantMissionReward(userId, amount)
    res.json({ success: true, granted: amount, balance, remaining: room - 1, limit: MINIGAME_DAILY_LIMIT })
  } catch (error) {
    console.error('[API] minigame reward failed:', error)
    res.status(500).json({ success: false, error: 'failed' })
  }
})

export default router

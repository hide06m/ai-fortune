/**
 * ウィークリーミッション（月曜の朝4時はじまり・日本時間）
 *   GET  /api/weekly                   … 今週のミッションと、進み具合
 *   POST /api/weekly/:id/claim         … 達成したミッションの、ルーンストーンを受け取る
 */

import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { query } from '../db/client.js'
import { GAME_WEEK_START_SQL, GAME_WEEK_DATE_SQL } from '../time/gameDay.js'
import { getStoneBalance, grantStones } from '../db/stones.js'
import { GACHA_ENABLED } from './gacha.js'

const router = Router()

interface WeeklyDef {
  id: string
  title: string
  desc: string
  target: number
  reward: number
  progress: (userId: string) => Promise<number>
}

const count = async (sql: string, userId: string): Promise<number> => Number((await query(sql, [userId])).rows[0]?.n ?? 0)

const ALL_MISSIONS: WeeklyDef[] = [
  {
    id: 'login5',
    title: '今週5日ログインする',
    desc: 'ログインボーナスを受け取った日の数',
    target: 5,
    reward: 3,
    progress: (u) => count(`SELECT COUNT(*)::int AS n FROM login_days WHERE user_id = $1 AND day >= ${GAME_WEEK_DATE_SQL}`, u),
  },
  {
    id: 'diagnose3',
    title: '今週3回占う',
    desc: 'どの占い師でも、診断の回数',
    target: 3,
    reward: 2,
    progress: (u) => count(`SELECT COUNT(*)::int AS n FROM stone_transactions WHERE user_id = $1 AND reason = 'diagnosis' AND created_at >= ${GAME_WEEK_START_SQL}`, u),
  },
  {
    id: 'encounter2',
    title: '今週2つのタイプに出会う',
    desc: '図鑑に、新しく加わったタイプの数',
    target: 2,
    reward: 2,
    progress: (u) => count(`SELECT COUNT(*)::int AS n FROM collection_entries WHERE user_id = $1 AND first_at >= ${GAME_WEEK_START_SQL}`, u),
  },
  {
    id: 'minigame3',
    title: '今週ミニゲームで3回受け取る',
    desc: '診断を待つ間のミニゲームで、石をもらえた回数',
    target: 3,
    reward: 2,
    progress: (u) => count(`SELECT COUNT(*)::int AS n FROM minigame_rewards WHERE user_id = $1 AND created_at >= ${GAME_WEEK_START_SQL}`, u),
  },
]

/** 「出会い」のミッションは、森での出会いが解放されるまで、出さない */
const MISSIONS: WeeklyDef[] = GACHA_ENABLED ? ALL_MISSIONS : ALL_MISSIONS.filter((m) => m.id !== 'encounter2')

async function claimedSet(userId: string): Promise<Set<string>> {
  const r = await query(`SELECT mission_id FROM weekly_claims WHERE user_id = $1 AND week = ${GAME_WEEK_DATE_SQL}`, [userId])
  return new Set(r.rows.map((x) => x.mission_id as string))
}

async function snapshot(userId: string) {
  const claimed = await claimedSet(userId)
  const week = (await query(`SELECT to_char(${GAME_WEEK_DATE_SQL}, 'YYYY-MM-DD') AS d`)).rows[0].d as string
  const missions = await Promise.all(
    MISSIONS.map(async (m) => {
      const progress = Math.min(await m.progress(userId), m.target)
      return { id: m.id, title: m.title, desc: m.desc, target: m.target, reward: m.reward, progress, done: progress >= m.target, claimed: claimed.has(m.id) }
    })
  )
  return { success: true, weekStart: week, missions, balance: await getStoneBalance(userId) }
}

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    res.json(await snapshot(req.user!.userId))
  } catch (error) {
    console.error('[API] weekly snapshot failed:', error)
    res.status(500).json({ success: false, error: 'failed' })
  }
})

router.post('/:id/claim', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId
    const m = MISSIONS.find((x) => x.id === req.params.id)
    if (!m) return res.status(400).json({ success: false, error: 'UNKNOWN_MISSION' })
    if ((await m.progress(userId)) < m.target) return res.status(400).json({ success: false, error: 'NOT_DONE', message: 'まだ達成していません' })
    // 先に「受け取った」記録を入れる（二重に押されても、石は1回だけ）
    const ins = await query(`INSERT INTO weekly_claims (user_id, week, mission_id) VALUES ($1, ${GAME_WEEK_DATE_SQL}, $2) ON CONFLICT DO NOTHING RETURNING mission_id`, [userId, m.id])
    if (ins.rows.length === 0) return res.status(409).json({ success: false, error: 'ALREADY_CLAIMED', message: 'もう受け取っています' })
    try {
      await grantStones(userId, m.reward, 'weekly_reward')
    } catch (error) {
      await query(`DELETE FROM weekly_claims WHERE user_id = $1 AND week = ${GAME_WEEK_DATE_SQL} AND mission_id = $2`, [userId, m.id])
      throw error
    }
    res.json(await snapshot(userId))
  } catch (error) {
    console.error('[API] weekly claim failed:', error)
    res.status(500).json({ success: false, error: 'failed' })
  }
})

export default router

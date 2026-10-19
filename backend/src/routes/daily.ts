/**
 * 今日の運勢・デイリーミッション
 *   GET  /api/daily                       … 今日の運勢（生年月日が分かるとき）と、ミッションの状況
 *   POST /api/daily/birthdate             … 生年月日を保存する（今日の運勢に使う）
 *   POST /api/daily/fortune/view          … 今日の運勢を見た、と記録する（ミッションの達成）
 *   POST /api/daily/missions/:id/claim    … ミッションの報酬（ルーンストーン）を受け取る
 * 「今日」は、日本時間の日付。
 */

import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { query } from '../db/client.js'
import { computeDailyFortune, todayInJapan } from '../fortune/dailyFortune.js'
import { GAME_DAY_START_SQL } from '../time/gameDay.js'
import { isValidPastDate } from '../fortune/dateCheck.js'
import { getStoneBalance, grantMissionReward } from '../db/stones.js'

const router = Router()

interface MissionDef {
  id: 'fortune' | 'diagnose' | 'gift'
  title: string
  desc: string
  reward: number
}

const MISSIONS: MissionDef[] = [
  { id: 'fortune', title: '今日の運勢を見る', desc: '今日の運勢のカードを開く', reward: 1 },
  { id: 'diagnose', title: '占いを1つする', desc: 'どの占い師の診断でも1回', reward: 1 },
  { id: 'gift', title: 'ちょっとした挨拶をする', desc: '占い師に1回挨拶を渡す', reward: 1 },
]
const ALL_BONUS = 1

/** 日本時間の今日の始まり（timestamptz） */
const JST_DAY_START = GAME_DAY_START_SQL

async function doneToday(userId: string, id: MissionDef['id'], day: string): Promise<boolean> {
  if (id === 'fortune') {
    const r = await query('SELECT 1 FROM daily_marks WHERE user_id = $1 AND day = $2 AND kind = $3', [userId, day, 'fortune_viewed'])
    return r.rows.length > 0
  }
  if (id === 'gift') {
    const r = await query(`SELECT 1 FROM stone_transactions WHERE user_id = $1 AND reason = 'character_gift' AND created_at >= ${JST_DAY_START} LIMIT 1`, [userId])
    return r.rows.length > 0
  }
  const r = await query(`SELECT 1 FROM latest_results WHERE user_id = $1 AND saved_at >= ${JST_DAY_START} LIMIT 1`, [userId])
  return r.rows.length > 0
}

async function claimedToday(userId: string, day: string): Promise<Set<string>> {
  const r = await query('SELECT mission_id FROM daily_mission_claims WHERE user_id = $1 AND day = $2', [userId, day])
  return new Set(r.rows.map((x) => x.mission_id as string))
}

async function knownBirthDate(userId: string): Promise<string | null> {
  const u = await query("SELECT to_char(birth_date, 'YYYY-MM-DD') AS d FROM users WHERE id = $1", [userId])
  if (u.rows[0]?.d) return u.rows[0].d
  // 保存がなければ、直近の診断で入力した生年月日を、使う（保存はしない）
  const r = await query("SELECT to_char(birth_date, 'YYYY-MM-DD') AS d FROM readings WHERE user_id = $1 AND birth_date IS NOT NULL ORDER BY created_at DESC LIMIT 1", [userId])
  return r.rows[0]?.d ?? null
}

async function snapshot(userId: string) {
  const day = todayInJapan()
  const birthDate = await knownBirthDate(userId)
  const fortune = birthDate ? computeDailyFortune(birthDate, day) : null
  const claimed = await claimedToday(userId, day)
  const missions = await Promise.all(
    MISSIONS.map(async (m) => ({ ...m, done: await doneToday(userId, m.id, day), claimed: claimed.has(m.id) }))
  )
  const allDone = missions.every((m) => m.claimed)
  return {
    success: true,
    day,
    birthDate,
    fortune,
    missions,
    allBonus: { reward: ALL_BONUS, ready: allDone && !claimed.has('all'), claimed: claimed.has('all') },
    balance: await getStoneBalance(userId),
  }
}

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    res.json(await snapshot(req.user!.userId))
  } catch (error) {
    console.error('[API] daily snapshot failed:', error)
    res.status(500).json({ success: false, error: 'failed to load daily' })
  }
})

router.post('/birthdate', requireAuth, async (req: Request, res: Response) => {
  try {
    const { birthDate } = req.body
    if (!isValidPastDate(birthDate)) {
      return res.status(400).json({ success: false, error: 'INVALID_BIRTH_DATE', message: '生年月日を正しく入力してください' })
    }
    await query('UPDATE users SET birth_date = $1 WHERE id = $2', [birthDate, req.user!.userId])
    res.json(await snapshot(req.user!.userId))
  } catch (error) {
    console.error('[API] save birthdate failed:', error)
    res.status(500).json({ success: false, error: 'failed to save birthdate' })
  }
})

router.post('/fortune/view', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId
    await query('INSERT INTO daily_marks (user_id, day, kind) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [userId, todayInJapan(), 'fortune_viewed'])
    res.json(await snapshot(userId))
  } catch (error) {
    console.error('[API] mark fortune viewed failed:', error)
    res.status(500).json({ success: false, error: 'failed to mark' })
  }
})

router.post('/missions/:id/claim', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId
    const day = todayInJapan()
    const id = req.params.id
    let reward = 0
    if (id === 'all') {
      const claimed = await claimedToday(userId, day)
      if (!MISSIONS.every((m) => claimed.has(m.id))) return res.status(400).json({ success: false, error: 'NOT_READY', message: 'まだすべてのミッションを受け取っていません' })
      reward = ALL_BONUS
    } else {
      const m = MISSIONS.find((x) => x.id === id)
      if (!m) return res.status(400).json({ success: false, error: 'UNKNOWN_MISSION' })
      if (!(await doneToday(userId, m.id, day))) return res.status(400).json({ success: false, error: 'NOT_DONE', message: 'まだ達成していません' })
      reward = m.reward
    }
    // 先に「受け取った」記録を入れる（二重に押されても、石は1回だけ）
    const ins = await query('INSERT INTO daily_mission_claims (user_id, day, mission_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING mission_id', [userId, day, id])
    if (ins.rows.length === 0) return res.status(409).json({ success: false, error: 'ALREADY_CLAIMED', message: 'もう受け取っています' })
    try {
      await grantMissionReward(userId, reward)
    } catch (error) {
      // 石の付与に失敗したら、受け取りの記録を戻す（もう一度、押せるように）
      await query('DELETE FROM daily_mission_claims WHERE user_id = $1 AND day = $2 AND mission_id = $3', [userId, day, id])
      throw error
    }
    res.json(await snapshot(userId))
  } catch (error) {
    console.error('[API] claim mission failed:', error)
    res.status(500).json({ success: false, error: 'failed to claim' })
  }
})

export default router

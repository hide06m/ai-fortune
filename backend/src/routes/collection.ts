/**
 * 図鑑・実績
 *   GET /api/collection … 図鑑（性格タイプ16・恋愛タイプ16・宿曜27宿）の、出会った／まだ、の状況
 *   GET /api/achievements … 実績の一覧と、進み具合
 */

import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { query } from '../db/client.js'
import { getStats, listCollection } from '../db/collection.js'
import { LOVE_BASE_CHARACTERS } from '../fortune/loveType64.js'
import { SHUKU_LIST } from '../fortune/data/sukuyouData.js'
import { GACHA_ENABLED } from './gacha.js'
import { computeAchievements } from '../missions/achievements.js'

const router = Router()

const MBTI_CODES = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP']

router.get('/collection', requireAuth, async (req: Request, res: Response) => {
  try {
    // 自分の診断結果では、図鑑を埋めない（質問に、うそをつく動機になるため）。出会い方の仕組みは、検討中
    const entries = await listCollection(req.user!.userId)
    const by = (kind: string) => new Map(entries.filter((e) => e.kind === kind).map((e) => [e.code, e]))
    const mbti = by('mbti')
    const love = by('love')
    const sukuyou = by('sukuyou')
    res.json({
      success: true,
      gachaEnabled: GACHA_ENABLED,
      mbti: MBTI_CODES.map((code) => ({ code, collected: mbti.has(code), count: mbti.get(code)?.count ?? 0 })),
      love: Object.entries(LOVE_BASE_CHARACTERS).map(([code, c]) => ({ code, name: c.name, collected: love.has(code), count: love.get(code)?.count ?? 0 })),
      sukuyou: SHUKU_LIST.map((s) => ({ code: s.name, reading: s.reading, collected: sukuyou.has(s.name), count: sukuyou.get(s.name)?.count ?? 0 })),
    })
  } catch (error) {
    console.error('[API] collection failed:', error)
    res.status(500).json({ success: false, error: 'failed to load collection' })
  }
})

router.get('/achievements', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId
    const list = await computeAchievements(userId)
    res.json({ success: true, achievements: list })
  } catch (error) {
    console.error('[API] achievements failed:', error)
    res.status(500).json({ success: false, error: 'failed to load achievements' })
  }
})

export default router

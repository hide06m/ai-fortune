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

interface Achievement {
  id: string
  title: string
  desc: string
  progress: number
  target: number
  done: boolean
}

router.get('/achievements', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId
    const [stats, entries, chars, allDays] = await Promise.all([
      getStats(userId),
      listCollection(userId),
      query('SELECT character_id, intimacy_level, unlocked_at FROM character_intimacy WHERE user_id = $1', [userId]),
      query("SELECT COUNT(*)::int AS n FROM daily_mission_claims WHERE user_id = $1 AND mission_id = 'all'", [userId]),
    ])
    const n = (kind: string) => entries.filter((e) => e.kind === kind).length
    const diagnoses = stats['diagnoses'] ?? 0
    const unlocked = chars.rows.filter((r) => r.unlocked_at).length
    const maxed = chars.rows.filter((r) => r.character_id !== 0 && r.intimacy_level >= 10).length
    const anyMaxed = chars.rows.some((r) => r.intimacy_level >= 10) ? 1 : 0
    const make = (id: string, title: string, desc: string, progress: number, target: number): Achievement => ({
      id,
      title,
      desc,
      progress: Math.min(progress, target),
      target,
      done: progress >= target,
    })
    const list: Achievement[] = [
      make('first_diagnosis', 'はじめての占い', '占いを、はじめて受けた', diagnoses, 1),
      make('diagnoses_10', '常連さん', '占いを、10回受けた', diagnoses, 10),
      make('diagnoses_30', '森の住人', '占いを、30回受けた', diagnoses, 30),
      make('all_diviners', '五人の占い師', '5人の占い師と、出会った', unlocked, 5),
      make('friend', 'ずっと友だち', 'ひとりの占い師と、親密度が最大になった', anyMaxed, 1),
      make('all_friends', 'みんなの縁', 'ムスビ以外の4人と、親密度が最大になった', maxed, 4),
      make('palm_first', '手相を視てもらった', 'コクウに、手相を視てもらった', stats['kind:palm'] ?? 0, 1),
      make('seimei_first', '名前を数えてもらった', 'コクウに、姓名判断をしてもらった', stats['kind:seimei'] ?? 0, 1),
      make('musubi_first', '総合相談', 'ムスビに、総合相談をした', stats['kind:musubi'] ?? 0, 1),
      make('missions_1', '今日もがんばった', 'デイリーミッションを、ぜんぶ達成した日がある', allDays.rows[0].n, 1),
      make('missions_7', '毎日のならわし', 'デイリーミッションを、ぜんぶ達成した日が、7日ある', allDays.rows[0].n, 7),
    ]
    res.json({ success: true, achievements: list })
  } catch (error) {
    console.error('[API] achievements failed:', error)
    res.status(500).json({ success: false, error: 'failed to load achievements' })
  }
})

export default router

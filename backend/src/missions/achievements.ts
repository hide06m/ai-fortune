/**
 * 実績（ずっと残る記録。達成すると、称号が解放される）
 * 図鑑の画面の「実績」欄と、交換所の「実績で解放される称号」が、同じ一覧を使う。
 */

import { query } from '../db/client.js'
import { getStats, listCollection } from '../db/collection.js'

export interface Achievement {
  id: string
  title: string
  desc: string
  progress: number
  target: number
  done: boolean
}

export async function computeAchievements(userId: string): Promise<Achievement[]> {
  const [stats, entries, chars, allDays] = await Promise.all([
    getStats(userId),
    listCollection(userId),
    query('SELECT character_id, intimacy_level, unlocked_at FROM character_intimacy WHERE user_id = $1', [userId]),
    query("SELECT COUNT(*)::int AS n FROM daily_mission_claims WHERE user_id = $1 AND mission_id = 'all'", [userId]),
  ])
  void entries
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
  return [
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
}

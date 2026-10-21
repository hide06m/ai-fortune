/**
 * ミッションの定義（デイリーの候補・長期ミッション）
 * - デイリー：「今日の運勢を見る」は、いつも固定。ほかは、候補から、毎日、ランダムに2つ（人ごと・日ごとに決まる。同じ日は、同じ内容）
 * - 長期：一度だけ受け取れる。報酬は、基本、石。手間のかかるものは、石に「かけら」を足す
 * 進み具合は、いまあるデータ（診断の保存・石の記録・縁帳など）から、数える。
 */

import crypto from 'node:crypto'
import { query } from '../db/client.js'
import { GAME_DAY_START_SQL } from '../time/gameDay.js'
import { getLoginStreak } from '../db/stones.js'

const DAY_START = GAME_DAY_START_SQL

export interface DailyDef {
  id: string
  title: string
  desc: string
  reward: number
  /** 今日、達成しているか */
  done: (userId: string, day: string) => Promise<boolean>
}

const exists = async (sql: string, userId: string): Promise<boolean> => (await query(sql, [userId])).rows.length > 0
const latestToday = (kinds: string[]) => (userId: string) =>
  exists(`SELECT 1 FROM latest_results WHERE user_id = $1 AND saved_at >= ${DAY_START} AND kind IN (${kinds.map((k) => `'${k}'`).join(',')}) LIMIT 1`, userId)

/** いつも出る（固定）ミッション：今日の運勢 */
export const DAILY_FIXED: DailyDef = {
  id: 'fortune',
  title: '今日の運勢を見る',
  desc: '今日の運勢のカードを開く',
  reward: 1,
  done: async (userId, day) => (await query('SELECT 1 FROM daily_marks WHERE user_id = $1 AND day = $2 AND kind = $3', [userId, day, 'fortune_viewed'])).rows.length > 0,
}

/** 毎日、ここから、2つが選ばれる */
export const DAILY_POOL: DailyDef[] = [
  { id: 'diagnose', title: '占いを1つする', desc: 'どの占い師の診断でも1回', reward: 1, done: (u) => exists(`SELECT 1 FROM latest_results WHERE user_id = $1 AND saved_at >= ${DAY_START} LIMIT 1`, u) },
  { id: 'gift', title: 'ちょっとした挨拶をする', desc: '占い師に1回挨拶を渡す', reward: 1, done: (u) => exists(`SELECT 1 FROM stone_transactions WHERE user_id = $1 AND reason = 'character_gift' AND created_at >= ${DAY_START} LIMIT 1`, u) },
  { id: 'personality', title: '性格か恋愛のタイプを調べる', desc: '性格タイプ診断か恋愛タイプ診断を1回', reward: 1, done: latestToday(['mbti', 'love64']) },
  { id: 'stars', title: '星の占いをする', desc: '西洋占星術か宿曜占星術を1回', reward: 1, done: latestToday(['fortune:2', 'sukuyou']) },
  { id: 'hand', title: '手相か名前を視てもらう', desc: '手相か姓名判断を1回', reward: 1, done: latestToday(['palm', 'seimei']) },
  { id: 'person', title: '縁帳にひとり加える', desc: '縁帳に新しくひとり登録する', reward: 1, done: (u) => exists(`SELECT 1 FROM people WHERE user_id = $1 AND created_at >= ${DAY_START} LIMIT 1`, u) },
  { id: 'shop', title: '交換所でなにかと交換する', desc: '交換所で1つ手に入れる', reward: 1, done: (u) => exists(`SELECT 1 FROM stone_transactions WHERE user_id = $1 AND reason = 'shop' AND created_at >= ${DAY_START} LIMIT 1`, u) },
]

/** 人ごと・日ごとに、同じ結果になる、ランダムな選び方（ハッシュで順位を決める） */
export function pickDaily(userId: string, day: string, count = 2): DailyDef[] {
  const ranked = DAILY_POOL.map((m) => ({ m, h: crypto.createHash('sha256').update(`${userId}:${day}:${m.id}`).digest('hex') })).sort((a, b) => (a.h < b.h ? -1 : 1))
  return ranked.slice(0, count).map((x) => x.m)
}

export function todaysDaily(userId: string, day: string): DailyDef[] {
  return [DAILY_FIXED, ...pickDaily(userId, day)]
}

// ───── 長期ミッション ─────
export interface LongDef {
  id: string
  title: string
  desc: string
  target: number
  reward: { stones: number; shards?: number }
  progress: (userId: string) => Promise<number>
}

const count = async (sql: string, userId: string): Promise<number> => Number((await query(sql, [userId])).rows[0]?.n ?? 0)

export const LONG_MISSIONS: LongDef[] = [
  { id: 'login_7', title: '7日ログインする', desc: 'ログインした日が合計で7日', target: 7, reward: { stones: 2 }, progress: (u) => count('SELECT COUNT(*)::int AS n FROM login_days WHERE user_id = $1', u) },
  { id: 'login_30', title: '30日ログインする', desc: 'ログインした日が合計で30日', target: 30, reward: { stones: 5, shards: 2 }, progress: (u) => count('SELECT COUNT(*)::int AS n FROM login_days WHERE user_id = $1', u) },
  {
    id: 'streak_7',
    title: '7日つづけて来る',
    desc: '7日連続でログインする',
    target: 7,
    reward: { stones: 3, shards: 1 },
    progress: async (u) => {
      const done = await count('SELECT COUNT(*)::int AS n FROM login_streak_rewards WHERE user_id = $1 AND milestone >= 7', u)
      if (done > 0) return 7
      return Math.min(7, (await getLoginStreak(u)).streak)
    },
  },
  { id: 'kinds_5', title: '5種類の占いを受ける', desc: 'ちがう種類の占いを5つ', target: 5, reward: { stones: 4, shards: 3 }, progress: (u) => count('SELECT COUNT(DISTINCT kind)::int AS n FROM latest_results WHERE user_id = $1', u) },
  { id: 'people_3', title: '縁帳に3人加える', desc: '縁帳に3人登録する', target: 3, reward: { stones: 2 }, progress: (u) => count('SELECT COUNT(*)::int AS n FROM people WHERE user_id = $1', u) },
  { id: 'people_10', title: '縁帳に10人加える', desc: '縁帳に10人登録する', target: 10, reward: { stones: 4, shards: 2 }, progress: (u) => count('SELECT COUNT(*)::int AS n FROM people WHERE user_id = $1', u) },
  { id: 'minigame_5', title: 'ミニゲームを5回クリアする', desc: '診断を待つ間のミニゲームで石をもらえた回数', target: 5, reward: { stones: 3 }, progress: (u) => count('SELECT COUNT(*)::int AS n FROM minigame_rewards WHERE user_id = $1', u) },
  { id: 'shop_3', title: '交換所で3つ交換する', desc: '交換所で手に入れたものの数', target: 3, reward: { stones: 2 }, progress: (u) => count("SELECT COUNT(*)::int AS n FROM stone_transactions WHERE user_id = $1 AND reason = 'shop'", u) },
]

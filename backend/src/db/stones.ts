/**
 * 「ルーンストーン」（診断に使う無料の仮想通貨）関連のデータベース操作
 *
 * 通貨名の設計メモ:
 * - ルーンストーン: 無料通貨。ログインボーナス・広告視聴などで貯まる（本ファイル）
 * - アイリスクォーツ: 課金通貨（未実装）。実装時は本ファイルと同じ設計
 *   （users側にカラム追加 + 専用の取引履歴テーブル）を踏襲すること
 *
 * コード上の変数名・テーブル名・エンドポイント名は汎用的に stone のままにしている
 * （呼び名の変更だけでDB移行やAPI互換性を壊さないため）。ユーザーに見せる文言だけ
 * 「ルーンストーン」を使うこと。
 */

import { v4 as uuidv4 } from 'uuid'
import { query, getPool } from './client.js'
import { GAME_DAY_START_SQL, GAME_DAY_DATE_SQL } from '../time/gameDay.js'
import { createMessage } from './inbox.js'

export type StoneReason =
  | 'login_bonus'
  | 'ad_watch'
  | 'diagnosis'
  | 'diagnosis_refund'
  | 'signup_bonus'
  | 'character_gift'
  | 'mission_reward'
  | 'minigame_reward'
  | 'inbox_reward'
  | 'shop'
  | 'gacha'
  | 'gacha_refund'
  | 'weekly_reward'

// 広告のテストモード：何回でも見られる（本物の広告をつなぐ前の動作確認用）。
// 開発環境（NODE_ENV が production 以外）では、いつも有効。本番では、環境変数 AD_TEST_MODE=true のときだけ。
// ⚠️ 本物の広告を公開するときは、本番の AD_TEST_MODE を、必ず、消すこと（石を、無限に、増やせてしまう）
export const AD_TEST_MODE = process.env.AD_TEST_MODE === 'true' || process.env.NODE_ENV !== 'production'
export const AD_WATCH_DAILY_LIMIT = AD_TEST_MODE ? 999 : 5

/**
 * 現在の石残高を取得
 */
export async function getStoneBalance(userId: string): Promise<number> {
  const result = await query('SELECT stone_balance FROM users WHERE id = $1', [userId])
  if (result.rows.length === 0) {
    throw new Error(`User not found: ${userId}`)
  }
  return result.rows[0].stone_balance
}

/**
 * 今日（日本時間）、指定した理由の取引が既に記録されているか
 */
async function hasTransactionToday(userId: string, reason: StoneReason): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM stone_transactions
     WHERE user_id = $1 AND reason = $2 AND created_at >= ${GAME_DAY_START_SQL}
     LIMIT 1`,
    [userId, reason]
  )
  return result.rows.length > 0
}

/**
 * 今日、指定した理由の取引が何回記録されているか
 */
async function countTransactionsToday(userId: string, reason: StoneReason): Promise<number> {
  const result = await query(
    `SELECT COUNT(*)::int AS count FROM stone_transactions
     WHERE user_id = $1 AND reason = $2 AND created_at >= ${GAME_DAY_START_SQL}`,
    [userId, reason]
  )
  return result.rows[0].count
}

/**
 * 石の残高を増減させ、取引履歴を記録する（呼び出し元は amount の正負を指定する）
 */
async function applyStoneChange(userId: string, amount: number, reason: StoneReason): Promise<number> {
  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const updateResult = await client.query(
      `UPDATE users SET stone_balance = stone_balance + $1, updated_at = NOW()
       WHERE id = $2 AND stone_balance + $1 >= 0
       RETURNING stone_balance`,
      [amount, userId]
    )

    if (updateResult.rows.length === 0) {
      // 残高不足（マイナスになる更新）または該当ユーザーなし
      await client.query('ROLLBACK')
      throw new Error('INSUFFICIENT_STONES')
    }

    await client.query(
      `INSERT INTO stone_transactions (id, user_id, amount, reason) VALUES ($1, $2, $3, $4)`,
      [uuidv4(), userId, amount, reason]
    )

    await client.query('COMMIT')
    return updateResult.rows[0].stone_balance
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/** 今日あと何回、広告視聴ボーナスを受け取れるか（画面で、上限に達したらボタンを押せなくするため） */
export async function getAdWatchRemaining(userId: string): Promise<number> {
  const countToday = await countTransactionsToday(userId, 'ad_watch')
  return Math.max(0, AD_WATCH_DAILY_LIMIT - countToday)
}

/**
 * ログインボーナス（1日1回、+1石）を付与
 */
export async function claimDailyLoginBonus(
  userId: string
): Promise<{ granted: boolean; balance: number }> {
  const alreadyClaimed = await hasTransactionToday(userId, 'login_bonus')
  if (alreadyClaimed) {
    return { granted: false, balance: await getStoneBalance(userId) }
  }
  const balance = await applyStoneChange(userId, 1, 'login_bonus')
  // ログインカレンダーに記録して、連続ログインのごほうび（受信箱に届く）を確かめる
  try {
    await recordLoginDay(userId)
  } catch (error) {
    console.error('[stones] recordLoginDay failed:', error)
  }
  return { granted: true, balance }
}

/** 連続ログインのごほうび：N日目に、受信箱へ、石つきのお知らせが届く */
export const STREAK_MILESTONES: Record<number, number> = { 3: 1, 7: 3, 14: 5, 30: 10 }

/** 今日をログイン日に記録し、連続日数に応じて、ごほうびを受信箱へ */
async function recordLoginDay(userId: string): Promise<void> {
  await query(`INSERT INTO login_days (user_id, day) VALUES ($1, ${GAME_DAY_DATE_SQL}) ON CONFLICT DO NOTHING`, [userId])
  const { streak, streakStart } = await getLoginStreak(userId)
  const reward = STREAK_MILESTONES[streak]
  if (!reward || !streakStart) return
  const ins = await query(
    'INSERT INTO login_streak_rewards (user_id, streak_start, milestone) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING milestone',
    [userId, streakStart, streak]
  )
  if (ins.rows.length === 0) return
  await createMessage({
    userId,
    kind: 'gift',
    title: `連続ログイン${streak}日のごほうび`,
    body: `${streak}日つづけて来てくれてありがとう。ルーンストーンを${reward}個お贈りします。`,
    stones: reward,
    expiresInDays: 30,
  })
}

/** 連続ログイン日数（今日、または、昨日までの、つながり）と、その始まりの日 */
export async function getLoginStreak(userId: string): Promise<{ streak: number; streakStart: string | null; today: string }> {
  const r = await query(
    `SELECT to_char(day, 'YYYY-MM-DD') AS d, to_char(${GAME_DAY_DATE_SQL}, 'YYYY-MM-DD') AS today FROM login_days WHERE user_id = $1 ORDER BY day DESC LIMIT 400`,
    [userId]
  )
  const today = (r.rows[0]?.today as string) ?? ''
  const days: string[] = r.rows.map((x) => x.d)
  const toNum = (d: string) => Math.round(Date.parse(d + 'T00:00:00Z') / 86400000)
  if (days.length === 0 || !today) return { streak: 0, streakStart: null, today }
  let cur = toNum(days[0])
  const t = toNum(today)
  if (t - cur > 1) return { streak: 0, streakStart: null, today } // 昨日も今日も来ていない：途切れた
  let streak = 1
  let start = days[0]
  for (let i = 1; i < days.length; i++) {
    if (toNum(days[i]) === cur - 1) {
      streak++
      cur = toNum(days[i])
      start = days[i]
    } else break
  }
  return { streak, streakStart: start, today }
}

/** 指定した月のカレンダー（ログインした日）。month は 'YYYY-MM'。省略すると、今月 */
export async function getLoginCalendar(userId: string, month?: string) {
  const { streak, today } = await getLoginStreak(userId)
  const ym = month && /^\d{4}-\d{2}$/.test(month) ? month : (today || '').slice(0, 7)
  const r = await query(
    `SELECT to_char(day, 'YYYY-MM-DD') AS d FROM login_days WHERE user_id = $1 AND to_char(day, 'YYYY-MM') = $2 ORDER BY day`,
    [userId, ym]
  )
  const next = Object.keys(STREAK_MILESTONES).map(Number).sort((a, c) => a - c).find((m) => m > streak) ?? null
  return {
    month: ym,
    today,
    days: r.rows.map((x) => x.d as string),
    streak,
    nextMilestone: next ? { day: next, stones: STREAK_MILESTONES[next] } : null,
    milestones: Object.entries(STREAK_MILESTONES).map(([day, stones]) => ({ day: Number(day), stones })),
  }
}

/**
 * 広告視聴ボーナス（1日 AD_WATCH_DAILY_LIMIT 回まで、+1石）
 *
 * ⚠️ 現時点では広告ネットワーク（AdMob等）と未接続のプレースホルダー実装。
 * フロントから叩けば誰でも成功してしまうため、1日の回数上限で被害を限定しているが、
 * 実際の広告SDKを接続する際は、広告ネットワークのサーバーサイド検証（SSV）を
 * 必ず組み込むこと（でなければ広告を見ずに連打で石を稼げてしまう）。
 */
export async function claimAdWatchBonus(
  userId: string
): Promise<{ granted: boolean; balance: number; reason?: string }> {
  const countToday = await countTransactionsToday(userId, 'ad_watch')
  if (countToday >= AD_WATCH_DAILY_LIMIT) {
    return { granted: false, balance: await getStoneBalance(userId), reason: 'DAILY_LIMIT_REACHED' }
  }
  // 広告を見て、すぐ、また受け取る連打を、止める（ウェブの広告は、広告会社からの確認がないため、間隔でも守る）
  if (!AD_TEST_MODE) {
    const last = await query(`SELECT 1 FROM stone_transactions WHERE user_id = $1 AND reason = 'ad_watch' AND created_at > NOW() - INTERVAL '20 seconds' LIMIT 1`, [userId])
    if (last.rows.length > 0) return { granted: false, balance: await getStoneBalance(userId), reason: 'TOO_FAST' }
  }
  const balance = await applyStoneChange(userId, 1, 'ad_watch')
  return { granted: true, balance }
}

/**
 * 診断1回分の石を消費する（キャラごとに必要数が異なるため amount を呼び出し元が指定する。
 * 未指定時は1個＝従来のナツメ相当・相性診断など特定キャラを持たない診断のデフォルト）。
 * 残高不足なら例外 INSUFFICIENT_STONES を投げる。
 */
export async function spendStoneForDiagnosis(userId: string, amount: number = 1): Promise<number> {
  return applyStoneChange(userId, -amount, 'diagnosis')
}

/**
 * 診断が失敗した場合、消費した石を払い戻す（spendStoneForDiagnosisに渡したamountと同じ値を渡すこと）
 */
export async function refundStoneForDiagnosis(userId: string, amount: number = 1): Promise<number> {
  return applyStoneChange(userId, amount, 'diagnosis_refund')
}

/**
 * 「ちょっとした挨拶（ミニ贈り物）」用に石を1個消費する。残高不足なら例外 INSUFFICIENT_STONES を投げる。
 */
export async function spendStoneForGift(userId: string): Promise<number> {
  return applyStoneChange(userId, -1, 'character_gift')
}

/**
 * 新規登録ボーナス（初回のみ、+3石。初回診断のハードルを下げる）
 */
export const SIGNUP_BONUS_STONES = 3

export async function grantSignupBonus(userId: string): Promise<number> {
  return applyStoneChange(userId, SIGNUP_BONUS_STONES, 'signup_bonus')
}

/**
 * デイリーミッションの報酬（石）を付与する
 */
export async function grantMissionReward(userId: string, amount: number): Promise<number> {
  return applyStoneChange(userId, amount, 'mission_reward')
}

/** 石を使う（足りないときは INSUFFICIENT_STONES を投げる） */
export async function spendStones(userId: string, amount: number, reason: StoneReason): Promise<number> {
  return applyStoneChange(userId, -Math.abs(amount), reason)
}

/** 石を渡す */
export async function grantStones(userId: string, amount: number, reason: StoneReason): Promise<number> {
  return applyStoneChange(userId, Math.abs(amount), reason)
}

/**
 * 受信箱の、石つきのお知らせを、受け取ったときの付与
 */
export async function grantInboxReward(userId: string, amount: number): Promise<number> {
  return applyStoneChange(userId, amount, 'inbox_reward')
}

/**
 * ミニゲームの報酬（石）を付与する（履歴で、ミッションと区別できるよう、別の理由で記録）
 */
export async function grantMinigameReward(userId: string, amount: number): Promise<number> {
  return applyStoneChange(userId, amount, 'minigame_reward')
}

/**
 * 石の管理画面用のまとめ：残高・今日の受け取り状況（ログインボーナス・広告・ミニゲーム）・最近の増減
 */
export async function getStoneSummary(userId: string) {
  const balance = await getStoneBalance(userId)
  const loginBonusClaimed = await hasTransactionToday(userId, 'login_bonus')
  const adRemaining = await getAdWatchRemaining(userId)
  const mg = await query(
    `SELECT COALESCE(SUM(stones), 0)::int AS stones FROM minigame_rewards WHERE user_id = $1 AND day = ${GAME_DAY_DATE_SQL}`,
    [userId]
  )
  const hist = await query(
    `SELECT amount, reason, created_at FROM stone_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [userId]
  )
  return {
    balance,
    loginBonusClaimed,
    adRemaining,
    adLimit: AD_WATCH_DAILY_LIMIT,
    adTestMode: AD_TEST_MODE,
    minigameStonesToday: mg.rows[0].stones as number,
    history: hist.rows.map((r) => ({ amount: r.amount as number, reason: r.reason as string, createdAt: new Date(r.created_at).toISOString() })),
  }
}

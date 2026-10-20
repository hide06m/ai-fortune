/**
 * 「一日一回」系（ログインボーナス・広告・デイリーミッション・今日の運勢・ミニゲームの報酬の上限）の、日の切り替え。
 * 日本時間の、朝4時で、切り替える（夜ふかしの人が、日付をまたいだ直後に、もう一度もらえてしまわないように）。
 */

export const DAY_START_HOUR = 4

/** SQL：いまの「ゲームの日」の始まり（timestamptz）。例：日本時間の朝4時 */
export const GAME_DAY_START_SQL = `((date_trunc('day', (NOW() AT TIME ZONE 'Asia/Tokyo') - INTERVAL '${DAY_START_HOUR} hours') + INTERVAL '${DAY_START_HOUR} hours') AT TIME ZONE 'Asia/Tokyo')`

/** SQL：いまの「ゲームの日」の日付（DATE） */
export const GAME_DAY_DATE_SQL = `((NOW() AT TIME ZONE 'Asia/Tokyo') - INTERVAL '${DAY_START_HOUR} hours')::date`

/** いまの「ゲームの日」（YYYY-MM-DD。日本時間の朝4時に、切り替わる） */
export function gameDayJapan(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3600 * 1000 - DAY_START_HOUR * 3600 * 1000).toISOString().slice(0, 10)
}

/** SQL：今週（月曜の朝4時はじまり）の始まり（timestamptz）。ウィークリーミッション用 */
export const GAME_WEEK_START_SQL = `((date_trunc('week', (NOW() AT TIME ZONE 'Asia/Tokyo') - INTERVAL '${DAY_START_HOUR} hours') + INTERVAL '${DAY_START_HOUR} hours') AT TIME ZONE 'Asia/Tokyo')`

/** SQL：今週の、月曜の日付（DATE）。受け取りの記録の、週の目印 */
export const GAME_WEEK_DATE_SQL = `date_trunc('week', (NOW() AT TIME ZONE 'Asia/Tokyo') - INTERVAL '${DAY_START_HOUR} hours')::date`

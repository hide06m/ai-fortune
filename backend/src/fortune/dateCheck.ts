/** 生年月日（YYYY-MM-DD）が、実在する日付で、1900年以降、かつ今日より前（未来でない）かを調べる */
export function isValidPastDate(value: unknown, now: Date = new Date()): boolean {
  if (typeof value !== 'string') return false
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return false
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (y < 1900) return false
  const t = new Date(Date.UTC(y, mo - 1, d))
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return false
  // 日本時間の今日（UTC+9）と比べる
  const jstToday = new Date(now.getTime() + 9 * 3600 * 1000)
  const today = Date.UTC(jstToday.getUTCFullYear(), jstToday.getUTCMonth(), jstToday.getUTCDate())
  return t.getTime() <= today
}

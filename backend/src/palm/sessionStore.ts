/**
 * 手相診断のPC↔スマホ連携用・一時セッションストア
 *
 * 設計方針：手のひらの写真は個人の身体が写る画像のため、診断に使ったら即破棄する。
 * 恒久的なテーブル・オブジェクトストレージは持たず、プロセスメモリ上の短命なMapで管理する
 * （サーバーが複数台に水平スケールする場合はRedis等の共有ストアに置き換える必要があるが、
 * 現状の単一インスタンス運用では問題ない）
 */

import crypto from 'crypto'

export type PalmSessionStatus = 'pending' | 'uploaded' | 'consumed'

interface PalmSession {
  token: string
  status: PalmSessionStatus
  imageBase64: string | null
  mimeType: string | null
  /** 撮影側が検出できた線（未検証。使う前に sanitizeDetectedLines で検証する） */
  lines: unknown
  createdAt: number
  expiresAt: number
}

const SESSION_TTL_MS = 10 * 60 * 1000 // 10分

const sessions = new Map<string, PalmSession>()

function isExpired(session: PalmSession): boolean {
  return Date.now() > session.expiresAt
}

/** 期限切れセッションを掃除する（アクセスのたびに軽く走らせる） */
function sweepExpired(): void {
  for (const [token, session] of sessions) {
    if (isExpired(session)) {
      sessions.delete(token)
    }
  }
}

export function createPalmSession(): { token: string; expiresAt: number } {
  sweepExpired()
  const token = crypto.randomBytes(24).toString('base64url')
  const now = Date.now()
  const session: PalmSession = {
    token,
    status: 'pending',
    imageBase64: null,
    mimeType: null,
    lines: null,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  }
  sessions.set(token, session)
  return { token, expiresAt: session.expiresAt }
}

export function getPalmSessionStatus(token: string): PalmSessionStatus | null {
  const session = sessions.get(token)
  if (!session || isExpired(session)) return null
  return session.status
}

/** スマホ側から撮影画像をアップロードする */
export function setPalmSessionImage(
  token: string,
  imageBase64: string,
  mimeType: string,
  extras?: { lines?: unknown }
): boolean {
  const session = sessions.get(token)
  if (!session || isExpired(session)) return false
  session.imageBase64 = imageBase64
  session.mimeType = mimeType
  session.lines = extras?.lines ?? null
  session.status = 'uploaded'
  return true
}

/** PC側が診断のために画像を取得する。取得後はセッションを消費済みにして画像データを破棄する */
export function consumePalmSessionImage(
  token: string
): { imageBase64: string; mimeType: string; lines: unknown } | null {
  const session = sessions.get(token)
  if (!session || isExpired(session) || session.status !== 'uploaded' || !session.imageBase64 || !session.mimeType) {
    return null
  }
  const result = {
    imageBase64: session.imageBase64,
    mimeType: session.mimeType,
    lines: session.lines,
  }
  session.status = 'consumed'
  session.imageBase64 = null
  session.mimeType = null
  session.lines = null
  return result
}

/**
 * 手相診断のPC↔スマホ連携用・一時セッションストア
 *
 * 設計方針：手のひらの写真は個人の身体が写る画像のため、診断に使ったら即破棄する。
 * Cloudflare Workers では、リクエストごとに別のサーバーが動くため、メモリではなく DB の一時テーブル（palm_sessions）に置く。
 * 写真は、アップロードから最長10分（期限切れ）、または診断の完了・撮り直しまでだけ保存し、その後は必ず消す。
 */

import crypto from 'crypto'
import { query } from '../db/client.js'

export type PalmSessionStatus = 'pending' | 'uploaded' | 'consumed'

const SESSION_TTL_MS = 10 * 60 * 1000 // 10分

interface Row {
  status: PalmSessionStatus
  image_base64: string | null
  mime_type: string | null
  lines: unknown
  retake_message: string | null
}

/** 期限切れセッション（写真を含む）を、すべて消す。アクセスのたびに軽く走らせる */
async function sweepExpired(): Promise<void> {
  await query('DELETE FROM palm_sessions WHERE expires_at < NOW()').catch(() => undefined)
}

async function getLive(token: string): Promise<Row | null> {
  const r = await query('SELECT status, image_base64, mime_type, lines, retake_message FROM palm_sessions WHERE token = $1 AND expires_at >= NOW()', [token])
  return (r.rows[0] as Row | undefined) ?? null
}

export async function createPalmSession(): Promise<{ token: string; expiresAt: number }> {
  await sweepExpired()
  const token = crypto.randomBytes(24).toString('base64url')
  const expiresAt = Date.now() + SESSION_TTL_MS
  await query('INSERT INTO palm_sessions (token, status, expires_at) VALUES ($1, $2, $3)', [token, 'pending', new Date(expiresAt)])
  return { token, expiresAt }
}

export async function getPalmSessionStatus(token: string): Promise<{ status: PalmSessionStatus; retakeMessage: string | null } | null> {
  const s = await getLive(token)
  return s ? { status: s.status, retakeMessage: s.retake_message } : null
}

/** PC側が解析のために画像を見る（消費しない） */
export async function peekPalmSessionImage(token: string): Promise<{ imageBase64: string; mimeType: string } | null> {
  const s = await getLive(token)
  if (!s || s.status !== 'uploaded' || !s.image_base64 || !s.mime_type) return null
  return { imageBase64: s.image_base64, mimeType: s.mime_type }
}

/** PC側の解析で撮り直しになった：画像を破棄して待機に戻し、理由をスマホへ伝える */
export async function requestPalmRetake(token: string, message: string): Promise<boolean> {
  const r = await query(
    "UPDATE palm_sessions SET status = 'pending', image_base64 = NULL, mime_type = NULL, lines = NULL, retake_message = $2 WHERE token = $1 AND expires_at >= NOW()",
    [token, message]
  )
  return (r.rowCount ?? 0) > 0
}

/** スマホ側から撮影画像をアップロードする */
export async function setPalmSessionImage(token: string, imageBase64: string, mimeType: string, extras?: { lines?: unknown }): Promise<boolean> {
  const r = await query(
    "UPDATE palm_sessions SET status = 'uploaded', image_base64 = $2, mime_type = $3, lines = $4, retake_message = NULL WHERE token = $1 AND expires_at >= NOW()",
    [token, imageBase64, mimeType, JSON.stringify(extras?.lines ?? null)]
  )
  return (r.rowCount ?? 0) > 0
}

/** 診断のために、画像と線を見る（消費しない）。AIの生成に失敗しても、同じ写真で、もう一度診断できるようにするため */
export async function peekPalmSession(token: string): Promise<{ imageBase64: string; mimeType: string; lines: unknown } | null> {
  const s = await getLive(token)
  if (!s || s.status !== 'uploaded' || !s.image_base64 || !s.mime_type) return null
  return { imageBase64: s.image_base64, mimeType: s.mime_type, lines: s.lines }
}

/** 診断が終わったら、セッションを消費済みにして、画像データを破棄する */
export async function consumePalmSessionImage(token: string): Promise<{ imageBase64: string; mimeType: string; lines: unknown } | null> {
  const s = await getLive(token)
  if (!s || s.status !== 'uploaded' || !s.image_base64 || !s.mime_type) return null
  await query("UPDATE palm_sessions SET status = 'consumed', image_base64 = NULL, mime_type = NULL, lines = NULL WHERE token = $1", [token])
  return { imageBase64: s.image_base64, mimeType: s.mime_type, lines: s.lines }
}

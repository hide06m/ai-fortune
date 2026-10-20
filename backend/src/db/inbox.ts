/**
 * 受信箱（運営からのお知らせ・お詫びの石の配布）
 * - user_id が NULL のメッセージは、全員向け。石つきの全員向けは、配布した時点で、すでにいた人だけが、受け取れる
 * - 受け取りは、1通につき、1人1回（inbox_states の主キー）
 */

import { v4 as uuidv4 } from 'uuid'
import { query } from './client.js'
import { grantInboxReward } from './stones.js'

export type InboxKind = 'notice' | 'maintenance' | 'update' | 'event' | 'apology' | 'gift' | 'welcome'
export const INBOX_KINDS: InboxKind[] = ['notice', 'maintenance', 'update', 'event', 'apology', 'gift', 'welcome']

export interface InboxItem {
  id: string
  kind: string
  title: string
  body: string
  stones: number
  showOnHome: boolean
  createdAt: string
  expiresAt: string | null
  read: boolean
  claimed: boolean
}

/** このユーザーが見られるメッセージ（期限内） */
const VISIBLE_SQL = `
  FROM inbox_messages m
  JOIN users u ON u.id = $1
  LEFT JOIN inbox_states s ON s.message_id = m.id AND s.user_id = $1
  WHERE (m.user_id = $1 OR (m.user_id IS NULL AND (m.reward_stones = 0 OR m.created_at >= u.created_at)))
    AND (m.expires_at IS NULL OR m.expires_at > NOW())
`

export async function listInbox(userId: string): Promise<InboxItem[]> {
  const r = await query(
    `SELECT m.id, m.kind, m.title, m.body, m.reward_stones, m.show_on_home, m.created_at, m.expires_at,
            (s.read_at IS NOT NULL) AS read, (s.claimed_at IS NOT NULL) AS claimed
     ${VISIBLE_SQL}
     ORDER BY m.created_at DESC LIMIT 100`,
    [userId]
  )
  return r.rows.map((x) => ({
    id: x.id,
    kind: x.kind,
    title: x.title,
    body: x.body,
    stones: x.reward_stones,
    showOnHome: x.show_on_home,
    createdAt: new Date(x.created_at).toISOString(),
    expiresAt: x.expires_at ? new Date(x.expires_at).toISOString() : null,
    read: x.read,
    claimed: x.claimed,
  }))
}

async function isVisible(userId: string, messageId: string): Promise<{ stones: number; claimed: boolean } | null> {
  const r = await query(`SELECT m.reward_stones, (s.claimed_at IS NOT NULL) AS claimed ${VISIBLE_SQL} AND m.id = $2`, [userId, messageId])
  return r.rows.length ? { stones: r.rows[0].reward_stones, claimed: r.rows[0].claimed } : null
}

export async function markRead(userId: string, messageId: string): Promise<boolean> {
  if (!(await isVisible(userId, messageId))) return false
  await query(
    `INSERT INTO inbox_states (user_id, message_id, read_at) VALUES ($1, $2, NOW())
     ON CONFLICT (user_id, message_id) DO UPDATE SET read_at = COALESCE(inbox_states.read_at, NOW())`,
    [userId, messageId]
  )
  return true
}

/** 石を受け取る。先に、記録を入れて（1回だけ）、入れられたときだけ、石を渡す */
export async function claimMessage(userId: string, messageId: string): Promise<{ granted: number; balance?: number; reason?: string }> {
  const v = await isVisible(userId, messageId)
  if (!v) return { granted: 0, reason: 'not_found' }
  if (v.stones <= 0) return { granted: 0, reason: 'no_reward' }
  const ins = await query(
    `INSERT INTO inbox_states (user_id, message_id, read_at, claimed_at) VALUES ($1, $2, NOW(), NOW())
     ON CONFLICT (user_id, message_id) DO UPDATE SET read_at = COALESCE(inbox_states.read_at, NOW()), claimed_at = NOW()
       WHERE inbox_states.claimed_at IS NULL
     RETURNING message_id`,
    [userId, messageId]
  )
  if (ins.rows.length === 0) return { granted: 0, reason: 'already' }
  const balance = await grantInboxReward(userId, v.stones)
  return { granted: v.stones, balance }
}

export async function claimAll(userId: string): Promise<{ granted: number; balance?: number }> {
  const items = await listInbox(userId)
  let total = 0
  let balance: number | undefined
  for (const it of items) {
    if (it.stones > 0 && !it.claimed) {
      const r = await claimMessage(userId, it.id)
      total += r.granted
      if (r.balance !== undefined) balance = r.balance
    }
  }
  return { granted: total, balance }
}

/** 運営からの送信：userId を省略すると、全員向け */
export async function createMessage(input: {
  userId?: string | null
  kind?: InboxKind
  title: string
  body: string
  stones?: number
  showOnHome?: boolean
  expiresInDays?: number | null
}): Promise<string> {
  const id = uuidv4()
  const days = input.expiresInDays && input.expiresInDays > 0 ? Math.floor(input.expiresInDays) : null
  await query(
    `INSERT INTO inbox_messages (id, user_id, kind, title, body, reward_stones, show_on_home, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $8::int IS NULL THEN NULL ELSE NOW() + ($8::int * INTERVAL '1 day') END)`,
    [id, input.userId ?? null, input.kind ?? 'notice', input.title.slice(0, 80), input.body, Math.max(0, Math.floor(input.stones ?? 0)), !!input.showOnHome, days]
  )
  return id
}

export async function deleteMessage(id: string): Promise<boolean> {
  const r = await query('DELETE FROM inbox_messages WHERE id = $1', [id])
  return (r.rowCount ?? 0) > 0
}

/** 運営用：最近の全員向けメッセージ */
export async function listBroadcasts(): Promise<{ id: string; kind: string; title: string; stones: number; createdAt: string }[]> {
  const r = await query('SELECT id, kind, title, reward_stones, created_at FROM inbox_messages WHERE user_id IS NULL ORDER BY created_at DESC LIMIT 50')
  return r.rows.map((x) => ({ id: x.id, kind: x.kind, title: x.title, stones: x.reward_stones, createdAt: new Date(x.created_at).toISOString() }))
}

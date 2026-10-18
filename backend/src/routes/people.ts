/**
 * 縁帳（周りの人の記録）。本人だけが見られる。共有・公開・ランキング・外部AIへの送信は、しない
 * 「縁むすび」方式：相手本人が、招待リンクから答える（代理回答は、しない）
 *   GET    /api/people            一覧（状態：招待中／回答済み）と、人数・上限
 *   POST   /api/people            人を追加して、招待リンクを発行
 *   DELETE /api/people            すべて削除
 *   GET    /api/people/links      同じタイプの人どうし
 *   GET    /api/people/:id        1人の詳細（自分との共通点・違いつき）
 *   POST   /api/people/:id/invite 招待リンクの再発行（未回答のみ）
 *   DELETE /api/people/:id        1人を削除
 * 招待された本人（ログイン不要）：
 *   GET    /api/invite/:token             招待の確認（誰から・何が共有されるか）
 *   POST   /api/invite/:token/answer      同意のうえ、回答（18問、または、知っているタイプを選ぶ）
 *   POST   /api/invite/revoke/:revokeToken 自分の回答を、取り消す
 */

import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { requireAuth } from '../middleware/auth.js'
import { query } from '../db/client.js'
import rateLimit from 'express-rate-limit'
import { getLatestLoveType64Result } from '../db/readings.js'
import { calculateLoveType64, isValidLoveType64Code, buildLoveType64ResultFromType, LOVE_BASE_CHARACTERS, LOVE_SUB_TYPES, type LoveAnswer } from '../fortune/loveType64.js'
import { compareLoveTypes, knownAxes, AXIS_ORDER } from '../fortune/peopleCompare.js'

const router = Router()

export const PEOPLE_LIMIT = 50
const RELATIONS = ['family', 'friend', 'lover', 'work', 'other'] as const
const INVITE_DAYS = 14
const DAILY_INVITE_LIMIT = 20
const ACTIVE_INVITE_LIMIT = 20 // 有効な（未回答・期限内の）招待の数の上限
const newToken = () => crypto.randomBytes(16).toString('base64url') // 128bit

/** 連絡先・住所などを書かせないための、かんたんな検査（電話番号・メール・URL の形） */
function looksLikeContact(text: string): boolean {
  return /@|https?:\/\/|www\.|\d{2,4}[-\s]?\d{2,4}[-\s]?\d{3,4}/.test(text)
}

function isValidId(id: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(id)
}

interface PersonRow {
  id: string
  name: string
  relation: string
  memo: string
  created_at: string
  type_code: string | null
  confidence: string | null
  invite_token: string | null
  invite_expires: string | null
}

function summarize(row: PersonRow) {
  let result = null
  if (row.type_code) {
    const [type1, type2] = row.type_code.split('-')
    result = {
      fullType: row.type_code,
      type1,
      type2,
      characterName: LOVE_BASE_CHARACTERS[type1]?.name ?? type1,
      subTypeName: LOVE_SUB_TYPES[type2]?.name ?? type2,
      confidence: row.confidence,
    }
  }
  const inviteActive = !result && !!row.invite_token && !!row.invite_expires && new Date(row.invite_expires) > new Date()
  return {
    id: row.id,
    name: row.name,
    relation: row.relation,
    memo: row.memo,
    createdAt: row.created_at,
    status: result ? 'answered' : inviteActive ? 'pending' : 'expired',
    inviteToken: inviteActive ? row.invite_token : null,
    result,
  }
}

const SELECT_PEOPLE = `
  SELECT p.id, p.name, p.relation, p.memo, p.created_at, p.invite_token, p.invite_expires, r.type_code, r.confidence
  FROM people p LEFT JOIN person_results r ON r.person_id = p.id AND r.kind = 'love'`

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const r = await query(`${SELECT_PEOPLE} WHERE p.user_id = $1 ORDER BY p.created_at DESC`, [req.user!.userId])
    res.json({ success: true, limit: PEOPLE_LIMIT, people: r.rows.map(summarize) })
  } catch (error) {
    console.error('[API] people list failed:', error)
    res.status(500).json({ success: false, error: 'failed to load people' })
  }
})

router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''
    const memo = typeof req.body.memo === 'string' ? req.body.memo.trim() : ''
    const relation = req.body.relation
    const fromName = typeof req.body.fromName === 'string' ? req.body.fromName.trim() : ''
    if (!fromName || fromName.length > 30) return res.status(400).json({ success: false, error: '相手に見える、あなたの呼び名を、1〜30文字で入力してください' })
    if (!name || name.length > 30) return res.status(400).json({ success: false, error: '名前（ニックネーム）は、1〜30文字で入力してください' })
    if (memo.length > 100) return res.status(400).json({ success: false, error: 'メモは、100文字までです' })
    if (!RELATIONS.includes(relation)) return res.status(400).json({ success: false, error: '関係を選んでください' })
    if (looksLikeContact(name) || looksLikeContact(memo) || looksLikeContact(fromName)) {
      return res.status(400).json({ success: false, error: '電話番号・メールアドレス・URLのような情報は、書かないでください' })
    }
    const count = await query('SELECT COUNT(*)::int AS n FROM people WHERE user_id = $1', [userId])
    if (count.rows[0].n >= PEOPLE_LIMIT) {
      return res.status(400).json({ success: false, error: `登録できるのは、${PEOPLE_LIMIT}人までです` })
    }
    // 招待の大量発行（スパム）を防ぐ：24時間に20件まで
    const today = await query("SELECT COUNT(*)::int AS n FROM people WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'", [userId])
    if (today.rows[0].n >= DAILY_INVITE_LIMIT) {
      return res.status(429).json({ success: false, error: '招待を作れるのは、1日に20件までです' })
    }
    const active = await query('SELECT COUNT(*)::int AS n FROM people WHERE user_id = $1 AND invite_token IS NOT NULL AND invite_expires > NOW()', [userId])
    if (active.rows[0].n >= ACTIVE_INVITE_LIMIT) {
      return res.status(429).json({ success: false, error: '返事待ちの招待が、多くなっています。回答を待つか、期限が切れてから、追加してください' })
    }
    const id = crypto.randomUUID()
    const token = newToken()
    await query(
      `INSERT INTO people (id, user_id, name, relation, memo, from_name, invite_token, invite_expires)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + ($8 || ' days')::interval)`,
      [id, userId, name, relation, memo, fromName, token, String(INVITE_DAYS)]
    )
    res.json({ success: true, id, inviteToken: token })
  } catch (error) {
    console.error('[API] people add failed:', error)
    res.status(500).json({ success: false, error: 'failed to add person' })
  }
})

router.delete('/', requireAuth, async (req: Request, res: Response) => {
  try {
    await query('DELETE FROM people WHERE user_id = $1', [req.user!.userId])
    res.json({ success: true })
  } catch (error) {
    console.error('[API] people delete-all failed:', error)
    res.status(500).json({ success: false, error: 'failed to delete' })
  }
})

router.get('/links', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId
    const r = await query(`${SELECT_PEOPLE} WHERE p.user_id = $1 AND r.type_code IS NOT NULL`, [userId])
    const groups = new Map<string, string[]>()
    for (const row of r.rows as PersonRow[]) {
      const type1 = row.type_code!.split('-')[0]
      groups.set(type1, [...(groups.get(type1) ?? []), row.name])
    }
    const mine = await getLatestLoveType64Result(userId)
    const myType1 = mine?.type1 ?? null
    res.json({
      success: true,
      sameType: [...groups.entries()].filter(([, names]) => names.length >= 2).map(([type1, names]) => ({ type1, names })),
      sameAsMe: myType1 ? (groups.get(myType1) ?? []) : [],
      myType1,
    })
  } catch (error) {
    console.error('[API] people links failed:', error)
    res.status(500).json({ success: false, error: 'failed to load links' })
  }
})

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId
    if (!isValidId(req.params.id)) return res.status(404).json({ success: false, error: 'not found' })
    const r = await query(`${SELECT_PEOPLE} WHERE p.user_id = $1 AND p.id = $2`, [userId, req.params.id])
    if (r.rows.length === 0) return res.status(404).json({ success: false, error: 'not found' })
    const person = summarize(r.rows[0])
    let comparison = null
    if (person.result) {
      const mine = await getLatestLoveType64Result(userId)
      if (mine) {
        const a = await query("SELECT answers FROM person_results WHERE person_id = $1 AND kind = 'love'", [req.params.id])
        const answers = a.rows[0]?.answers as LoveAnswer[] | null
        const known = answers && answers.length ? knownAxes(answers) : AXIS_ORDER // タイプを選んだ場合は、全軸
        comparison = compareLoveTypes(mine.fullType, person.result.fullType, known)
      }
    }
    res.json({ success: true, person, comparison })
  } catch (error) {
    console.error('[API] person detail failed:', error)
    res.status(500).json({ success: false, error: 'failed to load person' })
  }
})

router.post('/:id/invite', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!isValidId(req.params.id)) return res.status(404).json({ success: false, error: 'not found' })
    const active = await query('SELECT COUNT(*)::int AS n FROM people WHERE user_id = $1 AND invite_token IS NOT NULL AND invite_expires > NOW()', [req.user!.userId])
    if (active.rows[0].n >= ACTIVE_INVITE_LIMIT) {
      return res.status(429).json({ success: false, error: '返事待ちの招待が、多くなっています' })
    }
    const token = newToken()
    const r = await query(
      `UPDATE people SET invite_token = $3, invite_expires = NOW() + ($4 || ' days')::interval
       WHERE user_id = $1 AND id = $2 AND NOT EXISTS (SELECT 1 FROM person_results WHERE person_id = people.id)
       RETURNING id`,
      [req.user!.userId, req.params.id, token, String(INVITE_DAYS)]
    )
    if (r.rows.length === 0) return res.status(404).json({ success: false, error: 'not found or already answered' })
    res.json({ success: true, inviteToken: token })
  } catch (error) {
    console.error('[API] invite reissue failed:', error)
    res.status(500).json({ success: false, error: 'failed to reissue' })
  }
})

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!isValidId(req.params.id)) return res.status(404).json({ success: false, error: 'not found' })
    await query('DELETE FROM people WHERE user_id = $1 AND id = $2', [req.user!.userId, req.params.id])
    res.json({ success: true })
  } catch (error) {
    console.error('[API] person delete failed:', error)
    res.status(500).json({ success: false, error: 'failed to delete' })
  }
})

// ───── 招待された本人（ログイン不要） ─────
export const inviteRouter = Router()

// 総当たり・連打の対策：IPごとに、10分で30回まで
inviteRouter.use(
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 30,
    keyGenerator: (req: any) => `ip:${(req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown'}`,
    standardHeaders: false,
    legacyHeaders: false,
    message: { success: false, error: 'しばらくしてから、もう一度お試しください' },
  })
)

const NOT_FOUND = { success: false, error: 'この招待は、使えません（期限切れ・回答済み、または、取り消されました）' }

function isToken(t: string): boolean {
  return /^[A-Za-z0-9_-]{22}$/.test(t)
}

async function findActiveInvite(token: string) {
  if (!isToken(token)) return null
  const r = await query(
    `SELECT p.id, p.from_name, p.relation FROM people p
     WHERE p.invite_token = $1 AND p.invite_expires > NOW()
       AND NOT EXISTS (SELECT 1 FROM person_results r WHERE r.person_id = p.id)`,
    [token]
  )
  return r.rows[0] ?? null
}

inviteRouter.get('/:token', async (req: Request, res: Response) => {
  try {
    const inv = await findActiveInvite(req.params.token)
    if (!inv) return res.status(404).json(NOT_FOUND)
    res.json({ success: true, fromName: inv.from_name, relation: inv.relation })
  } catch (error) {
    console.error('[API] invite get failed:', error)
    res.status(500).json({ success: false, error: 'failed' })
  }
})

inviteRouter.post('/revoke/:revokeToken', async (req: Request, res: Response) => {
  try {
    if (!isToken(req.params.revokeToken)) return res.status(404).json(NOT_FOUND)
    const r = await query('SELECT id FROM people WHERE revoke_token = $1', [req.params.revokeToken])
    if (r.rows.length === 0) return res.status(404).json(NOT_FOUND)
    const id = r.rows[0].id
    // 回答を消して、招待は失効のまま（Aには通知しない。Aの画面では「期限切れ」の表示になる）
    await query('DELETE FROM person_results WHERE person_id = $1', [id])
    await query('UPDATE people SET revoke_token = NULL, invite_token = NULL, invite_expires = NULL WHERE id = $1', [id])
    res.json({ success: true })
  } catch (error) {
    console.error('[API] invite revoke failed:', error)
    res.status(500).json({ success: false, error: 'failed' })
  }
})

inviteRouter.post('/:token/answer', async (req: Request, res: Response) => {
  try {
    const inv = await findActiveInvite(req.params.token)
    if (!inv) return res.status(404).json(NOT_FOUND)
    const { consent, answers, pickedType } = req.body
    if (consent !== true) return res.status(400).json({ success: false, error: '同意の確認が必要です' })

    let fullType: string
    let storedAnswers: LoveAnswer[] | null = null
    let method: 'quiz' | 'picked'
    if (typeof pickedType === 'string' && pickedType) {
      if (!isValidLoveType64Code(pickedType)) return res.status(400).json({ success: false, error: 'タイプの形式が正しくありません' })
      fullType = buildLoveType64ResultFromType(pickedType).fullType
      method = 'picked'
    } else {
      const ok =
        Array.isArray(answers) &&
        answers.length === 18 &&
        answers.every((a: any) => a && Number.isInteger(a.id) && a.id >= 1 && a.id <= 18 && Number.isInteger(a.val) && a.val >= 0 && a.val <= 5) &&
        new Set(answers.map((a: any) => a.id)).size === 18
      if (!ok) return res.status(400).json({ success: false, error: '18問すべてに、答えてください' })
      storedAnswers = answers.map((a: any) => ({ id: a.id, val: a.val }))
      fullType = calculateLoveType64(storedAnswers!).fullType
      method = 'quiz'
    }

    const revokeToken = newToken()
    // 1回限り：先に、招待トークンを使用済みにしてから、結果を保存する
    const used = await query(
      `UPDATE people SET invite_token = NULL, invite_expires = NULL, revoke_token = $2
       WHERE id = $1 AND invite_token = $3 RETURNING id`,
      [inv.id, revokeToken, req.params.token]
    )
    if (used.rows.length === 0) return res.status(404).json(NOT_FOUND)
    await query(
      `INSERT INTO person_results (person_id, kind, type_code, answers, confidence) VALUES ($1, 'love', $2, $3, $4)
       ON CONFLICT (person_id, kind) DO UPDATE SET type_code = $2, answers = $3, confidence = $4, created_at = NOW()`,
      [inv.id, fullType, storedAnswers ? JSON.stringify(storedAnswers) : null, method]
    )
    const [type1, type2] = fullType.split('-')
    res.json({
      success: true,
      revokeToken,
      result: {
        fullType,
        type1,
        characterName: LOVE_BASE_CHARACTERS[type1]?.name ?? type1,
        characterDesc: LOVE_BASE_CHARACTERS[type1]?.description ?? '',
        subTypeName: LOVE_SUB_TYPES[type2]?.name ?? type2,
        subTypeTagline: LOVE_SUB_TYPES[type2]?.tagline ?? '',
      },
    })
  } catch (error) {
    console.error('[API] invite answer failed:', error)
    res.status(500).json({ success: false, error: 'failed' })
  }
})

export default router

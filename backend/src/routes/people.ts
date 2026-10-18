/**
 * 縁帳（周りの人の記録）。本人だけが見られる。共有・公開・ランキング・外部AIへの送信は、しない
 *   GET    /api/people            一覧（診断済みのタイプつき）と、人数・上限
 *   POST   /api/people            人を追加
 *   DELETE /api/people            すべて削除
 *   GET    /api/people/links      同じタイプの人どうし
 *   GET    /api/people/:id        1人の詳細（自分との共通点・違いつき）
 *   DELETE /api/people/:id        1人を削除
 *   POST   /api/people/:id/diagnose  恋愛タイプの、代理診断（石1個。AIは使わない）
 */

import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { requireAuth } from '../middleware/auth.js'
import { query } from '../db/client.js'
import { spendStoneForDiagnosis } from '../db/stones.js'
import { getLatestLoveType64Result } from '../db/readings.js'
import { calculateLoveType64, LOVE_BASE_CHARACTERS, LOVE_SUB_TYPES, type LoveAnswer } from '../fortune/loveType64.js'
import { compareLoveTypes, knownAxes } from '../fortune/peopleCompare.js'

const router = Router()

export const PEOPLE_LIMIT = 50
const RELATIONS = ['family', 'friend', 'lover', 'work', 'other'] as const
const CONFIDENCES = ['high', 'partial', 'low'] as const
const PROXY_STONE_COST = 1

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
  return { id: row.id, name: row.name, relation: row.relation, memo: row.memo, createdAt: row.created_at, result }
}

const SELECT_PEOPLE = `
  SELECT p.id, p.name, p.relation, p.memo, p.created_at, r.type_code, r.confidence
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
    if (!name || name.length > 30) return res.status(400).json({ success: false, error: '名前（ニックネーム）は、1〜30文字で入力してください' })
    if (memo.length > 100) return res.status(400).json({ success: false, error: 'メモは、100文字までです' })
    if (!RELATIONS.includes(relation)) return res.status(400).json({ success: false, error: '関係を選んでください' })
    if (looksLikeContact(name) || looksLikeContact(memo)) {
      return res.status(400).json({ success: false, error: '電話番号・メールアドレス・URLのような情報は、書かないでください' })
    }
    const count = await query('SELECT COUNT(*)::int AS n FROM people WHERE user_id = $1', [userId])
    if (count.rows[0].n >= PEOPLE_LIMIT) {
      return res.status(400).json({ success: false, error: `登録できるのは、${PEOPLE_LIMIT}人までです` })
    }
    const id = crypto.randomUUID()
    await query('INSERT INTO people (id, user_id, name, relation, memo) VALUES ($1, $2, $3, $4, $5)', [id, userId, name, relation, memo])
    res.json({ success: true, id })
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
        const answers = (a.rows[0]?.answers ?? []) as LoveAnswer[]
        comparison = compareLoveTypes(mine.fullType, person.result.fullType, knownAxes(answers))
      }
    }
    res.json({ success: true, person, comparison })
  } catch (error) {
    console.error('[API] person detail failed:', error)
    res.status(500).json({ success: false, error: 'failed to load person' })
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

router.post('/:id/diagnose', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId
    if (!isValidId(req.params.id)) return res.status(404).json({ success: false, error: 'not found' })
    const owned = await query('SELECT 1 FROM people WHERE user_id = $1 AND id = $2', [userId, req.params.id])
    if (owned.rows.length === 0) return res.status(404).json({ success: false, error: 'not found' })

    const { answers, confidence } = req.body
    if (!CONFIDENCES.includes(confidence)) return res.status(400).json({ success: false, error: '確信度を選んでください' })
    // 「わからない」は、回答に含めない。18問のうち、答えがあるものだけを送る
    const valid =
      Array.isArray(answers) &&
      answers.length >= 1 &&
      answers.length <= 18 &&
      answers.every((a: any) => a && Number.isInteger(a.id) && a.id >= 1 && a.id <= 18 && Number.isInteger(a.val) && a.val >= 0 && a.val <= 5) &&
      new Set(answers.map((a: any) => a.id)).size === answers.length
    if (!valid) return res.status(400).json({ success: false, error: '回答の形式が正しくありません' })
    const clean: LoveAnswer[] = answers.map((a: any) => ({ id: a.id, val: a.val }))
    const known = knownAxes(clean)
    if (known.length < 3) {
      return res.status(400).json({ success: false, error: '3つ以上の軸について、答えてください（「わからない」が多すぎます）' })
    }

    let stoneBalance: number
    try {
      stoneBalance = await spendStoneForDiagnosis(userId, PROXY_STONE_COST)
    } catch (error) {
      if (error instanceof Error && error.message === 'INSUFFICIENT_STONES') {
        return res.status(402).json({ success: false, error: 'INSUFFICIENT_STONES', message: 'ルーンストーンが足りません。' })
      }
      throw error
    }
    const result = calculateLoveType64(clean)
    await query(
      `INSERT INTO person_results (person_id, kind, type_code, answers, confidence) VALUES ($1, 'love', $2, $3, $4)
       ON CONFLICT (person_id, kind) DO UPDATE SET type_code = $2, answers = $3, confidence = $4, created_at = NOW()`,
      [req.params.id, result.fullType, JSON.stringify(clean), confidence]
    )
    res.json({ success: true, stoneBalance })
  } catch (error) {
    console.error('[API] person diagnose failed:', error)
    res.status(500).json({ success: false, error: 'failed to diagnose' })
  }
})

export default router

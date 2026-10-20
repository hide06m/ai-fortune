/**
 * 出会いのガチャ：ルーンストーンで、森で、ほかの人のタイプ（性格・恋愛・宿曜）に出会う → 図鑑に入る
 *   GET  /api/gacha        … 費用・出会った数・のこり
 *   POST /api/gacha/pull   … 1回ひく（まだ出会っていないタイプが、出やすい。もう出会っていたら、石を1個返す）
 * 自分の診断結果では図鑑を埋めない（質問にうそをつく動機になるため）。出会いは、ここと、縁帳から。
 */

import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { listCollection, recordCollection, incrementStat, type CollectionKind } from '../db/collection.js'
import { getStoneBalance, spendStones, grantStones } from '../db/stones.js'
import { LOVE_BASE_CHARACTERS } from '../fortune/loveType64.js'
import { SHUKU_LIST } from '../fortune/data/sukuyouData.js'

const router = Router()

export const GACHA_COST = 3
const DUPLICATE_REFUND = 1
/** まだ出会っていないタイプの、出やすさ（出会い済みは 1） */
const NEW_WEIGHT = 4

const MBTI_CODES = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP']

interface Entry {
  kind: CollectionKind
  code: string
}

function allEntries(): Entry[] {
  return [
    ...MBTI_CODES.map((code) => ({ kind: 'mbti' as const, code })),
    ...Object.keys(LOVE_BASE_CHARACTERS).map((code) => ({ kind: 'love' as const, code })),
    ...SHUKU_LIST.map((s) => ({ kind: 'sukuyou' as const, code: s.name })),
  ]
}

/** 重みつきで、1つ選ぶ（乱数は、引数で渡せる：テスト用） */
export function pickWeighted(entries: Entry[], owned: Set<string>, rand: () => number = Math.random): Entry {
  const weights = entries.map((e) => (owned.has(`${e.kind}:${e.code}`) ? 1 : NEW_WEIGHT))
  let r = rand() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < entries.length; i++) {
    r -= weights[i]
    if (r < 0) return entries[i]
  }
  return entries[entries.length - 1]
}

async function ownedKeys(userId: string): Promise<Set<string>> {
  const rows = await listCollection(userId)
  return new Set(rows.map((r) => `${r.kind}:${r.code}`))
}

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId
    const all = allEntries()
    const owned = await ownedKeys(userId)
    const got = all.filter((e) => owned.has(`${e.kind}:${e.code}`)).length
    res.json({ success: true, cost: GACHA_COST, refund: DUPLICATE_REFUND, total: all.length, collected: got, complete: got >= all.length, balance: await getStoneBalance(userId) })
  } catch (error) {
    console.error('[API] gacha info failed:', error)
    res.status(500).json({ success: false, error: 'failed' })
  }
})

router.post('/pull', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId
    const all = allEntries()
    const owned = await ownedKeys(userId)
    if (all.every((e) => owned.has(`${e.kind}:${e.code}`))) {
      return res.status(409).json({ success: false, error: 'COMPLETE', message: 'すべてのタイプに出会いました' })
    }
    try {
      await spendStones(userId, GACHA_COST, 'gacha')
    } catch (error) {
      if (error instanceof Error && error.message === 'INSUFFICIENT_STONES') {
        return res.status(402).json({ success: false, error: 'INSUFFICIENT_STONES', message: 'ルーンストーンが足りません' })
      }
      throw error
    }
    const hit = pickWeighted(all, owned)
    const isNew = !owned.has(`${hit.kind}:${hit.code}`)
    await recordCollection(userId, hit.kind, hit.code)
    await incrementStat(userId, 'gacha_pulls').catch(() => undefined)
    let balance = await getStoneBalance(userId)
    if (!isNew) balance = await grantStones(userId, DUPLICATE_REFUND, 'gacha_refund')
    const got = all.filter((e) => owned.has(`${e.kind}:${e.code}`) || (e.kind === hit.kind && e.code === hit.code)).length
    res.json({ success: true, kind: hit.kind, code: hit.code, isNew, refunded: isNew ? 0 : DUPLICATE_REFUND, balance, collected: got, total: all.length })
  } catch (error) {
    console.error('[API] gacha pull failed:', error)
    res.status(500).json({ success: false, error: 'failed' })
  }
})

export default router

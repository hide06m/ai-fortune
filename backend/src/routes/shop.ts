/**
 * 交換所：ルーンストーンで、称号・ホームの背景と交換する
 *   GET  /api/shop            … 品ぞろえ・持っているもの・身につけているもの・残高
 *   POST /api/shop/buy        … 買う（body: { itemId }）
 *   POST /api/shop/equip      … 身につける（body: { itemId }）。最初から持っているものも、ここで戻せる
 *   GET  /api/shop/profile    … ホームの表示用（身につけている称号と背景）
 */

import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { query } from '../db/client.js'
import { getStoneBalance, spendStones } from '../db/stones.js'

const router = Router()

export type ShopKind = 'title' | 'background'
export interface ShopItem {
  id: string
  kind: ShopKind
  name: string
  desc: string
  price: number
  /** 背景のとき：画像の場所 */
  image?: string
}

/** 品ぞろえ（価格 0 は、最初から持っている） */
export const SHOP_ITEMS: ShopItem[] = [
  { id: 'title_traveler', kind: 'title', name: '森の旅人', desc: '森に迷いこんだばかりの人', price: 0 },
  { id: 'title_acorn', kind: 'title', name: 'どんぐり拾い', desc: '足もとの小さな幸せを見つける人', price: 3 },
  { id: 'title_star', kind: 'title', name: '星を読む人', desc: '夜空の下で道を探す人', price: 5 },
  { id: 'title_moon', kind: 'title', name: '月のしるべ', desc: '迷ったときに月を見上げる人', price: 8 },
  { id: 'title_rune', kind: 'title', name: 'ルーンの継ぎ手', desc: '石の声に耳をかたむける人', price: 12 },
  { id: 'title_keeper', kind: 'title', name: '森の守り人', desc: 'この森をいちばん知っている人', price: 20 },
  { id: 'bg_hall', kind: 'background', name: '館のホール', desc: 'いつもの、あたたかい部屋', price: 0, image: '/assets/room001.jpg' },
  { id: 'bg_forest_day', kind: 'background', name: '昼の森', desc: '木漏れ日がやさしい昼の森', price: 8, image: '/assets/index001.jpg' },
  { id: 'bg_forest_night', kind: 'background', name: '夜の森', desc: '光の点がまたたく夜の森', price: 8, image: '/assets/indexNight001.jpg' },
]
const DEFAULT_TITLE = 'title_traveler'
const DEFAULT_BG = 'bg_hall'

async function ownedSet(userId: string): Promise<Set<string>> {
  const r = await query('SELECT item_id FROM user_items WHERE user_id = $1', [userId])
  const set = new Set<string>(r.rows.map((x) => x.item_id as string))
  for (const it of SHOP_ITEMS) if (it.price === 0) set.add(it.id)
  return set
}

async function equipped(userId: string): Promise<{ title: string; background: string }> {
  const r = await query('SELECT title_id, background_id FROM user_profile WHERE user_id = $1', [userId])
  return { title: r.rows[0]?.title_id ?? DEFAULT_TITLE, background: r.rows[0]?.background_id ?? DEFAULT_BG }
}

async function snapshot(userId: string) {
  const owned = await ownedSet(userId)
  const eq = await equipped(userId)
  return {
    success: true,
    balance: await getStoneBalance(userId),
    equipped: eq,
    items: SHOP_ITEMS.map((it) => ({ ...it, owned: owned.has(it.id), equipped: it.id === eq.title || it.id === eq.background })),
  }
}

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    res.json(await snapshot(req.user!.userId))
  } catch (error) {
    console.error('[API] shop snapshot failed:', error)
    res.status(500).json({ success: false, error: 'failed' })
  }
})

router.get('/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const eq = await equipped(req.user!.userId)
    const title = SHOP_ITEMS.find((i) => i.id === eq.title)
    const bg = SHOP_ITEMS.find((i) => i.id === eq.background)
    res.json({ success: true, title: title ? { id: title.id, name: title.name } : null, background: bg ? { id: bg.id, image: bg.image } : null })
  } catch (error) {
    res.status(500).json({ success: false, error: 'failed' })
  }
})

router.post('/buy', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId
    const item = SHOP_ITEMS.find((i) => i.id === req.body?.itemId)
    if (!item) return res.status(400).json({ success: false, error: 'UNKNOWN_ITEM' })
    if ((await ownedSet(userId)).has(item.id)) return res.status(409).json({ success: false, error: 'ALREADY_OWNED', message: 'もう持っています' })
    // 先に、石を使う（足りなければ、ここで止まる）。そのあとで、持ち物に入れる。入れられなければ、石を戻す
    try {
      await spendStones(userId, item.price, 'shop')
    } catch (error) {
      if (error instanceof Error && error.message === 'INSUFFICIENT_STONES') {
        return res.status(402).json({ success: false, error: 'INSUFFICIENT_STONES', message: 'ルーンストーンが足りません' })
      }
      throw error
    }
    const ins = await query('INSERT INTO user_items (user_id, item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING item_id', [userId, item.id])
    if (ins.rows.length === 0) {
      const { grantStones } = await import('../db/stones.js')
      await grantStones(userId, item.price, 'gacha_refund')
      return res.status(409).json({ success: false, error: 'ALREADY_OWNED', message: 'もう持っています' })
    }
    res.json(await snapshot(userId))
  } catch (error) {
    console.error('[API] shop buy failed:', error)
    res.status(500).json({ success: false, error: 'failed' })
  }
})

router.post('/equip', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId
    const item = SHOP_ITEMS.find((i) => i.id === req.body?.itemId)
    if (!item) return res.status(400).json({ success: false, error: 'UNKNOWN_ITEM' })
    if (!(await ownedSet(userId)).has(item.id)) return res.status(403).json({ success: false, error: 'NOT_OWNED', message: 'まだ持っていません' })
    const col = item.kind === 'title' ? 'title_id' : 'background_id'
    await query(
      `INSERT INTO user_profile (user_id, ${col}) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET ${col} = EXCLUDED.${col}`,
      [userId, item.id]
    )
    res.json(await snapshot(userId))
  } catch (error) {
    console.error('[API] shop equip failed:', error)
    res.status(500).json({ success: false, error: 'failed' })
  }
})

export default router

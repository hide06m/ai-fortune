/**
 * 未解放の占い師の診断を、サーバー側で断る（画面で選べなくしているだけでなく、API を直接呼ばれても通さない）
 * 未ログイン（ゲスト）は、対象外（ゲストの流れは、別に制限している）。
 */

import { Request, Response, NextFunction } from 'express'
import { getUserCharacterIntimacy } from '../db/character.js'
import type { CharacterId } from '../types/character.js'

export function requireUnlocked(characterOf: CharacterId | ((req: Request) => CharacterId)) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!(req.isAuthenticated && req.user)) return next()
    const characterId = typeof characterOf === 'function' ? characterOf(req) : characterOf
    try {
      const row = await getUserCharacterIntimacy(req.user.userId, characterId)
      if (row && !row.unlockedAt) {
        return res.status(403).json({ success: false, error: 'CHARACTER_LOCKED', message: 'まだ解放されていない占い師です。' })
      }
    } catch (error) {
      // 確認できないときは、止めずに通す（解放済みのユーザーを、誤って締め出さない）
      console.error('requireUnlocked check failed:', error)
    }
    next()
  }
}

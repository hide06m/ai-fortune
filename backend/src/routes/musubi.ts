/**
 * ムスビの総合相談エンドポイント
 * POST /api/fortune/musubi   Body: { concern?: string }
 *
 * 全占い師の親密度がMAXになって、ムスビが解放されたユーザーだけが使える。
 * 各占い師のところで得た情報（生年月日の占い・2種のタイプ・手相・姓名判断）を、診断履歴から集めて、AI が、悩み・状況に答える。
 */

import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { requireAuth } from '../middleware/auth.js'
import { ensureMusubiUnlocked, getUserProfileSources } from '../db/musubi.js'
import { buildMusubiPrompt, buildMusubiProfilePrompt, hasAnyProfile } from '../llm/musubiPrompt.js'
import { generateFromPrompt } from '../llm/client.js'
import { spendStoneForDiagnosis, refundStoneForDiagnosis } from '../db/stones.js'
import { incrementCharacterIntimacy } from '../db/character.js'
import { MUSUBI_STONE_COST } from '../types/character.js'
import { saveReading } from '../db/readings.js'
import { dailyLimiter } from '../middleware/rateLimit.js'
import { llmFailed } from './llmFailure.js'
import { inFlightGuard } from '../middleware/inFlightGuard.js'
import { captureLatestResult } from '../middleware/latestResult.js'

const router = Router()

router.post('/', requireAuth, captureLatestResult({ kind: () => 'musubi', payload: (b) => ({ analysis: b.analysis ?? '' }) }), inFlightGuard, dailyLimiter, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId
    const concernText = typeof req.body?.concern === 'string' ? req.body.concern.slice(0, 1000) : ''

    if (!(await ensureMusubiUnlocked(userId))) {
      return res.status(403).json({
        success: false,
        error: 'MUSUBI_LOCKED',
        message: 'ムスビは、ナツメ・ツキ・コクウ・クリの親密度が、すべて最大になると解放されます。',
      })
    }

    const profile = await getUserProfileSources(userId)
    if (!hasAnyProfile(profile)) {
      return res.status(400).json({ success: false, error: 'NO_PROFILE', message: 'まだ、占い師のところで得た情報がありません。先に、診断を受けてください。' })
    }

    let stoneBalance: number | null = null
    const shouldChargeStone = !!process.env.GEMINI_API_KEY
    if (shouldChargeStone) {
      try {
        stoneBalance = await spendStoneForDiagnosis(userId, MUSUBI_STONE_COST)
      } catch (error) {
        if (error instanceof Error && error.message === 'INSUFFICIENT_STONES') {
          return res.status(402).json({
            success: false,
            error: 'INSUFFICIENT_STONES',
            message: 'ルーンストーンが足りません。ログインボーナスや広告視聴で増やしてください。',
          })
        }
        throw error
      }
    }

    let intimacyLevel: number | null = null
    try {
      intimacyLevel = (await incrementCharacterIntimacy(userId, 0)).intimacyLevel
    } catch (error) {
      console.error('Failed to update character intimacy (musubi):', error)
    }

    let analysis = 'LLM API が未設定です。'
    let llmSucceeded = false
    if (process.env.GEMINI_API_KEY) {
      try {
        // 1段階目：すべての診断結果から、人となりを解析する。失敗しても、2段階目は、元の情報だけで続ける
        let profileText: string | null = null
        try {
          profileText = (await generateFromPrompt(buildMusubiProfilePrompt(profile))).analysis
        } catch (error) {
          console.warn('[musubi] 人となりの解析（1段階目）に失敗しました。元の情報だけで続けます:', error)
        }
        // 2段階目：人となりの解析と、元の情報をもとに、悩み・状況に答える
        const llm = await generateFromPrompt(buildMusubiPrompt(profile, concernText, profileText))
        analysis = llm.analysis
        llmSucceeded = true
      } catch (error) {
        console.error('Musubi LLM generation error:', error)
        // 失敗した診断は、1日の回数に数えない
        res.locals.diagnosisFailed = true
        analysis = `LLM生成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
        try {
          stoneBalance = await refundStoneForDiagnosis(userId, MUSUBI_STONE_COST)
        } catch (refundError) {
          console.error('Failed to refund stone after LLM failure (musubi):', refundError)
        }
      }
    }

    if (llmSucceeded) {
      try {
        await saveReading({
          userId,
          concern: concernText,
          analysis: `【ムスビの総合相談】\n\n${analysis}`,
          characterId: 0,
          baziKey: `musubi:${uuidv4()}`,
        })
      } catch (error) {
        console.error('Failed to save reading (musubi):', error)
      }
    }

    // AIの生成に失敗したときは、成功の形で返さず、失敗として返す（石は、払い戻し済み）
    if (res.locals.diagnosisFailed) return llmFailed(res, stoneBalance)

    res.json({
      success: true,
      analysis,
      intimacy: intimacyLevel === null ? null : { characterId: 0, intimacyLevel, justUnlocked: null },
      stoneBalance,
    })
  } catch (error) {
    console.error('Musubi consult API error:', error)
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

export default router

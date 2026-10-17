/**
 * 宿曜占星術エンドポイント
 * POST /api/fortune/sukuyou
 * ツキ（キャラID2）のもう一つの占術。生年月日から、旧暦・本命宿・三九の宿を計算し、結果を根拠に AI が診断文を書く。
 *
 * Body: { birthDate: 'YYYY-MM-DD', concern?: string }
 */

import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { computeSukuyou } from '../fortune/sukuyou.js'
import { isValidPastDate } from '../fortune/dateCheck.js'
import { buildSukuyouPrompt } from '../llm/sukuyouPrompt.js'
import { generateFromPrompt } from '../llm/client.js'
import { spendStoneForDiagnosis, refundStoneForDiagnosis } from '../db/stones.js'
import { incrementCharacterIntimacy, unlockCharacter } from '../db/character.js'
import { INTIMACY_UNLOCKS, DIAGNOSIS_STONE_COST, type CharacterId } from '../types/character.js'
import { saveReading } from '../db/readings.js'
import { dailyLimiter } from '../middleware/rateLimit.js'
import { llmFailed } from './llmFailure.js'
import { requireUnlocked } from '../middleware/requireUnlocked.js'
import { asyncJob } from '../middleware/asyncJob.js'
import { inFlightGuard } from '../middleware/inFlightGuard.js'
import { captureLatestResult } from '../middleware/latestResult.js'

const router = Router()
const TSUKI_CHARACTER_ID: CharacterId = 2

router.post('/', asyncJob(() => 'sukuyou'), captureLatestResult({ kind: () => 'sukuyou', payload: (b) => (b.result ? { sukuyouResult: b.result, analysis: b.analysis ?? '' } : null) , collect: (b) => (b.result?.mei?.name ? { kind: 'sukuyou', code: String(b.result.mei.name) } : null) }), requireUnlocked(2), inFlightGuard, dailyLimiter, async (req: Request, res: Response) => {
  try {
    const { birthDate, concern } = req.body
    const concernText = typeof concern === 'string' ? concern.slice(0, 1000) : ''
    const result = isValidPastDate(birthDate) ? computeSukuyou(birthDate) : null
    if (!result) {
      return res.status(400).json({ success: false, error: '生年月日を、正しく入力してください' })
    }

    const cost = DIAGNOSIS_STONE_COST[TSUKI_CHARACTER_ID]
    const shouldChargeStone = !!(req.isAuthenticated && req.user && process.env.GEMINI_API_KEY)
    let stoneBalance: number | null = null
    if (shouldChargeStone) {
      try {
        stoneBalance = await spendStoneForDiagnosis(req.user!.userId, cost)
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

    let intimacyResult: { characterId: CharacterId; intimacyLevel: number; justUnlocked: CharacterId | null } | null = null
    if (req.isAuthenticated && req.user) {
      try {
        const intimacy = await incrementCharacterIntimacy(req.user.userId, TSUKI_CHARACTER_ID)
        let justUnlocked: CharacterId | null = null
        const unlock = INTIMACY_UNLOCKS.find((u) => u.characterId !== undefined && u.level === intimacy.intimacyLevel)
        if (unlock?.characterId !== undefined) {
          const { wasNewlyUnlocked } = await unlockCharacter(req.user.userId, unlock.characterId)
          if (wasNewlyUnlocked) justUnlocked = unlock.characterId
        }
        intimacyResult = { characterId: TSUKI_CHARACTER_ID, intimacyLevel: intimacy.intimacyLevel, justUnlocked }
      } catch (error) {
        console.error('Failed to update character intimacy (sukuyou):', error)
      }
    }

    let analysis = 'LLM API が未設定です。本命宿などの計算結果は、上の通りです。'
    let llmSucceeded = false
    if (process.env.GEMINI_API_KEY) {
      try {
        const llm = await generateFromPrompt(buildSukuyouPrompt(result, concernText))
        analysis = llm.analysis
        llmSucceeded = true
      } catch (error) {
        console.error('Sukuyou LLM generation error:', error)
        res.locals.diagnosisFailed = true
        analysis = `LLM生成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
        if (shouldChargeStone) {
          try {
            stoneBalance = await refundStoneForDiagnosis(req.user!.userId, cost)
          } catch (refundError) {
            console.error('Failed to refund stone after LLM failure (sukuyou):', refundError)
          }
        }
      }
    }

    if (llmSucceeded && req.isAuthenticated && req.user) {
      try {
        const k = result.kyureki
        const header = `【宿曜占星術】${result.birthDate}（旧暦${k.isLeap ? '閏' : ''}${k.month}月${k.day}日）本命宿：${result.mei.name}／業宿：${result.gyo.name}／胎宿：${result.tai.name}`
        await saveReading({
          userId: req.user.userId,
          concern: concernText,
          analysis: `${header}\n\n${analysis}`,
          characterId: TSUKI_CHARACTER_ID,
          baziKey: `sukuyou:${uuidv4()}`,
        })
      } catch (error) {
        console.error('Failed to save reading (sukuyou):', error)
      }
    }

    if (res.locals.diagnosisFailed) return llmFailed(res, stoneBalance)

    res.json({ success: true, result, analysis, intimacy: intimacyResult, stoneBalance })
  } catch (error) {
    console.error('Sukuyou diagnosis API error:', error)
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

export default router

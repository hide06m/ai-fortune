/**
 * 手相診断エンドポイント
 * POST /api/fortune/palmistry
 * コクウ（キャラID3）専用の占術。生年月日ではなく手のひらの写真を使う
 *
 * Body:
 *  - token を渡す場合：QR連携でスマホがアップロードした画像を使う（PC側フロー）
 *  - imageBase64 + mimeType を直接渡す場合：スマホ本体で撮影してそのまま診断する場合
 */

import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { consumePalmSessionImage } from '../palm/sessionStore.js'
import { buildPalmistryPrompt } from '../llm/palmistryPrompt.js'
import { generatePalmistryJson } from '../llm/client.js'
import { parsePalmistryOutput, type PalmLine } from '../llm/palmistryParse.js'
import { spendStoneForDiagnosis, refundStoneForDiagnosis } from '../db/stones.js'
import { incrementCharacterIntimacy, unlockCharacter } from '../db/character.js'
import { INTIMACY_UNLOCKS, DIAGNOSIS_STONE_COST, type CharacterId } from '../types/character.js'
import { saveReading } from '../db/readings.js'
import { dailyLimiter } from '../middleware/rateLimit.js'

const router = Router()
const KOKUU_CHARACTER_ID: CharacterId = 3

router.post('/', dailyLimiter, async (req: Request, res: Response) => {
  try {
    const { token, imageBase64: directImageBase64, mimeType: directMimeType, concern } = req.body
    const concernText = typeof concern === 'string' ? concern : ''

    let imageBase64: string | null = null
    let mimeType: string | null = null

    if (typeof token === 'string' && token) {
      const consumed = consumePalmSessionImage(token)
      if (!consumed) {
        return res.status(404).json({ success: false, error: '画像がまだアップロードされていないか、セッションが期限切れです' })
      }
      imageBase64 = consumed.imageBase64
      mimeType = consumed.mimeType
    } else if (typeof directImageBase64 === 'string' && directImageBase64 && typeof directMimeType === 'string') {
      imageBase64 = directImageBase64
      mimeType = directMimeType
    }

    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ success: false, error: 'token、またはimageBase64+mimeTypeのいずれかが必要です' })
    }

    // 親密度更新はコクウ（キャラID3）固定
    let intimacyResult: { characterId: CharacterId; intimacyLevel: number; justUnlocked: CharacterId | null } | null = null
    const applyIntimacy = async () => {
      if (!req.isAuthenticated || !req.user) return
      try {
        const userId = req.user.userId
        const intimacy = await incrementCharacterIntimacy(userId, KOKUU_CHARACTER_ID)
        let justUnlocked: CharacterId | null = null
        const unlock = INTIMACY_UNLOCKS.find((u) => u.characterId !== undefined && u.level === intimacy.intimacyLevel)
        if (unlock?.characterId !== undefined) {
          const { wasNewlyUnlocked } = await unlockCharacter(userId, unlock.characterId)
          if (wasNewlyUnlocked) justUnlocked = unlock.characterId
        }
        intimacyResult = { characterId: KOKUU_CHARACTER_ID, intimacyLevel: intimacy.intimacyLevel, justUnlocked }
      } catch (error) {
        console.error('Failed to update character intimacy (palmistry):', error)
      }
    }

    // 石の消費（ログイン済みユーザーがLLMを実際に呼ぶ場合のみ）
    // 写真は毎回内容が異なるためキャッシュは行わない
    const shouldChargeStone = !!(req.isAuthenticated && req.user && process.env.GEMINI_API_KEY)
    const stoneCost = DIAGNOSIS_STONE_COST[KOKUU_CHARACTER_ID]
    let stoneBalance: number | null = null
    if (shouldChargeStone) {
      try {
        stoneBalance = await spendStoneForDiagnosis(req.user!.userId, stoneCost)
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

    await applyIntimacy()

    let analysis = 'LLM API が未設定です。'
    let llmSucceeded = false
    let lines: PalmLine[] = []

    if (process.env.GEMINI_API_KEY) {
      const prompt = buildPalmistryPrompt(concernText)
      try {
        const llmResult = await generatePalmistryJson(prompt, imageBase64, mimeType)
        const parsed = parsePalmistryOutput(llmResult.analysis)
        analysis = parsed.analysis
        lines = parsed.lines
        llmSucceeded = true
      } catch (error) {
        console.error('Palmistry LLM generation error:', error)
        analysis = `LLM生成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
        if (shouldChargeStone) {
          try {
            stoneBalance = await refundStoneForDiagnosis(req.user!.userId, stoneCost)
          } catch (refundError) {
            console.error('Failed to refund stone after LLM failure (palmistry):', refundError)
          }
        }
      }
    }

    if (llmSucceeded && req.isAuthenticated && req.user) {
      try {
        await saveReading({
          userId: req.user.userId,
          concern: concernText,
          // 診断履歴は写真を保存しないテキストのみなので、線ごとの観察も本文に含めて残す
          analysis: lines.length > 0
            ? `${analysis}\n\n## 線ごとの観察\n${lines.map((l) => `- **${l.label}**：${l.reading}`).join('\n')}`
            : analysis,
          characterId: KOKUU_CHARACTER_ID,
          baziKey: `palm:${uuidv4()}`,
        })
      } catch (error) {
        console.error('Failed to save reading (palmistry):', error)
      }
    }

    res.json({
      success: true,
      analysis,
      // 撮影した写真はこのレスポンスで画面に返すだけ（サーバーには保存しない）。線の座標と一緒に画像上へ重ねて表示する
      lines,
      image: llmSucceeded ? { base64: imageBase64, mimeType } : null,
      intimacy: intimacyResult,
      stoneBalance,
    })
  } catch (error) {
    console.error('Palmistry diagnosis API error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

export default router

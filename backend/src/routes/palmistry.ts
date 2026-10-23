/**
 * 手相診断エンドポイント
 * POST /api/fortune/palmistry
 * コクウ（キャラID3）専用の占術。生年月日ではなく手のひらの写真を使う
 *
 * Body:
 *  - token を渡す場合：QR連携でスマホがアップロードした画像と検出結果を使う（PC側フロー）
 *  - imageBase64 + mimeType（+ lines）を直接渡す場合：スマホ本体で撮影してそのまま診断する場合
 *
 * lines は撮影側が画像処理で「定義に合う線だけ」検出した結果。
 * Gemini には線を探させず、検出できた線の読みだけを書かせる（検出できなかった線は何も言わない）
 */

import { Router, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { consumePalmSessionImage, peekPalmSession } from '../palm/sessionStore.js'
import { generatePalmistryReadingJson } from '../llm/client.js'
import { sanitizeDetectedLines, buildReadingPrompt, parseReadingOutput, type ReadingLine } from '../llm/palmistryReading.js'
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

/**
 * 開発時だけ、撮影した写真と検出結果を、git管理外のフォルダへ保存する（検出の精度改善に、実機の写真を使うため）。
 * 本番（NODE_ENV=production）では保存しない。写真は診断後に破棄する方針は、本番では変わらない
 */
function saveDevCapture(imageBase64: string, rawLines: unknown): void {
  if (process.env.NODE_ENV === 'production') return
  try {
    const dir = path.resolve(process.cwd(), '../frontend/public/dev-samples/captures')
    fs.mkdirSync(dir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    fs.writeFileSync(path.join(dir, `${stamp}.jpg`), Buffer.from(imageBase64, 'base64'))
    fs.writeFileSync(path.join(dir, `${stamp}.lines.json`), JSON.stringify(rawLines ?? null))
  } catch (error) {
    console.warn('[palmistry] 開発用の保存に失敗しました', error)
  }
}
const KOKUU_CHARACTER_ID: CharacterId = 3

// 手相は、撮影した写真と線の座標も、最新の結果として保存する（前回の結果を、石なしで見返せるように）
router.post('/', asyncJob(() => 'palm'), captureLatestResult({
  kind: () => 'palm',
  payload: (b) => ({
    analysis: b.analysis ?? '',
    palm: b.image && Array.isArray(b.lines) && b.lines.length > 0 ? { imageUrl: `data:${b.image.mimeType};base64,${b.image.base64}`, lines: b.lines } : undefined,
  }),
}), requireUnlocked(3), inFlightGuard, dailyLimiter, async (req: Request, res: Response) => {
  try {
    const { token, imageBase64: directImageBase64, mimeType: directMimeType, concern, lines: directLines } = req.body
    const concernText = typeof concern === 'string' ? concern : ''

    let imageBase64: string | null = null
    let mimeType: string | null = null
    let rawLines: unknown = null
    let sessionToken: string | null = null

    if (typeof token === 'string' && token) {
      // まだ消費しない（AIの生成に失敗したとき、同じ写真で、やり直せるように）。成功したときに、消費する
      const consumed = await peekPalmSession(token)
      sessionToken = token
      if (!consumed) {
        return res.status(404).json({ success: false, error: '画像がまだアップロードされていないか、セッションが期限切れです' })
      }
      imageBase64 = consumed.imageBase64
      mimeType = consumed.mimeType
      // PC側で解析した線があればそれを使う（スマホでは解析しない）
      rawLines = Array.isArray(directLines) ? directLines : consumed.lines
    } else if (typeof directImageBase64 === 'string' && directImageBase64 && typeof directMimeType === 'string') {
      imageBase64 = directImageBase64
      mimeType = directMimeType
      rawLines = directLines
    }

    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ success: false, error: 'token、またはimageBase64+mimeTypeのいずれかが必要です' })
    }

    saveDevCapture(imageBase64, rawLines)

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

    const startedAt = Date.now()
    let analysis = 'LLM API が未設定です。'
    let llmSucceeded = false
    let lines: ReadingLine[] = []
    const detected = sanitizeDetectedLines(rawLines)

    if (process.env.GEMINI_API_KEY) {
      try {
        const prompt = buildReadingPrompt(concernText, detected)
        const llmResult = await generatePalmistryReadingJson(prompt, imageBase64, mimeType)
        const parsed = parseReadingOutput(llmResult.analysis, detected)
        analysis = parsed.analysis
        lines = parsed.lines
        llmSucceeded = true
      } catch (error) {
        console.error('Palmistry LLM generation error:', error)
        // 失敗した診断は、1日の回数に数えない（利用者のせいではないため。rateLimit の requestWasSuccessful が見る）
        res.locals.diagnosisFailed = true
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

    console.log(
      `[palmistry] 診断${llmSucceeded ? '成功' : '失敗（払い戻し）'}：${Math.round((Date.now() - startedAt) / 1000)}秒、検出された線${detected.length}本、返す線${lines.length}本`
    )

    // AIの生成に失敗したときは、成功の形で返さず、失敗として返す（石は、払い戻し済み）。写真は残すので、同じ写真で、もう一度診断できる
    if (res.locals.diagnosisFailed) return llmFailed(res, stoneBalance)
    // 成功したので、写真を、サーバーのセッションから破棄する（保存するのは、最新の結果としての1件だけ）
    if (sessionToken) await consumePalmSessionImage(sessionToken)

    res.json({
      success: true,
      analysis,
      // 撮影した写真はこのレスポンスで画面に返すだけ（サーバーには保存しない）。検出できた線を画像上に重ねて表示する
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

/**
 * 性格タイプ診断（16タイプ）エンドポイント
 * GET  /api/fortune/mbti/latest - 直近の診断結果があるか確認（再診断の選択肢を出すため）
 * POST /api/fortune/mbti        - 診断を実行
 * クリ（キャラID4）専用の占術。生年月日ではなく60問の回答を使う。
 * 2回目以降は、60問をやり直す代わりに「前回の結果のまま悩みだけ入力し直す」再診断も選べる
 * （body に answers の代わりに reuseLatest: true を渡す）
 */

import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import {
  calculatePersonalityType,
  buildMBTIResultFromType,
  isValidMBTIType,
  type MBTIAnswer,
  type MBTIQuizResult,
} from '../fortune/mbti.js'
import { buildMBTIPrompt } from '../llm/mbtiPrompt.js'
import { generateFromPrompt } from '../llm/client.js'
import { fortuneCache } from '../llm/cache.js'
import { spendStoneForDiagnosis, refundStoneForDiagnosis } from '../db/stones.js'
import { incrementCharacterIntimacy, unlockCharacter } from '../db/character.js'
import { INTIMACY_UNLOCKS, DIAGNOSIS_STONE_COST, KURI_CONSULT_STONE_COST, type CharacterId } from '../types/character.js'
import { saveReading, getLatestMBTIResult } from '../db/readings.js'
import { requireAuth } from '../middleware/auth.js'
import { dailyLimiter } from '../middleware/rateLimit.js'
import { llmFailed } from './llmFailure.js'
import { requireUnlocked } from '../middleware/requireUnlocked.js'
import { asyncJob } from '../middleware/asyncJob.js'
import { inFlightGuard } from '../middleware/inFlightGuard.js'
import { captureLatestResult } from '../middleware/latestResult.js'

const router = Router()
const KURI_CHARACTER_ID: CharacterId = 4

function isValidAnswers(value: unknown): value is MBTIAnswer[] {
  return (
    Array.isArray(value) &&
    value.length === 60 &&
    value.every(
      (a) =>
        a &&
        typeof a.id === 'number' && a.id >= 0 && a.id <= 59 &&
        typeof a.val === 'number' && a.val >= -3 && a.val <= 3
    )
  )
}

/**
 * GET /api/fortune/mbti/latest
 * 直近の性格タイプ診断結果があるかどうかを返す（あれば再診断の選択肢をフロントに出す）
 */
router.get('/latest', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).userId
    const result = await getLatestMBTIResult(userId)
    res.json({ success: true, result })
  } catch (error) {
    console.error('[API] Failed to get latest MBTI result:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get latest MBTI result',
    })
  }
})

router.post('/', asyncJob(() => 'mbti'), captureLatestResult({ kind: () => 'mbti', payload: (b) => (b.result ? { mbtiResult: b.result, analysis: b.analysis ?? '' } : null) }), requireUnlocked(4), inFlightGuard, dailyLimiter, async (req: Request, res: Response) => {
  try {
    const { answers, concern, reuseLatest, directType, typeOnly } = req.body
    const concernText = typeof concern === 'string' ? concern : ''

    let quizResult: MBTIQuizResult
    let diagnosisKey: string

    if (reuseLatest === true) {
      if (!req.isAuthenticated || !req.user) {
        return res.status(401).json({ success: false, error: 'ログインが必要です' })
      }
      const latest = await getLatestMBTIResult(req.user.userId)
      if (!latest) {
        return res.status(404).json({ success: false, error: '前回の診断結果が見つかりません。最初から診断してください' })
      }
      quizResult = latest
      // 同じタイプでも悩みが変わればLLM出力は変えたいため、悩みテキストもキーに含める
      diagnosisKey = `mbti:${crypto.createHash('sha256').update(`reuse:${quizResult.personalityType}`).digest('hex').slice(0, 32)}`
    } else if (typeof directType === 'string' && directType) {
      if (!isValidMBTIType(directType)) {
        return res.status(400).json({ success: false, error: 'タイプの形式が正しくありません（例: ENTJ-T）' })
      }
      quizResult = buildMBTIResultFromType(directType)
      diagnosisKey = `mbti:${crypto.createHash('sha256').update(`direct:${quizResult.personalityType}`).digest('hex').slice(0, 32)}`
    } else {
      if (!isValidAnswers(answers)) {
        return res.status(400).json({ success: false, error: '60問すべての回答（id, val）が必要です' })
      }
      quizResult = calculatePersonalityType(answers)
      const answersKey = JSON.stringify(answers)
      // bazi_key カラムは VARCHAR(50) のため、回答全体のJSONではなく短いハッシュを使う
      diagnosisKey = `mbti:${crypto.createHash('sha256').update(answersKey).digest('hex').slice(0, 40)}`
    }
    const answersKey = `${diagnosisKey}:${concernText}`

    // 親密度更新はクリ（キャラID4）固定
    let intimacyResult: { characterId: CharacterId; intimacyLevel: number; justUnlocked: CharacterId | null } | null = null
    const applyIntimacy = async () => {
      if (!req.isAuthenticated || !req.user) return
      try {
        const userId = req.user.userId
        const intimacy = await incrementCharacterIntimacy(userId, KURI_CHARACTER_ID)
        let justUnlocked: CharacterId | null = null
        const unlock = INTIMACY_UNLOCKS.find((u) => u.characterId !== undefined && u.level === intimacy.intimacyLevel)
        if (unlock?.characterId !== undefined) {
          const { wasNewlyUnlocked } = await unlockCharacter(userId, unlock.characterId)
          if (wasNewlyUnlocked) justUnlocked = unlock.characterId
        }
        intimacyResult = { characterId: KURI_CHARACTER_ID, intimacyLevel: intimacy.intimacyLevel, justUnlocked }
      } catch (error) {
        console.error('Failed to update character intimacy (mbti):', error)
      }
    }

    // タイプの診断だけ（AIを使わない）：結果をすぐに返す。石は使わず、結果は保存して、
    // あとで「悩み・状況の相談」（reuseLatest）に使えるようにする
    if (typeOnly === true) {
      // AIを使わない軽い処理なので、1日の診断回数には数えない
      res.locals.skipDailyCount = true
      // タイプ診断は、石1個（AIは使わないので、失敗して払い戻す場面はない）
      let typeStoneBalance: number | null = null
      if (req.isAuthenticated && req.user) {
        try {
          typeStoneBalance = await spendStoneForDiagnosis(req.user.userId, DIAGNOSIS_STONE_COST[KURI_CHARACTER_ID])
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
      if (req.isAuthenticated && req.user) {
        try {
          await saveReading({
            userId: req.user.userId,
            concern: '',
            mbtiResult: quizResult,
            analysis: '（タイプの診断のみ）',
            characterId: KURI_CHARACTER_ID,
            baziKey: diagnosisKey,
          })
        } catch (error) {
          console.error('Failed to save reading (mbti type only):', error)
        }
      }
      return res.json({ success: true, result: quizResult, analysis: '', typeOnly: true, intimacy: intimacyResult, stoneBalance: typeStoneBalance })
    }

    // キャッシュ確認（石を使わずに結果を返せるケース）
    const cachedResult = fortuneCache.get(answersKey, concernText)
    if (cachedResult) {
      await applyIntimacy()

      if (req.isAuthenticated && req.user) {
        try {
          await saveReading({
            userId: req.user.userId,
            concern: concernText,
            mbtiResult: quizResult,
            analysis: cachedResult,
            characterId: KURI_CHARACTER_ID,
            baziKey: diagnosisKey,
          })
        } catch (error) {
          console.error('Failed to save reading (mbti cache hit):', error)
        }
      }

      return res.json({
        success: true,
        result: quizResult,
        analysis: cachedResult,
        cached: true,
        intimacy: intimacyResult,
      })
    }

    // 石の消費（ログイン済みユーザーがLLMを実際に呼ぶ場合のみ）
    const shouldChargeStone = !!(req.isAuthenticated && req.user && process.env.GEMINI_API_KEY)
    // 悩み・状況の相談（AIを使う）は石3個
    const stoneCost = KURI_CONSULT_STONE_COST
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

    let analysis = 'LLM API が未設定です。診断結果は以下の通りです。'
    let llmSucceeded = false

    if (process.env.GEMINI_API_KEY) {
      const prompt = buildMBTIPrompt(quizResult, concernText)
      try {
        const llmResult = await generateFromPrompt(prompt)
        analysis = llmResult.analysis
        llmSucceeded = true
      } catch (error) {
        console.error('MBTI LLM generation error:', error)
        // 失敗した診断は、1日の回数に数えない（利用者のせいではないため。rateLimit の requestWasSuccessful が見る）
        res.locals.diagnosisFailed = true
        analysis = `LLM生成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
        if (shouldChargeStone) {
          try {
            stoneBalance = await refundStoneForDiagnosis(req.user!.userId, stoneCost)
          } catch (refundError) {
            console.error('Failed to refund stone after LLM failure (mbti):', refundError)
          }
        }
      }
    }

    if (llmSucceeded) {
      fortuneCache.set(answersKey, concernText, analysis)
    }

    if (llmSucceeded && req.isAuthenticated && req.user) {
      try {
        await saveReading({
          userId: req.user.userId,
          concern: concernText,
          mbtiResult: quizResult,
          analysis,
          characterId: KURI_CHARACTER_ID,
          baziKey: diagnosisKey,
        })
      } catch (error) {
        console.error('Failed to save reading (mbti):', error)
      }
    }

    // AIの生成に失敗したときは、成功の形で返さず、失敗として返す（石は、払い戻し済み）
    if (res.locals.diagnosisFailed) return llmFailed(res, stoneBalance)

    res.json({
      success: true,
      result: quizResult,
      analysis,
      intimacy: intimacyResult,
      stoneBalance,
    })
  } catch (error) {
    console.error('MBTI diagnosis API error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

export default router

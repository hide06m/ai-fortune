/**
 * 相性診断エンドポイント
 * POST /api/compatibility
 * Body: { personA: { name?, birthDate, birthTime? }, personB: { name?, birthDate, birthTime? } }
 */

import { Router, Request, Response } from 'express'
import { calculateBaZi, calculateLifePathNumber, calculateKyuseiSeisun } from '../fortune/index.js'
import { buildCompatibilityPrompt } from '../llm/compatibilityPrompt.js'
import { generateFromPrompt } from '../llm/client.js'
import { fortuneCache } from '../llm/cache.js'
import { spendStoneForDiagnosis, refundStoneForDiagnosis } from '../db/stones.js'
import { dailyLimiter } from '../middleware/rateLimit.js'
import { llmFailed } from './llmFailure.js'
import { isValidPastDate } from '../fortune/dateCheck.js'
import { inFlightGuard } from '../middleware/inFlightGuard.js'

const router = Router()

interface PersonInput {
  name?: string
  birthDate: string
  birthTime?: string
}

function isValidPersonInput(value: unknown): value is PersonInput {
  return !!value && typeof value === 'object' && typeof (value as PersonInput).birthDate === 'string'
}

router.post('/', inFlightGuard, dailyLimiter, async (req: Request, res: Response) => {
  try {
    const { personA, personB } = req.body

    if (!isValidPersonInput(personA) || !isValidPersonInput(personB)) {
      return res.status(400).json({ error: 'personA and personB (each with birthDate) are required' })
    }

    if (!isValidPastDate(personA.birthDate) || !isValidPastDate(personB.birthDate)) {
      return res.status(400).json({ success: false, error: 'INVALID_BIRTH_DATE', message: '生年月日を、正しく入力してください（未来の日付や、存在しない日付は使えません）' })
    }

    const labelA = personA.name?.trim() || 'Aさん'
    const labelB = personB.name?.trim() || 'Bさん'

    const fortuneA = {
      label: labelA,
      baZi: calculateBaZi(personA.birthDate, personA.birthTime),
      numerology: calculateLifePathNumber(personA.birthDate),
      kyuseiSeisun: calculateKyuseiSeisun(personA.birthDate)
    }
    const fortuneB = {
      label: labelB,
      baZi: calculateBaZi(personB.birthDate, personB.birthTime),
      numerology: calculateLifePathNumber(personB.birthDate),
      kyuseiSeisun: calculateKyuseiSeisun(personB.birthDate)
    }

    const baziKeyOf = (f: typeof fortuneA) =>
      `${f.baZi.yearPillar.stem}${f.baZi.yearPillar.branch}-${f.baZi.monthPillar.stem}${f.baZi.monthPillar.branch}-${f.baZi.dayPillar.stem}${f.baZi.dayPillar.branch}-${f.baZi.timePillar.stem}${f.baZi.timePillar.branch}`
    const cacheKey = `compat:${baziKeyOf(fortuneA)}:${baziKeyOf(fortuneB)}`

    const cachedResult = fortuneCache.get(cacheKey, 'compatibility')
    if (cachedResult) {
      console.log('[CACHE HIT]', cacheKey)
      return res.json({
        success: true,
        personA: fortuneA,
        personB: fortuneB,
        analysis: cachedResult,
        cached: true
      })
    }

    // 石の消費（ログイン済みユーザーがLLMを実際に呼ぶ場合のみ。通常の診断と同じ「diagnosis」扱い）
    const shouldChargeStone = !!(req.isAuthenticated && req.user && process.env.GEMINI_API_KEY)
    let stoneBalance: number | null = null
    if (shouldChargeStone) {
      try {
        stoneBalance = await spendStoneForDiagnosis(req.user!.userId)
      } catch (error) {
        if (error instanceof Error && error.message === 'INSUFFICIENT_STONES') {
          return res.status(402).json({
            success: false,
            error: 'INSUFFICIENT_STONES',
            message: 'ルーンストーンが足りません。ログインボーナスや広告視聴で増やしてください。'
          })
        }
        throw error
      }
    }

    let analysis = 'LLM API が未設定です。占術計算結果は以下の通りです。'
    if (process.env.GEMINI_API_KEY) {
      const prompt = buildCompatibilityPrompt(fortuneA, fortuneB)
      try {
        const llmResult = await generateFromPrompt(prompt)
        analysis = llmResult.analysis
      } catch (error) {
        console.error('Compatibility LLM generation error:', error)
        // 失敗した診断は、1日の回数に数えない（利用者のせいではないため。rateLimit の requestWasSuccessful が見る）
        res.locals.diagnosisFailed = true
        analysis = `LLM生成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
        if (shouldChargeStone) {
          try {
            stoneBalance = await refundStoneForDiagnosis(req.user!.userId)
          } catch (refundError) {
            console.error('Failed to refund stone after LLM failure:', refundError)
          }
        }
        // 失敗を成功の形で返さない（石は、払い戻し済み）
        return llmFailed(res, stoneBalance)
      }
    }

    fortuneCache.set(cacheKey, 'compatibility', analysis)

    res.json({
      success: true,
      personA: fortuneA,
      personB: fortuneB,
      analysis,
      cached: false,
      stoneBalance
    })
  } catch (error) {
    console.error('Compatibility API error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export default router

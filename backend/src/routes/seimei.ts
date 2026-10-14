/**
 * 姓名判断エンドポイント
 * POST /api/fortune/seimei
 * コクウ（キャラID3）のもう一つの占術。姓と名（漢字・かな）から、画数・五格・三才を計算し、
 * 結果を根拠に、AI が診断文を書く。
 *
 * Body: { surname: string, givenName: string, concern?: string }
 * 画数を数えられない字があるとき：400 と、その字の一覧（unknown）を返す
 */

import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { strokesOfName, computeSeimei } from '../fortune/seimei.js'
import { buildSeimeiPrompt } from '../llm/seimeiPrompt.js'
import { generateFromPrompt } from '../llm/client.js'
import { spendStoneForDiagnosis, refundStoneForDiagnosis } from '../db/stones.js'
import { incrementCharacterIntimacy, unlockCharacter } from '../db/character.js'
import { INTIMACY_UNLOCKS, SEIMEI_STONE_COST, type CharacterId } from '../types/character.js'
import { saveReading } from '../db/readings.js'
import { dailyLimiter } from '../middleware/rateLimit.js'

const router = Router()
const KOKUU_CHARACTER_ID: CharacterId = 3
const MAX_NAME_LENGTH = 8

router.post('/', dailyLimiter, async (req: Request, res: Response) => {
  try {
    const { surname, givenName, concern } = req.body
    const concernText = typeof concern === 'string' ? concern.slice(0, 1000) : ''
    if (typeof surname !== 'string' || typeof givenName !== 'string' || !surname.trim() || !givenName.trim()) {
      return res.status(400).json({ success: false, error: '姓と名を入力してください' })
    }
    if ([...surname.trim()].length > MAX_NAME_LENGTH || [...givenName.trim()].length > MAX_NAME_LENGTH) {
      return res.status(400).json({ success: false, error: '姓・名は、それぞれ8文字までにしてください' })
    }

    const s = strokesOfName(surname)
    const g = strokesOfName(givenName)
    if (!s.ok || !g.ok) {
      const unknown = [...(!s.ok ? s.unknown : []), ...(!g.ok ? g.unknown : [])]
      return res.status(400).json({
        success: false,
        error: 'UNKNOWN_CHAR',
        message: `画数を数えられない字があります：${[...new Set(unknown)].join('、')}。別の字（旧字体・新字体）で入力するか、ひらがなにしてください`,
        unknown,
      })
    }
    const result = computeSeimei(s.chars, g.chars)

    const shouldChargeStone = !!(req.isAuthenticated && req.user && process.env.GEMINI_API_KEY)
    let stoneBalance: number | null = null
    if (shouldChargeStone) {
      try {
        stoneBalance = await spendStoneForDiagnosis(req.user!.userId, SEIMEI_STONE_COST)
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

    // 親密度更新はコクウ（キャラID3）固定
    let intimacyResult: { characterId: CharacterId; intimacyLevel: number; justUnlocked: CharacterId | null } | null = null
    if (req.isAuthenticated && req.user) {
      try {
        const intimacy = await incrementCharacterIntimacy(req.user.userId, KOKUU_CHARACTER_ID)
        let justUnlocked: CharacterId | null = null
        const unlock = INTIMACY_UNLOCKS.find((u) => u.characterId !== undefined && u.level === intimacy.intimacyLevel)
        if (unlock?.characterId !== undefined) {
          const { wasNewlyUnlocked } = await unlockCharacter(req.user.userId, unlock.characterId)
          if (wasNewlyUnlocked) justUnlocked = unlock.characterId
        }
        intimacyResult = { characterId: KOKUU_CHARACTER_ID, intimacyLevel: intimacy.intimacyLevel, justUnlocked }
      } catch (error) {
        console.error('Failed to update character intimacy (seimei):', error)
      }
    }

    let analysis = 'LLM API が未設定です。五格の計算結果は、上の通りです。'
    let llmSucceeded = false
    if (process.env.GEMINI_API_KEY) {
      try {
        const llm = await generateFromPrompt(buildSeimeiPrompt(result, concernText))
        analysis = llm.analysis
        llmSucceeded = true
      } catch (error) {
        console.error('Seimei LLM generation error:', error)
        // 失敗した診断は、1日の回数に数えない
        res.locals.diagnosisFailed = true
        analysis = `LLM生成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
        if (shouldChargeStone) {
          try {
            stoneBalance = await refundStoneForDiagnosis(req.user!.userId, SEIMEI_STONE_COST)
          } catch (refundError) {
            console.error('Failed to refund stone after LLM failure (seimei):', refundError)
          }
        }
      }
    }

    if (llmSucceeded && req.isAuthenticated && req.user) {
      try {
        const header =
          `【姓名判断】${surname.trim()} ${givenName.trim()}\n` +
          result.kaku.map((k) => `${k.label} ${k.strokes}画（${k.level}・${k.keyword}）`).join(' ／ ')
        await saveReading({
          userId: req.user.userId,
          concern: concernText,
          analysis: `${header}\n\n${analysis}`,
          characterId: KOKUU_CHARACTER_ID,
          baziKey: `seimei:${uuidv4()}`,
        })
      } catch (error) {
        console.error('Failed to save reading (seimei):', error)
      }
    }

    res.json({ success: true, result, analysis, intimacy: intimacyResult, stoneBalance })
  } catch (error) {
    console.error('Seimei diagnosis API error:', error)
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

export default router

/**
 * AI占いアプリ バックエンドサーバー
 * Express + TypeScript
 */

import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

import { calculateBaZi, calculateLifePathNumber, calculateKyuseiSeisun } from './fortune/index.js'
import { generateFortuneAnalysis } from './llm/client.js'
import { buildLLMPrompt } from './llm/prompt.js'
import { fortuneCache } from './llm/cache.js'
import { dailyLimiter } from './middleware/rateLimit.js'

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

// ========== API Routes ==========

/**
 * ヘルスチェック
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

/**
 * 占い診断エンドポイント
 * POST /api/fortune
 */
app.post('/api/fortune', dailyLimiter, async (req: Request, res: Response) => {
  try {
    const { birthDate, birthTime, birthPlace, concern } = req.body

    // バリデーション
    if (!birthDate) {
      return res.status(400).json({ error: 'birthDate is required' })
    }
    if (!concern) {
      return res.status(400).json({ error: 'concern is required' })
    }

    // 占術計算
    const baZi = calculateBaZi(birthDate, birthTime)
    const numerology = calculateLifePathNumber(birthDate)
    const kyuseiSeisun = calculateKyuseiSeisun(birthDate)

    const baziKey = `${baZi.yearPillar.stem}${baZi.yearPillar.branch}-${baZi.monthPillar.stem}${baZi.monthPillar.branch}-${baZi.dayPillar.stem}${baZi.dayPillar.branch}-${baZi.timePillar.stem}${baZi.timePillar.branch}`

    // キャッシュ確認
    const cachedResult = fortuneCache.get(baziKey, concern)
    if (cachedResult) {
      console.log('[CACHE HIT]', baziKey)
      return res.json({
        success: true,
        reading: {
          baZi,
          numerology,
          kyuseiSeisun,
          analysis: cachedResult,
          cached: true
        }
      })
    }

    // LLMで診断文生成
    let analysis = 'LLM API が未設定です。占術計算結果は以下の通りです。'
    let tokensUsed = 0

    if (process.env.ANTHROPIC_API_KEY) {
      const prompt = buildLLMPrompt(baZi, numerology, kyuseiSeisun, concern)
      try {
        const llmResult = await generateFortuneAnalysis(prompt, concern)
        analysis = llmResult.analysis
        tokensUsed = llmResult.tokensUsed
      } catch (error) {
        console.error('LLM generation error:', error)
        // LLM失敗時も計算結果は返す
        analysis = `LLM生成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }

    // キャッシュに保存
    fortuneCache.set(baziKey, concern, analysis)

    res.json({
      success: true,
      reading: {
        baZi,
        numerology,
        kyuseiSeisun,
        analysis,
        tokensUsed,
        cached: false
      }
    })
  } catch (error) {
    console.error('Fortune API error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * 感想投稿エンドポイント
 * POST /api/feedback
 */
app.post('/api/feedback', (req: Request, res: Response) => {
  try {
    const { readingId, comment } = req.body

    if (!readingId || !comment) {
      return res.status(400).json({ error: 'readingId and comment are required' })
    }

    // Phase1ではメモリに保存(将来DBに変更)
    console.log(`[FEEDBACK] Reading: ${readingId}, Comment: ${comment}`)

    res.json({
      success: true,
      message: 'Feedback recorded'
    })
  } catch (error) {
    console.error('Feedback API error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * キャッシュ統計
 */
app.get('/api/cache-stats', (req: Request, res: Response) => {
  res.json(fortuneCache.stats())
})

// ========== Error Handling ==========

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' })
})

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', err)
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  })
})

// ========== Server Startup ==========

app.listen(PORT, () => {
  console.log(`🔮 Fortune Telling API Server running on http://localhost:${PORT}`)
  console.log(`   Health: http://localhost:${PORT}/health`)
  console.log(`   API: POST http://localhost:${PORT}/api/fortune`)
  console.log(`   Env: ${process.env.NODE_ENV || 'development'}`)
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  ANTHROPIC_API_KEY not set. LLM features will be disabled.')
  }
})

export default app

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
import { authMiddleware, requireAuth } from './middleware/auth.js'
import { verifyGoogleToken } from './auth/googleAuth.js'
import { generateToken, generateUserId } from './auth/jwt.js'
import { getUserByGoogleId, createUser, initializeDatabase, testConnection } from './db/client.js'

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true
}))
app.use(express.json({ limit: '10mb' }))
app.use(authMiddleware)

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

// ========== Authentication Routes ==========

/**
 * Google OAuth ログイン
 * POST /api/auth/google
 * Body: { idToken: string }
 */
app.post('/api/auth/google', async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body

    if (!idToken) {
      return res.status(400).json({ error: 'idToken is required' })
    }

    // Google トークンを検証
    const googleUser = await verifyGoogleToken(idToken)
    console.log(`[AUTH] Google user verified: ${googleUser.email}`)

    // ユーザーが存在するか確認
    let user = await getUserByGoogleId(googleUser.googleId)

    if (!user) {
      // 新規ユーザーを作成
      const userId = generateUserId()
      user = await createUser(
        userId,
        googleUser.googleId,
        googleUser.email,
        googleUser.name,
        googleUser.picture
      )
      console.log(`[AUTH] New user created: ${googleUser.email}`)
    }

    // JWT トークンを生成
    const token = generateToken({
      userId: user.id,
      email: user.email,
      googleId: user.google_id
    })

    res.json({
      success: true,
      token,
      user: {
        userId: user.id,
        email: user.email,
        name: user.name
      }
    })
  } catch (error) {
    console.error('Google auth error:', error)
    res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed'
    })
  }
})

/**
 * ログアウト
 * POST /api/auth/logout
 */
app.post('/api/auth/logout', (req: Request, res: Response) => {
  // クライアント側でトークンを削除
  res.json({
    success: true,
    message: 'Logged out successfully'
  })
})

/**
 * 現在のユーザー情報
 * GET /api/auth/me
 */
app.get('/api/auth/me', requireAuth, (req: Request, res: Response) => {
  res.json({
    success: true,
    user: req.user
  })
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

async function startServer() {
  try {
    // DB接続テスト
    const connected = await testConnection()
    if (connected) {
      await initializeDatabase()
    } else {
      console.warn('⚠️  Database connection failed. Some features may be unavailable.')
    }
  } catch (error) {
    console.error('Database initialization error:', error)
    // DB エラーでもサーバーは起動する（Phase 1 の仕様）
  }

  app.listen(PORT, () => {
    console.log(`🔮 Fortune Telling API Server running on http://localhost:${PORT}`)
    console.log(`   Health: http://localhost:${PORT}/health`)
    console.log(`   Auth: POST http://localhost:${PORT}/api/auth/google`)
    console.log(`   API: POST http://localhost:${PORT}/api/fortune`)
    console.log(`   Env: ${process.env.NODE_ENV || 'development'}`)
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('⚠️  ANTHROPIC_API_KEY not set. LLM features will be disabled.')
    }
    if (!process.env.GOOGLE_CLIENT_ID) {
      console.warn('⚠️  GOOGLE_CLIENT_ID not set. Google OAuth will be disabled.')
    }
  })
}

startServer()

export default app

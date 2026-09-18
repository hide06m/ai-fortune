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
import characterRoutes from './routes/character.js'
import { initializeUserCharacterIntimacies, incrementCharacterIntimacy, unlockCharacter } from './db/character.js'
import { INTIMACY_UNLOCKS, CharacterId } from './types/character.js'
import ttsRoutes from './routes/tts.js'

const app = express()
const PORT = process.env.PORT || 3000

// ✅ 1つのルート（例: TTSでVOICEVOX Engineが未起動の場合など）でサーバー全体が落ちないようにする
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason)
})
process.on('uncaughtException', (error) => {
  console.error('[UNCAUGHT EXCEPTION]', error)
})

// Middleware
// CORS_ORIGINS（カンマ区切り）が設定されていればそれを使用、未設定時は開発用のlocalhostのみ許可。
// 本番デプロイ時は環境変数に本番フロントエンドのURLを設定すること。
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', 'http://127.0.0.1:5173']

app.use(cors({
  origin: corsOrigins,
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
 * Body: { code: string } or { idToken: string }
 */
app.post('/api/auth/google', async (req: Request, res: Response) => {
  try {
    console.log('[AUTH] Request body received:', req.body)
    const { code, idToken } = req.body
    console.log('[AUTH] code:', code, '| idToken:', idToken)
    let googleUser: any

    // idToken が authorization code の場合も処理（フロントエンド側の authenticateWithGoogle で送信）
    const authCode = code || (idToken && idToken.startsWith('4/') ? idToken : null)
    const jwtToken = idToken && !idToken.startsWith('4/') ? idToken : null

    if (authCode) {
      // authorization_code から id_token に交換
      console.log('[AUTH] Exchanging authorization code for tokens...')
      console.log('[AUTH] authCode:', authCode)
      console.log('[AUTH] client_id:', process.env.GOOGLE_CLIENT_ID ? '✓ set' : '✗ NOT SET')
      console.log('[AUTH] client_secret:', process.env.GOOGLE_CLIENT_SECRET ? '✓ set' : '✗ NOT SET')

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: authCode,
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          redirect_uri: 'http://localhost:5173',
          grant_type: 'authorization_code'
        }).toString()
      })

      console.log('[AUTH] Token response status:', tokenResponse.status)

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text()
        console.error('[AUTH] Failed to exchange code for token:', errorText)
        return res.status(401).json({ error: 'Failed to exchange authorization code', details: errorText })
      }

      const tokenData = (await tokenResponse.json()) as Record<string, unknown>
      console.log('[AUTH] Token response data:', Object.keys(tokenData))
      const exchangedIdToken = tokenData.id_token as string | undefined

      if (!exchangedIdToken) {
        console.error('[AUTH] No id_token in response. Response keys:', Object.keys(tokenData))
        return res.status(401).json({ error: 'No id_token in response' })
      }

      // id_token を検証
      googleUser = await verifyGoogleToken(exchangedIdToken)
      console.log(`[AUTH] Google user verified (code exchange): ${googleUser.email}`)
    } else if (jwtToken) {
      // idToken（JWT）から検証
      googleUser = await verifyGoogleToken(jwtToken)
      console.log(`[AUTH] Google user verified (idToken): ${googleUser.email}`)
    } else {
      return res.status(400).json({ error: 'authorization code or valid idToken is required' })
    }

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

      // ✅ 新規ユーザーのキャラクター親密度を初期化
      try {
        await initializeUserCharacterIntimacies(user.id)
        console.log(`[AUTH] Initialized character intimacies for user: ${googleUser.email}`)
      } catch (error) {
        console.warn('[AUTH] Failed to initialize character intimacies:', error)
        // 初期化失敗でも認証は続行
      }
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
    const { birthDate, birthTime, birthPlace, concern, characterId } = req.body

    // バリデーション
    if (!birthDate) {
      return res.status(400).json({ error: 'birthDate is required' })
    }
    if (!concern) {
      return res.status(400).json({ error: 'concern is required' })
    }

    // 親密度更新（ログインユーザーがキャラクターを指定した場合のみ）
    // ゲストや未指定時はスキップ。キャラ選択画面の解放条件（INTIMACY_UNLOCKS）に達したら自動解放する。
    let intimacyResult: { characterId: CharacterId; intimacyLevel: number; justUnlocked: CharacterId | null } | null = null
    if (req.isAuthenticated && req.user && Number.isInteger(characterId) && characterId >= 0 && characterId <= 4) {
      try {
        const userId = req.user.userId
        const charId = characterId as CharacterId
        const intimacy = await incrementCharacterIntimacy(userId, charId)

        let justUnlocked: CharacterId | null = null
        const unlock = INTIMACY_UNLOCKS.find(
          (u) => u.characterId !== undefined && u.level === intimacy.intimacyLevel
        )
        if (unlock?.characterId !== undefined) {
          await unlockCharacter(userId, unlock.characterId)
          justUnlocked = unlock.characterId
        }

        intimacyResult = { characterId: charId, intimacyLevel: intimacy.intimacyLevel, justUnlocked }
      } catch (error) {
        // 親密度更新に失敗しても診断結果は返す
        console.error('Failed to update character intimacy:', error)
      }
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
        },
        intimacy: intimacyResult
      })
    }

    // LLMで診断文生成
    let analysis = 'LLM API が未設定です。占術計算結果は以下の通りです。'
    let tokensUsed = 0

    if (process.env.GEMINI_API_KEY) {
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
      },
      intimacy: intimacyResult
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

// ========== Character Routes ==========
app.use('/api/character', characterRoutes)

// ========== Text-to-Speech Routes ==========
app.use('/api/tts', ttsRoutes)

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
    if (!process.env.GEMINI_API_KEY) {
      console.warn('⚠️  GEMINI_API_KEY not set. LLM features will be disabled.')
    }
    if (!process.env.GOOGLE_CLIENT_ID) {
      console.warn('⚠️  GOOGLE_CLIENT_ID not set. Google OAuth will be disabled.')
    }
  })
}

startServer()

export default app

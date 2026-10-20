/**
 * AI占いアプリ バックエンドサーバー
 * Express + TypeScript
 */

// 他の import より先に、OSの証明書ストアを信頼する設定を読み込む（セキュリティソフトのあるPCで外向きHTTPSが失敗しないように）
import './tlsTrust.js'
import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

// 安全装置：本番では、開発専用のテスト用ログイン（DEV_LOGIN）を、設定されていても、必ず無効にする
if (process.env.NODE_ENV === 'production' && process.env.DEV_LOGIN) {
  console.error('❌ 本番環境で DEV_LOGIN が設定されています。無効にして起動します（設定を外してください）')
  delete process.env.DEV_LOGIN
}

import { calculateBaZi, calculateLifePathNumber, calculateKyuseiSeisun, calculateWesternZodiac } from './fortune/index.js'
import { generateFortuneAnalysis } from './llm/client.js'
import { buildLLMPrompt } from './llm/prompt.js'
import { buildWesternAstrologyPrompt } from './llm/westernAstrologyPrompt.js'
import { fortuneCache } from './llm/cache.js'
import { dailyLimiter } from './middleware/rateLimit.js'
import { authMiddleware, requireAuth } from './middleware/auth.js'
import { verifyGoogleToken } from './auth/googleAuth.js'
import { generateToken, generateUserId } from './auth/jwt.js'
import { getUserByGoogleId, createUser, initializeDatabase, testConnection, query } from './db/client.js'
import characterRoutes from './routes/character.js'
import { initializeUserCharacterIntimacies, incrementCharacterIntimacy, unlockCharacter } from './db/character.js'
import { INTIMACY_UNLOCKS, CharacterId, DIAGNOSIS_STONE_COST } from './types/character.js'
import ttsRoutes from './routes/tts.js'
import stonesRoutes from './routes/stones.js'
import inboxRoutes from './routes/inbox.js'
import adminRoutes from './routes/admin.js'
import accountRoutes from './routes/account.js'
import { createMessage } from './db/inbox.js'
import { grantSignupBonus, SIGNUP_BONUS_STONES, spendStoneForDiagnosis, refundStoneForDiagnosis } from './db/stones.js'
import readingsRoutes from './routes/readings.js'
import { saveReading, findDuplicateReading } from './db/readings.js'
import compatibilityRoutes from './routes/compatibility.js'
import mbtiRoutes from './routes/mbti.js'
import loveType64Routes from './routes/loveType64.js'
import palmSessionRoutes from './routes/palmSession.js'
import palmistryRoutes from './routes/palmistry.js'
import seimeiRoutes from './routes/seimei.js'
import musubiRoutes from './routes/musubi.js'
import { llmFailed } from './routes/llmFailure.js'
import { isValidPastDate } from './fortune/dateCheck.js'
import { requireUnlocked } from './middleware/requireUnlocked.js'
import sukuyouRoutes from './routes/sukuyou.js'
import resultsRoutes from './routes/results.js'
import { captureLatestResult } from './middleware/latestResult.js'
import { inFlightGuard } from './middleware/inFlightGuard.js'
import { asyncJob } from './middleware/asyncJob.js'
import jobsRoutes from './routes/jobs.js'
import dailyRoutes from './routes/daily.js'
import collectionRoutes from './routes/collection.js'
import peopleRoutes, { inviteRouter } from './routes/people.js'
import minigameRoutes from './routes/minigame.js'
import { closeStaleJobs } from './db/jobs.js'
import { llmConcurrencyState } from './llm/concurrency.js'

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
app.get('/health', async (req: Request, res: Response) => {
  // データベースにつながるかも確認する（つながらないときは 503。監視・自動復旧の目印になる）
  let db: 'ok' | 'down' = 'ok'
  try {
    await query('SELECT 1')
  } catch {
    db = 'down'
  }
  res.status(db === 'ok' ? 200 : 503).json({ status: db === 'ok' ? 'ok' : 'degraded', db, llm: llmConcurrencyState(), timestamp: new Date().toISOString() })
})

// ========== Authentication Routes ==========

/**
 * Google OAuth ログイン
 * POST /api/auth/google
 * Body: { code: string } or { idToken: string }
 */
app.post('/api/auth/google', async (req: Request, res: Response) => {
  try {
    const { code, idToken } = req.body
    let googleUser: any

    // idToken が authorization code の場合も処理（フロントエンド側の authenticateWithGoogle で送信）
    const authCode = code || (idToken && idToken.startsWith('4/') ? idToken : null)
    const jwtToken = idToken && !idToken.startsWith('4/') ? idToken : null

    if (authCode) {
      // authorization_code から id_token に交換
      console.log('[AUTH] Exchanging authorization code for tokens...')
      console.log('[AUTH] client_id:', process.env.GOOGLE_CLIENT_ID ? '✓ set' : '✗ NOT SET')
      console.log('[AUTH] client_secret:', process.env.GOOGLE_CLIENT_SECRET ? '✓ set' : '✗ NOT SET')

      // redirect_uri は、フロントの呼び出し方で決まる。ポップアップ方式なら "postmessage"、それ以外は、ページのオリジン。
      // 本番では、本番のURLになるので、固定の localhost にせず、順に試す（認可コードは、不一致のときは、消費されない）
      const reqOrigin = typeof req.headers.origin === 'string' && corsOrigins.includes(req.headers.origin) ? req.headers.origin : null
      const redirectCandidates = [...new Set(['postmessage', reqOrigin, 'http://localhost:5173'].filter((v): v is string => !!v))]
      let tokenResponse: globalThis.Response | null = null
      for (const redirectUri of redirectCandidates) {
        tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code: authCode,
            client_id: process.env.GOOGLE_CLIENT_ID || '',
            client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
          }).toString()
        })
        if (tokenResponse.ok) {
          console.log('[AUTH] redirect_uri accepted:', redirectUri)
          break
        }
        const peek = await tokenResponse.clone().text()
        console.warn(`[AUTH] redirect_uri "${redirectUri}" rejected:`, peek.replace(/\s+/g, ' ').slice(0, 160))
        if (!peek.includes('redirect_uri_mismatch')) break // 別の理由（期限切れなど）は、やり直しても、同じ
      }
      if (!tokenResponse) return res.status(401).json({ error: 'Failed to exchange authorization code' })

      console.log('[AUTH] Token response status:', tokenResponse.status)

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text()
        console.error('[AUTH] Failed to exchange code for token:', errorText)
        return res.status(401).json({ error: 'Failed to exchange authorization code' })
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
    const isNewUser = !user

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

      // ✅ 新規登録ボーナス（+3石）
      try {
        await grantSignupBonus(user.id)
        console.log(`[AUTH] Granted signup bonus for user: ${googleUser.email}`)
        // 受信箱に、ようこその知らせ（もらった石の記録として残す。石は、すでに渡してある）
        await createMessage({
          userId: user.id,
          kind: 'welcome',
          title: 'ようこそ 占いの森へ',
          body: `新規登録のお祝いに、ルーンストーンを${SIGNUP_BONUS_STONES}個お渡ししました。\nルーンストーンは占いに使えます。ホームの石の数をおすと、残りや増減の記録を見られます。\nどうぞごゆっくり。`,
          stones: 0,
        })
      } catch (error) {
        console.warn('[AUTH] Failed to grant signup bonus:', error)
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
      isNewUser,
      // 新規登録ボーナスで渡した石の数（初回ログインで、画面で、伝えるため）
      signupBonus: isNewUser ? SIGNUP_BONUS_STONES : 0,
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
 * 開発専用：テスト用アカウントでログインする（Googleのログインを通さずに、ログイン後の画面を確認するため）
 * POST /api/auth/dev-login   body: { fresh?: boolean, stones?: number, intimacy?: number }
 *   intimacy … 全キャラの親密度を 0〜10 にして、全員を解放する（解放後の画面を確認するため）
 *
 * 次の条件がすべて揃ったときだけ動く（どれか1つでも欠ければ 404）：
 *   - NODE_ENV=development で、環境変数 DEV_LOGIN=1 を付けて起動している
 *   - このPCの中からの直接アクセス（トンネル・プロキシ経由のヘッダー、localhost以外のHostは拒否）
 * 使うのは専用のテスト用アカウント（本人のGoogleアカウントとは別。石や履歴も別）。
 *   fresh=true なら、テスト用アカウントを作り直す（初回ログイン＝チュートリアルから確認できる）
 */
function isLocalDevRequest(req: Request): boolean {
  if (process.env.NODE_ENV !== 'development' || process.env.DEV_LOGIN !== '1') return false
  const h = req.headers
  // トンネル（Cloudflare）やプロキシを通ったリクエストには、これらのヘッダーが付く
  // （Vite の中継は Host を書き換えるので、Host だけでは、トンネル経由かどうかを見分けられない。ヘッダーで見分ける）
  const viaProxy = Object.keys(h).some(
    (name) => name.startsWith('cf-') || name.startsWith('x-forwarded') || name === 'forwarded' || name === 'cdn-loop' || name === 'true-client-ip' || name === 'x-real-ip'
  )
  if (viaProxy) return false
  const host = String(h.host || '').replace(/:\d+$/, '')
  if (!['localhost', '127.0.0.1', '[::1]'].includes(host)) return false
  const addr = req.socket.remoteAddress || ''
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'
}

app.post('/api/auth/dev-login', async (req: Request, res: Response) => {
  if (!isLocalDevRequest(req)) return res.status(404).json({ error: 'Not found' })
  try {
    const DEV_GOOGLE_ID = 'dev-tester-local'
    const DEV_EMAIL = 'dev-tester@localhost.invalid'
    if (req.body?.fresh === true) {
      // テスト用アカウントだけを消す（診断履歴・親密度・石の履歴は ON DELETE CASCADE で一緒に消える）
      await query('DELETE FROM users WHERE google_id = $1', [DEV_GOOGLE_ID])
    }
    let user = await getUserByGoogleId(DEV_GOOGLE_ID)
    const isNewUser = !user
    if (!user) {
      user = await createUser(generateUserId(), DEV_GOOGLE_ID, DEV_EMAIL, 'テスト用アカウント', '')
      await initializeUserCharacterIntimacies(user.id)
      await grantSignupBonus(user.id)
    }
    if (typeof req.body?.stones === 'number' && Number.isFinite(req.body.stones)) {
      await query('UPDATE users SET stone_balance = $1 WHERE id = $2', [Math.max(0, Math.round(req.body.stones)), user.id])
    }
    if (typeof req.body?.intimacy === 'number' && Number.isFinite(req.body.intimacy)) {
      const level = Math.min(10, Math.max(0, Math.round(req.body.intimacy)))
      await query(
        'UPDATE character_intimacy SET intimacy_level = $1, intimacy_points = $2, unlocked_at = COALESCE(unlocked_at, NOW()) WHERE user_id = $3',
        [level, level * 100, user.id]
      )
    }
    const token = generateToken({ userId: user.id, email: user.email, googleId: user.google_id })
    res.json({ success: true, token, isNewUser, signupBonus: isNewUser ? SIGNUP_BONUS_STONES : 0, user: { userId: user.id, email: user.email, name: user.name } })
  } catch (error) {
    console.error('Dev login error:', error)
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'dev login failed' })
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
app.post('/api/fortune', asyncJob((req) => (req.body?.characterId === 2 ? 'fortune:2' : 'fortune:1')), captureLatestResult({
  // ナツメ（1）とツキ（2）の結果を、別々に保存する
  kind: (req) => (req.body?.characterId === 1 ? 'fortune:1' : req.body?.characterId === 2 ? 'fortune:2' : null),
  payload: (b) => b.reading ?? null,
}), requireUnlocked((req) => (req.body?.characterId === 2 ? 2 : 1)), inFlightGuard, dailyLimiter, async (req: Request, res: Response) => {
  try {
    const { birthDate, birthTime, birthPlace, concern, characterId } = req.body

    // バリデーション（悩み・状況は任意。未入力時は総合的な診断を行う）
    if (!birthDate) {
      return res.status(400).json({ error: 'birthDate is required' })
    }
    if (!isValidPastDate(birthDate)) {
      return res.status(400).json({ success: false, error: 'INVALID_BIRTH_DATE', message: '生年月日を、正しく入力してください（未来の日付や、存在しない日付は使えません）' })
    }

    // 指定キャラの妥当性チェックと、キャラごとの必要石数（未選択・不正値なら1個扱い）
    const charId: CharacterId | null =
      req.isAuthenticated && req.user && Number.isInteger(characterId) && characterId >= 0 && characterId <= 4
        ? (characterId as CharacterId)
        : null
    const stoneCost = charId !== null ? DIAGNOSIS_STONE_COST[charId] : 1

    // ツキ（キャラID2）だけ西洋占星術を使う。それ以外は従来通り四柱推命等を使う
    const isAstrology = charId === 2

    // 占術計算（四柱推命等は baziKey 生成のためツキの場合も計算する。西洋占星術はツキの場合のみ追加で計算）
    const baZi = calculateBaZi(birthDate, birthTime)
    const numerology = calculateLifePathNumber(birthDate)
    const kyuseiSeisun = calculateKyuseiSeisun(birthDate)
    const westernZodiac = isAstrology ? calculateWesternZodiac(birthDate) : null

    const baziKey = `${baZi.yearPillar.stem}${baZi.yearPillar.branch}-${baZi.monthPillar.stem}${baZi.monthPillar.branch}-${baZi.dayPillar.stem}${baZi.dayPillar.branch}-${baZi.timePillar.stem}${baZi.timePillar.branch}`
    // 占術方式が違うと同じ生年月日でも診断内容が変わるため、キャッシュ／重複判定のキーを方式ごとに分ける
    // （四柱推命の baziKey 自体はツキの場合でも計算しているが、あくまで内部的なキャッシュキーの一部として流用しているだけ）
    const diagnosisKey = isAstrology ? `astro:${baziKey}` : baziKey

    // 重複診断のブロック（ログイン済み・悩み未入力の場合のみ）：
    // 過去の診断結果はいつでも見返せる仕組みのため、同じ命式・悩みなしで再度診断しようとした場合は
    // 新規のLLM呼び出し・石消費を行わず、過去の結果を案内する
    const hasConcern = !!concern && concern.trim().length > 0
    if (req.isAuthenticated && req.user && !hasConcern) {
      try {
        const duplicate = await findDuplicateReading(req.user.userId, diagnosisKey)
        if (duplicate) {
          return res.json({
            success: true,
            duplicate: true,
            existingReadingId: duplicate.id,
            existingCreatedAt: duplicate.createdAt,
            message: 'ちょっと待って、前も全く同じ内容で占ってるよ'
          })
        }
      } catch (error) {
        // 重複チェックに失敗しても診断自体は続行する
        console.error('Failed to check duplicate reading:', error)
      }
    }

    // 親密度更新（ログインユーザーがキャラクターを指定した場合のみ）。
    // キャッシュヒット時も「相談した」ことに変わりはないため加算するが、石を実際に使った後
    // （＝キャッシュミスでLLMを呼ぶ場合）は石の消費が確定してから加算するよう、呼び出し側で順序を制御する。
    // キャラ選択画面の解放条件（INTIMACY_UNLOCKS）に達したら自動解放する。
    let intimacyResult: { characterId: CharacterId; intimacyLevel: number; justUnlocked: CharacterId | null } | null = null
    const applyIntimacyForDiagnosis = async () => {
      if (charId === null || !req.user) return
      try {
        const userId = req.user.userId
        const intimacy = await incrementCharacterIntimacy(userId, charId)

        let justUnlocked: CharacterId | null = null
        const unlock = INTIMACY_UNLOCKS.find(
          (u) => u.characterId !== undefined && u.level === intimacy.intimacyLevel
        )
        if (unlock?.characterId !== undefined) {
          const { wasNewlyUnlocked } = await unlockCharacter(userId, unlock.characterId)
          if (wasNewlyUnlocked) justUnlocked = unlock.characterId
        }

        intimacyResult = { characterId: charId, intimacyLevel: intimacy.intimacyLevel, justUnlocked }
      } catch (error) {
        // 親密度更新に失敗しても診断結果は返す
        console.error('Failed to update character intimacy:', error)
      }
    }

    // キャッシュ確認（石を使わずに結果を返せるケース。ここでも親密度は加算する）
    const cachedResult = fortuneCache.get(diagnosisKey, concern)
    if (cachedResult) {
      console.log('[CACHE HIT]', diagnosisKey)

      await applyIntimacyForDiagnosis()

      // ログイン済みなら診断履歴に保存（失敗しても診断結果は返す）
      if (req.isAuthenticated && req.user) {
        try {
          await saveReading({
            userId: req.user.userId,
            birthDate, birthTime, birthPlace, concern,
            baZi, numerology, kyuseiSeisun, westernZodiac,
            analysis: cachedResult,
            characterId: Number.isInteger(characterId) ? characterId : null,
            baziKey: diagnosisKey,
          })
        } catch (error) {
          console.error('Failed to save reading (cache hit):', error)
        }
      }

      return res.json({
        success: true,
        reading: {
          baZi,
          numerology,
          kyuseiSeisun,
          westernZodiac,
          analysis: cachedResult,
          cached: true
        },
        intimacy: intimacyResult
      })
    }

    // 石の消費（ログイン済みユーザーがLLMを実際に呼ぶ場合のみ。キャッシュヒット時・ゲスト・
    // LLM未設定時は消費しない。ゲストは引き続きIP単位の1日1回制限のみで保護する）。
    // 親密度は「石の消費に成功した後」にのみ加算する（残高不足で402を返す場合に加算してしまわないため）。
    const shouldChargeStone = !!(req.isAuthenticated && req.user && process.env.GEMINI_API_KEY)
    let stoneBalance: number | null = null
    if (shouldChargeStone) {
      try {
        stoneBalance = await spendStoneForDiagnosis(req.user!.userId, stoneCost)
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

    // 親密度は、診断が成功してから加算する（失敗した診断で、親密度だけ上がらないように）

    // LLMで診断文生成
    let analysis = 'LLM API が未設定です。占術計算結果は以下の通りです。'
    let tokensUsed = 0
    let llmSucceeded = false

    if (process.env.GEMINI_API_KEY) {
      const prompt = isAstrology && westernZodiac
        ? buildWesternAstrologyPrompt(westernZodiac, concern, birthPlace)
        : buildLLMPrompt(baZi, numerology, kyuseiSeisun, concern, birthPlace)
      try {
        const llmResult = await generateFortuneAnalysis(prompt, concern)
        analysis = llmResult.analysis
        tokensUsed = llmResult.tokensUsed
        llmSucceeded = true
      } catch (error) {
        console.error('LLM generation error:', error)
        // 失敗した診断は、1日の回数に数えない（利用者のせいではないため。rateLimit の requestWasSuccessful が見る）
        res.locals.diagnosisFailed = true
        // LLM失敗時も計算結果は返す。消費した石は払い戻す。
        analysis = `LLM生成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
        if (shouldChargeStone) {
          try {
            stoneBalance = await refundStoneForDiagnosis(req.user!.userId, stoneCost)
          } catch (refundError) {
            console.error('Failed to refund stone after LLM failure:', refundError)
          }
        }
      }
    }

    // AIの生成に失敗したときは、成功の形で返さず、失敗として返す（石は、払い戻し済み）
    if (res.locals.diagnosisFailed) return llmFailed(res, stoneBalance)

    await applyIntimacyForDiagnosis()

    // キャッシュに保存（LLM失敗時のエラーメッセージを「診断結果」として24時間キャッシュしてしまわないよう、成功時のみ保存）
    if (llmSucceeded) {
      fortuneCache.set(diagnosisKey, concern, analysis)
    }

    // ログイン済み・LLM生成成功時のみ診断履歴に保存（失敗しても診断結果は返す）
    if (llmSucceeded && req.isAuthenticated && req.user) {
      try {
        await saveReading({
          userId: req.user.userId,
          birthDate, birthTime, birthPlace, concern,
          baZi, numerology, kyuseiSeisun, westernZodiac,
          analysis,
          characterId: Number.isInteger(characterId) ? characterId : null,
          baziKey: diagnosisKey,
        })
      } catch (error) {
        console.error('Failed to save reading:', error)
      }
    }

    res.json({
      success: true,
      reading: {
        baZi,
        numerology,
        kyuseiSeisun,
        westernZodiac,
        analysis,
        tokensUsed,
        cached: false
      },
      intimacy: intimacyResult,
      stoneBalance
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

// ========== Stone (石) Routes ==========
app.use('/api/stones', stonesRoutes)
app.use('/api/inbox', inboxRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/account', accountRoutes)

// ========== Reading History Routes ==========
app.use('/api/readings', readingsRoutes)

// ========== Compatibility (相性診断) Routes ==========
app.use('/api/compatibility', compatibilityRoutes)
app.use('/api/fortune/mbti', mbtiRoutes)
app.use('/api/fortune/love-type64', loveType64Routes)
app.use('/api/palm-session', palmSessionRoutes)
app.use('/api/fortune/palmistry', palmistryRoutes)
app.use('/api/fortune/seimei', seimeiRoutes)
app.use('/api/fortune/musubi', musubiRoutes)
app.use('/api/fortune/sukuyou', sukuyouRoutes)
app.use('/api/results', resultsRoutes)
app.use('/api/jobs', jobsRoutes)
app.use('/api/daily', dailyRoutes)
app.use('/api', collectionRoutes)
app.use('/api/people', peopleRoutes)
app.use('/api/invite', inviteRouter)
app.use('/api/minigame', minigameRoutes)

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
      // 前回、サーバーが止まったときに、途中だった診断の受付を閉じる
      await closeStaleJobs().catch((e) => console.error('closeStaleJobs failed:', e))
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

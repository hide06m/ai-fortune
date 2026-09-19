import { useState, useEffect } from 'react'
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google'
import Markdown from 'react-markdown'
import './App.css'
import {
  callFortuneAPI,
  submitFeedback,
  authenticateWithGoogle,
  logout,
  isAuthenticated,
  getUserEmail,
  setUserEmail as saveUserEmail,
  type FortuneRequest
} from './api'
import { speakResult, isVoiceEnabled } from './services/textToSpeech'
import { CHARACTER_MASTER_DATA, type CharacterId } from './types/character'
import { getStoneBalance, claimDailyBonus, watchAdForStone } from './api/stones'
import {
  initAudio,
  startAmbientLoop,
  stopAmbientLoop,
  playKnock,
  playDoorOpen,
  switchToRoomBGM
} from './audio'
import { CharacterSelectionPage } from './pages/CharacterSelectionPage'
import { HamsterLoading } from './components/HamsterLoading'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

function AppContent() {
  // Authentication state
  const [authenticated, setAuthenticated] = useState(isAuthenticated())
  const [authLoading, setAuthLoading] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  // Screen state
  const [screen, setScreen] = useState<'landing' | 'door' | 'character-selection' | 'form' | 'result'>('landing')
  const [doorState, setDoorState] = useState<'closed' | 'knocking' | 'open'>('closed')
  const [doorExiting, setDoorExiting] = useState(false)  // ✅ door から form への遷移アニメーション
  const [mode, setMode] = useState<'guest' | 'authenticated'>('guest')

  // Character state
  const [selectedCharacterId, setSelectedCharacterId] = useState<number>(1) // デフォルト：ナツメ

  // 石（診断に使う仮想通貨）
  const [stoneBalance, setStoneBalance] = useState<number | null>(null)
  const [stoneBonusMessage, setStoneBonusMessage] = useState('')
  const [watchingAd, setWatchingAd] = useState(false)

  // Form state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [birthTime, setBirthTime] = useState('')
  const [birthPlace, setBirthPlace] = useState('')
  const [concern, setConcern] = useState('')

  // Result state
  const [reading, setReading] = useState<any>(null)
  const [feedback, setFeedback] = useState('')
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [justUnlockedCharacter, setJustUnlockedCharacter] = useState<CharacterId | null>(null)

  // Check authentication status on mount
  useEffect(() => {
    const auth = isAuthenticated()
    setAuthenticated(auth)

    // 音声システムを初期化
    initAudio()

    // ✅ ログイン状態が保持されていても landing 画面に戻す
    // ユーザーはドアボタンを押して form 画面に遷移する体験を求めている
    if (auth) {
      console.log('🔄 [AUTH RESTORED] ログイン状態が復元されました。landing 画面に戻ります')
      setScreen('landing')
      setMode('authenticated')
      // ✅ ユーザーメールアドレスも復元
      const email = getUserEmail()
      if (email) {
        setUserEmail(email)
      }
      startAmbientLoop()
    } else {
      console.log('📍 [AUTH STATE] ログイン状態がありません')
      setScreen('landing')
    }
  }, [])

  // ログイン済みなら石残高を取得し、今日のログインボーナスを受け取る
  useEffect(() => {
    if (!authenticated) {
      setStoneBalance(null)
      return
    }
    (async () => {
      try {
        const bonus = await claimDailyBonus()
        setStoneBalance(bonus.balance)
        if (bonus.granted) {
          setStoneBonusMessage('🎁 ログインボーナス：ルーンストーン+1')
          setTimeout(() => setStoneBonusMessage(''), 4000)
        }
      } catch (err) {
        console.error('Failed to claim daily bonus:', err)
        // ボーナス取得に失敗しても残高だけは取得しておく
        try {
          const balanceResult = await getStoneBalance()
          setStoneBalance(balanceResult.balance)
        } catch (balanceErr) {
          console.error('Failed to fetch stone balance:', balanceErr)
        }
      }
    })()
  }, [authenticated])

  // 広告視聴で石を増やす（⚠️ 現状は広告ネットワーク未接続のプレースホルダー。
  // 実際の広告SDKが繋がるまでは、視聴完了を模したダミーの待機時間のみ）
  const handleWatchAd = async () => {
    setWatchingAd(true)
    setError('')
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000)) // 広告視聴を模した待機
      const result = await watchAdForStone()
      setStoneBalance(result.balance)
      if (result.granted) {
        setStoneBonusMessage('📺 広告視聴ボーナス：ルーンストーン+1')
        setTimeout(() => setStoneBonusMessage(''), 4000)
      } else if (result.reason === 'DAILY_LIMIT_REACHED') {
        setError('本日の広告視聴ボーナスは上限に達しました。')
      }
    } catch (err) {
      setError('広告視聴ボーナスの取得に失敗しました。')
    } finally {
      setWatchingAd(false)
    }
  }

  // ランディングページで背景音を開始
  useEffect(() => {
    if (screen === 'landing') {
      startAmbientLoop()
    }
  }, [screen])

  // Google OAuth ハンドラ
  const login = useGoogleLogin({
    onSuccess: async (codeResponse: any) => {
      setAuthLoading(true)
      setError('')
      try {
        console.log('🔐 Google OAuth Response:', codeResponse)
        // auth-code flow では code（認可コード）が返る
        const { code } = codeResponse
        console.log('🔐 authorization code:', code)

        // code をバックエンドに送信して、id_token に交換
        const response = await authenticateWithGoogle(code)
        if (response.success) {
          setAuthenticated(true)
          setUserEmail(response.user?.email || '')
          saveUserEmail(response.user?.email || '')  // localStorage に保存
          setMode('authenticated')
          // ✅ ドアモーションを表示させるため、door 画面に遷移
          setScreen('door')
          setDoorState('knocking')
          setDoorExiting(false)  // ✅ 初期化
          playKnock()
          console.log('✅ Logged in successfully, showing door animation')

          // ✅ ドアモーション自動進行：1.5秒後にドアを開く
          setTimeout(() => {
            setDoorState('open')
            playDoorOpen()

            // 800ms 後にズームアップ＋フェード開始
            setTimeout(() => {
              setDoorExiting(true)  // ✅ ズームアップ＋フェード開始

              // 800ms 後に form 画面に遷移
              setTimeout(() => {
                setScreen('form')
                setDoorExiting(false)  // ✅ リセット
                switchToRoomBGM()
              }, 800)
            }, 800)
          }, 1500)
        } else {
          setError(response.error || 'Authentication failed')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication failed')
      } finally {
        setAuthLoading(false)
      }
    },
    onError: () => {
      setError('Google authentication failed. Please try again.')
    },
    flow: 'auth-code',
    scope: 'openid email profile'
  })

  // ゲスト診断開始
  const handleStartGuest = () => {
    setMode('guest')
    handleDoorClick()
  }

  // ドアクリックハンドラー
  const handleDoorClick = () => {
    if (screen === 'landing') {
      // ノック状態に
      setScreen('door')
      setDoorState('knocking')
      setDoorExiting(false)  // ✅ 初期化

      // ノック音を再生
      playKnock()

      // 1.5秒後にドアを開く（door001 を 1500ms 表示）
      setTimeout(() => {
        setDoorState('open')

        // ドア開く音を再生
        playDoorOpen()

        // 800ms 後にズームアップ＋フェード開始（door002 を 800ms 表示）
        setTimeout(() => {
          setDoorExiting(true)  // ✅ ズームアップ＋フェード開始

          // 800ms 後に character-selection 画面に遷移（認証済み）or form 画面に遷移（ゲスト）
          setTimeout(() => {
            if (authenticated) {
              setScreen('character-selection')  // ✅ ログイン済み：キャラ選択画面へ
            } else {
              setScreen('form')  // ゲスト：直接 form へ
            }
            setDoorExiting(false)  // ✅ リセット
            switchToRoomBGM()
          }, 800)
        }, 800)
      }, 1500)
    }
  }

  // ログアウト
  const handleLogout = async () => {
    await logout()
    setAuthenticated(false)
    setUserEmail('')
    setScreen('landing')  // ✅ landing 画面に戻す
    setMode('guest')
    setError('')
    setBirthDate('')
    setBirthTime('')
    setBirthPlace('')
    setConcern('')
    setReading(null)
  }

  // 診断実行
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const request: FortuneRequest = {
        birthDate,
        birthTime,
        birthPlace,
        concern,
        characterId: selectedCharacterId
      }

      const response = await callFortuneAPI(request)

      if (typeof response.stoneBalance === 'number') {
        setStoneBalance(response.stoneBalance)
      }

      if (!response.success) {
        setError(response.error || 'Failed to get reading')
      } else if (response.reading) {
        setReading(response.reading)
        setJustUnlockedCharacter(
          response.intimacy?.justUnlocked !== null && response.intimacy?.justUnlocked !== undefined
            ? (response.intimacy.justUnlocked as CharacterId)
            : null
        )
        setScreen('result')

        // キャラクターの声で結果を読み上げ（音声OFF設定時・失敗時は内部で無視される）
        if (isVoiceEnabled()) {
          speakResult(selectedCharacterId as CharacterId, response.reading.analysis)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // 感想送信
  const handleSubmitFeedback = async () => {
    if (!feedback.trim()) {
      setError('Please enter your feedback')
      return
    }

    try {
      const result = await submitFeedback(`reading-${Date.now()}`, feedback)
      if (result.success) {
        setFeedbackSubmitted(true)
        setFeedback('')
      } else {
        setError(result.error || 'Failed to submit feedback')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  // 戻る
  const handleBack = () => {
    setScreen('form')
    setError('')
    setFeedback('')
    setFeedbackSubmitted(false)
    setJustUnlockedCharacter(null)
  }

  // 新しい診断
  const handleNewReading = () => {
    // ✅ フォーム入力をクリア（UI をリセット）
    setBirthDate('')
    setBirthTime('')
    setBirthPlace('')
    setConcern('')

    // ✅ 画面状態をリセット
    setScreen('form')
    setReading(null)
    setFeedback('')
    setFeedbackSubmitted(false)
    setJustUnlockedCharacter(null)

    // ⚠️ localStorage は削除しない！
    // 「新しい診断」をクリック後、form 画面で前回の入力を復元するため
    // localStorage.removeItem('formData') は呼ばない
  }

  // ✅ form データを localStorage に保存（ログインユーザーのみ、かつ値が空でない場合）
  useEffect(() => {
    if (authenticated && screen === 'form') {
      // 空のフォーム状態を上書きしないよう、少なくとも一つの値が入っている場合のみ保存
      if (birthDate || birthTime || birthPlace || concern) {
        const formData = {
          birthDate,
          birthTime,
          birthPlace,
          concern
        }
        console.log('💾 Saving form data:', formData)
        localStorage.setItem('formData', JSON.stringify(formData))
      }
    }
  }, [birthDate, birthTime, birthPlace, concern, authenticated, screen])

  // ✅ form データを localStorage から復元（ログインユーザーのみ）
  useEffect(() => {
    if (authenticated && screen === 'form' && !reading) {
      // 診断結果表示中は復元しない（新しい診断時のみ）
      const savedData = localStorage.getItem('formData')
      if (savedData) {
        try {
          const data = JSON.parse(savedData)
          console.log('📋 Saved data found:', data)
          // 値が空の場合はスキップ（既に入力中の場合を避ける）
          if (data.birthDate) {
            setBirthDate(data.birthDate)
          }
          if (data.birthTime) {
            setBirthTime(data.birthTime)
          }
          if (data.birthPlace) {
            setBirthPlace(data.birthPlace)
          }
          if (data.concern) {
            setConcern(data.concern)
          }
          console.log('✅ 前回の入力内容を復元しました')
        } catch (error) {
          console.error('Failed to restore form data:', error)
        }
      }
    }
  }, [authenticated, screen, reading])

  // ========== ランディングページ（森のイメージ） ==========
  if (screen === 'landing') {
    return (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <div className="landing-container">
          <div className="landing-bg" style={{ backgroundImage: 'url(/assets/index001.jpg)' }}>
            {/* 背景ビデオ */}
            <video
              className="landing-video"
              autoPlay
              loop
              muted
              playsInline
            >
              <source src="/assets/sunlight001.mp4" type="video/mp4" />
            </video>

            {/* ヘッダー */}
            <div className="landing-header">
              {/* ロゴ */}
              <div className="landing-title">
                <img src="/assets/rogo001.png" alt="占いの森" className="landing-logo" />
              </div>

              {/* ログイン状態表示・ログアウト */}
              <div className="landing-header-actions">
                {authenticated && <span className="landing-user-email">{userEmail}</span>}
                {authenticated && (
                  <button onClick={handleLogout} className="landing-logout-button">
                    ログアウト
                  </button>
                )}
              </div>
            </div>

            {/* ドア（ログイン済みなら form 画面へ、未ログインなら Google ログイン） */}
            <div className="landing-door-container">
              <button
                className="landing-door"
                onClick={() => authenticated ? handleDoorClick() : login()}
                disabled={authLoading}
                title={authenticated ? "ドアをクリックして診断へ進む" : "ドアをクリックして Google でログイン"}
              >
                <span className="door-text">診断へ進む</span>
              </button>
            </div>

            {/* ゲスト診断リンク */}
            <div className="landing-guest">
              <button onClick={handleStartGuest} className="guest-button">
                ゲスト診断を試す
              </button>
            </div>

            {error && <div className="error">{error}</div>}
          </div>
        </div>
      </GoogleOAuthProvider>
    )
  }

  // ========== ドア遷移ページ ==========
  if (screen === 'door') {
    return (
      <div className="door-transition-container">
        <div className={`door-transition-bg ${doorState} ${doorExiting ? 'exiting' : ''}`}>
          {doorState === 'closed' || doorState === 'knocking' ? (
            <img src="/assets/door001.jpg" alt="ドア" className="door-image" />
          ) : (
            <img src="/assets/door002.jpg" alt="開いたドア" className="door-image open" />
          )}

          {/* ノック効果 */}
          {doorState === 'knocking' && <div className="knock-effect"></div>}
        </div>
      </div>
    )
  }

  // ========== フォーム画面（占い場） ==========
  if (screen === 'form') {
    return (
      <div className="form-container" style={{ backgroundImage: 'url(/assets/room001.jpg)' }}>
        {loading && <HamsterLoading message="AI が鑑定中..." />}
        <div className="form-overlay">
          <div className="form-header">
            <h1>占いの館</h1>
            <div className="form-header-actions">
              {authenticated && <span className="user-email">{userEmail}</span>}
              <button onClick={mode === 'guest' ? () => setScreen('landing') : handleLogout} className="logout-button">
                {mode === 'guest' ? 'ログイン' : 'ログアウト'}
              </button>
            </div>
          </div>

          {authenticated && (
            <div className="stone-panel">
              <span className="stone-balance">
                <img src="/assets/stone.webp" alt="" className="stone-icon" />
                ルーンストーン: {stoneBalance ?? '…'}個
              </span>
              <button
                type="button"
                className="stone-ad-button"
                onClick={handleWatchAd}
                disabled={watchingAd}
              >
                {watchingAd ? '広告再生中...' : '📺 広告でルーンストーン+1'}
              </button>
              {stoneBonusMessage && <span className="stone-bonus-message">{stoneBonusMessage}</span>}
            </div>
          )}

        <form onSubmit={handleSubmit} className="form">
          <div className="form-group">
            <label htmlFor="birthDate">生年月日 *</label>
            <input
              id="birthDate"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="birthTime">出生時刻（任意）</label>
            <input
              id="birthTime"
              type="time"
              value={birthTime}
              onChange={(e) => setBirthTime(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="birthPlace">出生地（任意）</label>
            <input
              id="birthPlace"
              type="text"
              placeholder="例: 北海道札幌市"
              value={birthPlace}
              onChange={(e) => setBirthPlace(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="concern">悩み・状況 *</label>
            <textarea
              id="concern"
              placeholder="例: キャリアチェンジを考えています。今後の方向性について知りたいです。"
              value={concern}
              onChange={(e) => setConcern(e.target.value)}
              required
              rows={4}
            />
          </div>

          {error && <div className="error">{error}</div>}

          <button
            type="submit"
            disabled={loading || (authenticated && stoneBalance === 0)}
            className="primary-button"
          >
            {loading ? '診断中...' : '診断を実行'}
          </button>

          {mode === 'guest' && (
            <p className="guest-notice">
              ゲストモードでは1日1回までの診断が可能です。複数回試したい場合はログインしてください。
            </p>
          )}
          {authenticated && stoneBalance === 0 && (
            <p className="guest-notice">
              ルーンストーンが足りません。広告を見るか、また明日ログインボーナスを受け取ってください。
            </p>
          )}
        </form>
        </div>
      </div>
    )
  }

  // ========== 結果画面 ==========
  if (screen === 'result' && reading) {
    return (
      <div className="form-container" style={{ backgroundImage: 'url(/assets/room001.jpg)' }}>
        <div className="form-overlay">
          <div className="form-header">
            <h1>診断結果</h1>
            <button onClick={mode === 'guest' ? () => setScreen('landing') : handleLogout} className="logout-button">
              {mode === 'guest' ? 'ログイン' : 'ログアウト'}
            </button>
          </div>

          {justUnlockedCharacter !== null && (
            <div className="unlock-notice">
              🎉 {CHARACTER_MASTER_DATA[justUnlockedCharacter].name} が解放されました！
            </div>
          )}

        <div className="result">
          <div className="result-section">
            <h2>【四柱推命 - 命式】</h2>
            <div className="bazi-result">
              <div>年柱: {reading.baZi.yearPillar.stem}{reading.baZi.yearPillar.branch}</div>
              <div>月柱: {reading.baZi.monthPillar.stem}{reading.baZi.monthPillar.branch}</div>
              <div>日柱: {reading.baZi.dayPillar.stem}{reading.baZi.dayPillar.branch}</div>
              <div>時柱: {reading.baZi.timePillar.stem}{reading.baZi.timePillar.branch}</div>
              <div className="day-stem">日干: {reading.baZi.dayStem}</div>
            </div>
          </div>

          <div className="result-section">
            <h2>【数秘術】</h2>
            <div>
              ライフパスナンバー: <strong>{reading.numerology.lifePathNumber}</strong>
              {reading.numerology.isMasterNumber && ' (マスターナンバー)'}
            </div>
          </div>

          <div className="result-section">
            <h2>【九星気学】</h2>
            <div>本命星: <strong>{reading.kyuseiSeisun}</strong></div>
          </div>

          <div className="result-section">
            <h2>【AI統合診断】</h2>
            <div className="analysis">
              <Markdown
                components={{
                  h1: ({ node, ...props }) => <h1 className="markdown-h1" {...props} />,
                  h2: ({ node, ...props }) => <h2 className="markdown-h2" {...props} />,
                  h3: ({ node, ...props }) => <h3 className="markdown-h3" {...props} />,
                  p: ({ node, ...props }) => <p className="markdown-p" {...props} />,
                  ul: ({ node, ...props }) => <ul className="markdown-ul" {...props} />,
                  ol: ({ node, ...props }) => <ol className="markdown-ol" {...props} />,
                  li: ({ node, ...props }) => <li className="markdown-li" {...props} />,
                  strong: ({ node, ...props }) => <strong className="markdown-strong" {...props} />,
                  em: ({ node, ...props }) => <em className="markdown-em" {...props} />,
                }}
              >
                {reading.analysis}
              </Markdown>
            </div>
            {reading.cached && <small className="cache-notice">※ キャッシュから取得</small>}
          </div>

          <div className="result-section feedback-section">
            <h2>この診断の感想を教えてください</h2>
            {feedbackSubmitted ? (
              <p className="success">感想をありがとうございました！</p>
            ) : (
              <>
                <textarea
                  placeholder="感想をお聞きします..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={3}
                />
                <button onClick={handleSubmitFeedback} className="secondary-button">
                  感想を送信
                </button>
              </>
            )}
          </div>

          {error && <div className="error">{error}</div>}

          <div className="result-actions">
            <button onClick={handleNewReading} className="primary-button">
              新しい診断
            </button>
            <button onClick={handleBack} className="secondary-button">
              戻る
            </button>
          </div>
        </div>
        </div>
      </div>
    )
  }

  // キャラクター選択画面
  if (screen === 'character-selection') {
    return (
      <div className="app-container">
        <CharacterSelectionPage
          onCharacterSelected={(characterId) => {
            setSelectedCharacterId(characterId)
            setScreen('form')
          }}
        />
      </div>
    )
  }

  return null
}

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AppContent />
    </GoogleOAuthProvider>
  )
}

export default App

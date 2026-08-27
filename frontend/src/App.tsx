import { useState, useEffect } from 'react'
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'
import './App.css'
import {
  callFortuneAPI,
  submitFeedback,
  authenticateWithGoogle,
  logout,
  isAuthenticated,
  type FortuneRequest
} from './api'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

function App() {
  // Authentication state
  const [authenticated, setAuthenticated] = useState(isAuthenticated())
  const [authLoading, setAuthLoading] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  // Screen state
  const [screen, setScreen] = useState<'login' | 'form' | 'result'>('login')
  const [mode, setMode] = useState<'guest' | 'authenticated'>('guest')

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

  // Check authentication status on mount
  useEffect(() => {
    const auth = isAuthenticated()
    setAuthenticated(auth)
  }, [])

  // Google OAuth ハンドラ
  const handleGoogleSuccess = async (credentialResponse: any) => {
    setAuthLoading(true)
    setError('')

    try {
      const response = await authenticateWithGoogle(credentialResponse.credential)
      if (response.success) {
        setAuthenticated(true)
        setUserEmail(response.user?.email || '')
        setMode('authenticated')
        setScreen('form')
        console.log('✅ Logged in successfully')
      } else {
        setError(response.error || 'Authentication failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleGoogleError = () => {
    setError('Google authentication failed. Please try again.')
  }

  // ゲスト診断開始
  const handleStartGuest = () => {
    setMode('guest')
    setScreen('form')
    setError('')
  }

  // ログアウト
  const handleLogout = async () => {
    await logout()
    setAuthenticated(false)
    setUserEmail('')
    setScreen('login')
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
        concern
      }

      const response = await callFortuneAPI(request)

      if (!response.success) {
        setError(response.error || 'Failed to get reading')
      } else if (response.reading) {
        setReading(response.reading)
        setScreen('result')
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
  }

  // 新しい診断
  const handleNewReading = () => {
    setBirthDate('')
    setBirthTime('')
    setBirthPlace('')
    setConcern('')
    setReading(null)
    setFeedback('')
    setFeedbackSubmitted(false)
    setScreen('form')
  }

  // ========== ログイン画面 ==========
  if (screen === 'login') {
    return (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <div className="container">
          <h1>🔮 AI占い診断</h1>
          <p className="subtitle">プロトタイプ版</p>

          <div className="login-screen">
            <p>占いを試して、あなたの今の運勢を知ってみませんか？</p>

            <div className="login-section">
              <h2>Google でログイン</h2>
              <p>診断履歴の保存や、複数回の診断が可能になります。</p>
              <div className="google-login-button">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  text="signin_with"
                  size="large"
                />
              </div>
              {authLoading && <p className="loading">処理中...</p>}
            </div>

            <div className="divider">または</div>

            <div className="guest-section">
              <h2>ゲスト診断を試す</h2>
              <p>1日1回まで無料で診断できます。登録不要です。</p>
              <button onClick={handleStartGuest} className="primary-button">
                ゲスト診断を始める
              </button>
            </div>

            {error && <div className="error">{error}</div>}
          </div>
        </div>
      </GoogleOAuthProvider>
    )
  }

  // ========== フォーム画面 ==========
  if (screen === 'form') {
    return (
      <div className="container">
        <div className="header">
          <h1>🔮 AI占い診断</h1>
          <div className="header-actions">
            {authenticated && <span className="user-email">{userEmail}</span>}
            <button onClick={mode === 'guest' ? () => setScreen('login') : handleLogout} className="logout-button">
              {mode === 'guest' ? 'ログイン' : 'ログアウト'}
            </button>
          </div>
        </div>

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

          <button type="submit" disabled={loading} className="primary-button">
            {loading ? '診断中...' : '診断を実行'}
          </button>

          {mode === 'guest' && (
            <p className="guest-notice">
              ゲストモードでは1日1回までの診断が可能です。複数回試したい場合はログインしてください。
            </p>
          )}
        </form>
      </div>
    )
  }

  // ========== 結果画面 ==========
  if (screen === 'result' && reading) {
    return (
      <div className="container">
        <div className="header">
          <h1>🔮 診断結果</h1>
          <button onClick={mode === 'guest' ? () => setScreen('login') : handleLogout} className="logout-button">
            {mode === 'guest' ? 'ログイン' : 'ログアウト'}
          </button>
        </div>

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
            <div className="analysis">{reading.analysis}</div>
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
    )
  }

  return null
}

export default App

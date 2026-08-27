import { useState } from 'react'
import './App.css'
import { callFortuneAPI, submitFeedback, type FortuneRequest } from './api'

function App() {
  const [screen, setScreen] = useState<'form' | 'result'>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [birthDate, setBirthDate] = useState('')
  const [birthTime, setBirthTime] = useState('')
  const [birthPlace, setBirthPlace] = useState('')
  const [concern, setConcern] = useState('')

  // Result state
  const [reading, setReading] = useState<any>(null)
  const [feedback, setFeedback] = useState('')
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)

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

  const handleBack = () => {
    setScreen('form')
    setError('')
    setFeedback('')
    setFeedbackSubmitted(false)
  }

  return (
    <div className="container">
      <h1>🔮 AI占い診断</h1>
      <p className="subtitle">統計学的占術計算とAIによる統合診断</p>

      {error && <div className="error">{error}</div>}

      {screen === 'form' ? (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>生年月日 *</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              required
            />
            <p className="form-hint">YYYY-MM-DD形式</p>
          </div>

          <div className="form-group">
            <label>出生時刻</label>
            <input
              type="time"
              value={birthTime}
              onChange={(e) => setBirthTime(e.target.value)}
            />
            <p className="form-hint">分からない場合は空欄でOK</p>
          </div>

          <div className="form-group">
            <label>出生地</label>
            <input
              type="text"
              value={birthPlace}
              onChange={(e) => setBirthPlace(e.target.value)}
              placeholder="例: 北海道札幌市"
            />
          </div>

          <div className="form-group">
            <label>現在の悩み・状況 *</label>
            <textarea
              value={concern}
              onChange={(e) => setConcern(e.target.value)}
              placeholder="進路の悩み、人間関係、仕事について等、現在の状況を教えてください"
              required
            />
            <p className="form-hint">占術計算と組み合わせて、より正確な診断を生成します</p>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? '診断中...' : '診断を受ける'}
          </button>

          {loading && (
            <div className="loading">
              <div className="spinner"></div>
              <p>占術計算とAI診断を処理中...</p>
            </div>
          )}
        </form>
      ) : reading ? (
        <div>
          <h2>占い診断結果</h2>

          <div className="result-card">
            <h3>四柱推命 - 命式</h3>
            <div className="result-row">
              <span className="result-label">年柱:</span>
              <span className="result-value">
                {reading.baZi.yearPillar.stem}
                {reading.baZi.yearPillar.branch} ({reading.baZi.yearPillar.element})
              </span>
            </div>
            <div className="result-row">
              <span className="result-label">月柱:</span>
              <span className="result-value">
                {reading.baZi.monthPillar.stem}
                {reading.baZi.monthPillar.branch} ({reading.baZi.monthPillar.element})
              </span>
            </div>
            <div className="result-row">
              <span className="result-label">日柱:</span>
              <span className="result-value">
                {reading.baZi.dayPillar.stem}
                {reading.baZi.dayPillar.branch} ({reading.baZi.dayPillar.element})
              </span>
            </div>
            <div className="result-row">
              <span className="result-label">時柱:</span>
              <span className="result-value">
                {reading.baZi.timePillar.stem}
                {reading.baZi.timePillar.branch} ({reading.baZi.timePillar.element})
              </span>
            </div>
            <div className="result-row">
              <span className="result-label">日干(性質):</span>
              <span className="result-value">{reading.baZi.dayStem}</span>
            </div>
          </div>

          <div className="result-card">
            <h3>数秘術</h3>
            <div className="result-row">
              <span className="result-label">ライフパスナンバー:</span>
              <span className="result-value">
                {reading.numerology.lifePathNumber}
                {reading.numerology.isMasterNumber && ' (マスターナンバー)'}
              </span>
            </div>
          </div>

          <div className="result-card">
            <h3>九星気学</h3>
            <div className="result-row">
              <span className="result-label">本命星:</span>
              <span className="result-value">{reading.kyuseiSeisun}</span>
            </div>
          </div>

          <div className="result-card">
            <h3>統合診断文</h3>
            <div className="analysis-text">{reading.analysis}</div>
            {reading.cached && <p className="text-muted mt-20">* キャッシュから取得</p>}
            {reading.tokensUsed && (
              <p className="text-muted mt-20">* AI処理トークン: {reading.tokensUsed}</p>
            )}
          </div>

          <div className="form-group mt-20">
            <label>診断についてのご感想</label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="この診断が参考になりましたか?改善提案などお聞かせください"
              disabled={feedbackSubmitted}
            />
          </div>

          {feedbackSubmitted ? (
            <div className="success">ご感想ありがとうございました！</div>
          ) : (
            <button type="button" onClick={handleSubmitFeedback}>
              感想を送信
            </button>
          )}

          <div className="button-group">
            <button
              type="button"
              className="button-secondary"
              onClick={handleBack}
            >
              戻る
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App

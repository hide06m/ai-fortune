import { useState, useEffect, useRef } from 'react'
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
import { CHARACTER_MASTER_DATA, DIAGNOSIS_STONE_COST, type CharacterId } from './types/character'
import { getStoneBalance, claimDailyBonus, watchAdForStone } from './api/stones'
import { getReadingHistory, getReadingDetail, type ReadingSummary } from './api/readings'
import { callCompatibilityAPI, type CompatibilityResponse } from './api/compatibility'
import { greetGuide, getNextUnmetCharacter, markCharacterMet } from './api/character'
import {
  initAudio,
  startAmbientLoop,
  stopAmbientLoop,
  playKnock,
  playDoorOpen,
  switchToRoomBGM,
  startForestBgmLayer,
  stopForestBgmLayer,
  isBgmMuted,
  isSeMuted,
  setBgmMuted,
  setSeMuted,
  getBgmVolume,
  getSeVolume,
  setBgmVolume,
  setSeVolume
} from './audio'
import { CharacterSelectionPage } from './pages/CharacterSelectionPage'
import { MBTIQuizPage } from './pages/MBTIQuizPage'
import { displayAnalysis } from './utils/llmError'
import { MBTIResultCard } from './components/MBTIResultCard'
import { PalmAnnotatedResult } from './components/PalmAnnotatedResult'
import { LoveResultExtras } from './components/LoveResultExtras'
import { LoveType64QuizPage } from './pages/LoveType64QuizPage'
import { PalmCapturePage } from './pages/PalmCapturePage'
import { PalmQRHandoffPage } from './pages/PalmQRHandoffPage'
import { isMobileDevice } from './utils/device'
import { HamsterLoading } from './components/HamsterLoading'
import {
  TUTORIAL_INTRO_STEPS,
  TUTORIAL_MEETING_STEPS,
  TUTORIAL_AFTER_RESULT_STEPS,
  TSUKI_MEETING_STEPS,
  KOKUU_MEETING_STEPS,
  KURI_MEETING_STEPS,
  type TutorialStep,
} from './data/tutorialScript'

// キャラごとに「もう一度診断する」で戻るべき画面（診断方式がキャラごとに異なるため）。
// クリだけは性格診断／ラブタイプ診断のどちらを最後に使ったかで戻り先が変わる
function getDiagnosisEntryScreen(
  characterId: number,
  kuriMode: 'mbti' | 'love64' = 'mbti'
): 'form' | 'mbti-quiz' | 'love64-quiz' | 'palm-capture' | 'palm-qr-handoff' {
  if (characterId === 4) return kuriMode === 'love64' ? 'love64-quiz' : 'mbti-quiz'
  if (characterId === 3) return isMobileDevice() ? 'palm-capture' : 'palm-qr-handoff'
  return 'form'
}

// キャラごとの「初対面イベント」台本（ナツメ・ムスビはチュートリアル内で完結するため対象外）
function getMeetingSteps(characterId: CharacterId): TutorialStep[] {
  if (characterId === 2) return TSUKI_MEETING_STEPS
  if (characterId === 3) return KOKUU_MEETING_STEPS
  return KURI_MEETING_STEPS
}

// 「。」で終わるまとまりごとに分割する（1つの吹き出しに複数文を一度に出さないため）
// 「。」を含まない残りの文字列がある場合は、それも最後の1文として含める
function splitIntoSentences(text: string): string[] {
  const result: string[] = []
  let current = ''
  for (const ch of text) {
    current += ch
    if (ch === '。') {
      result.push(current)
      current = ''
    }
  }
  if (current.length > 0) result.push(current)
  return result.length > 0 ? result : ['']
}

function getTutorialSteps(
  segment: 'intro' | 'meeting' | 'after-result' | 'meet-character',
  meetingCharacterId?: CharacterId | null
): TutorialStep[] {
  if (segment === 'intro') return TUTORIAL_INTRO_STEPS
  if (segment === 'meeting') return TUTORIAL_MEETING_STEPS
  if (segment === 'meet-character') return meetingCharacterId != null ? getMeetingSteps(meetingCharacterId) : []
  return TUTORIAL_AFTER_RESULT_STEPS
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

// ゲスト体験フローの固定シナリオ（占いの館前で、フードをかぶったムスビとたまたま出会う）
const GUEST_PRE_FORM_LINES = [
  'ここで何を考えているんだい？',
  'あるいは、何も考えていないのかもしれないけれど。',
  'いずれにせよ、君がこの深い森の、それもひときわ大きな木の前にたどり着いたということは、人生のどこかの歯車がほんの少しだけ狂ってしまった証拠だ。',
  '専門外ではあるけれど、少しだけ君の輪郭を視てみようか。',
]
const GUEST_POST_RESULT_LINES = [
  '機会があれば、うちの占術師たちに会えることもあるだろう',
  'また、どこかで',
]

// 鑑定中ローディング画面の世界観フレーバーメッセージ（ランダム表示）
const LOADING_FLAVOR_MESSAGES = [
  'ルーンストーンを静かに並べ替えている',
  '庭の隅で、良質なミントの葉を摘んでいる',
  '古びた索引カードの束をめくっている',
  '水晶玉についた埃を、丁寧な手つきで拭き取っている',
  '遠い世界の、名前のない星の配置を数えている',
  '誰もいない部屋で、古い巻物をひも解いている',
  '不完全な命式を、納得がいくまで並べ替えている',
  '森の冷たい風から、使い捨ての言葉を紡いでいる',
  '深い井戸の底に、小さな小石を落として音を聴いている',
  '午前三時の台所で、やかんが湯気を立てるのを待っている',
  '誰も弾かなくなった古いアップライトピアノの鍵盤を拭いている',
  '使い古された万年筆に、新しいブルーブラックのインクを吸わせている',
  'レコードの針を、慎重に無音の溝へと落としている',
  '樫の木の幹に耳をあて、地下を流れる水脈の音を探している',
  '昨夜見た夢の輪郭を、羊皮紙の上に鉛筆でなぞっている',
  'ポケットの奥で絡まった、見えない糸を一本ずつほどいている',
  '湿った土の匂いを嗅ぎ、季節の変わり目を確認している',
  '誰にも宛てられなかった手紙の封蝋を、ナイフで削っている',
  '天秤の片側に、小さな木の実を三つ乗せている',
  '砂時計のくびれを通り抜ける、最後の一粒を見つめている',
  '記憶の引き出しを一段ずつ開けて、埃を払っている',
  '曇った丸眼鏡を、ネルの布で念入りに磨き上げている',
  '乾いたパンの耳を小さくちぎり、小鳥たちの皿に置いている',
  '古い振り子時計の重りを、少しだけ右へ巻き上げている',
  '辞書の余白に書き残された、意味のない数字を書き写している',
  '遠くの鉄橋を渡る、夜行列車の響きに耳を澄ませている',
  '乾燥させたカモミールの花びらを、指先ですり潰している',
  '窓ガラスを伝い落ちる、雨の雫の速さを比べている',
  '引き出しの奥で見つかった、錆びた真鍮の鍵を磨いている',
  '小さな金属の定規で、星と星のあいだの虚無を測っている',
  'テーブルの木目に沿って、指先をゆっくり滑らせている',
  '誰も読まない詩集のページを、風にまかせてめくっている',
  '銅のケトルに注いだ水の重さを、手首で確かめている',
  '影が床に落ちる角度から、太陽の傾きを計算している',
  '乾いた松ぼっくりの隙間に詰まった、昨日の風を掻き出している',
  '陶器のカップの縁についた、微かな欠けを指先でなぞっている',
  '古い地下室の棚から、ラベルの剥がれかけた小瓶を取り出している',
  '静かな廊下を渡っていく、かすかな風の通り道を見送っている',
  '色褪せた切手の裏に、湿り気を与えている',
  '硬い木の実の殻を、小さな万力で慎重に割っている',
  '天井の梁に吊るされた、薬草の束の揺れを眺めている',
  '削りたての鉛筆の芯の尖り具合を、親指の腹で確かめている',
  '灰皿に残ったマッチの軸を、規則正しく並べている',
  '分厚い羊毛のブランケットを、端からきっちり四つ折りにしている',
  '沈黙の重さを、古い真鍮の分銅と引き比べている',
  '錆びた方位磁針の針が、北を指して止まるのをじっと待っている',
  '忘れ去られた古いノートの、白紙のページを撫でている',
  '夜の帳が降りる瞬間の、青と黒の境目を観察している',
  '淹れたての紅茶が、透き通った琥珀色に変わるのを見届けている',
  '誰も通らない森の小道に、踏み固められた土の硬さを確かめている',
  '過去と未来のちょうど真ん中に、小さな目印の小石を置いている',
  '静かな部屋の隅で、ただ静かに息を吸い、そして吐き出している',
]

function pickRandomLoadingMessage(): string {
  return LOADING_FLAVOR_MESSAGES[Math.floor(Math.random() * LOADING_FLAVOR_MESSAGES.length)]
}

// 生年月日入力：年4桁→自動で月欄へ、月2桁→自動で日欄へフォーカス移動する
function BirthDateInput({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  const initial = value ? value.split('-') : ['', '', '']
  const [year, setYear] = useState(initial[0] || '')
  const [month, setMonth] = useState(initial[1] || '')
  const [day, setDay] = useState(initial[2] || '')
  const monthRef = useRef<HTMLInputElement>(null)
  const dayRef = useRef<HTMLInputElement>(null)
  const nativeDateRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (year.length === 4 && month.length > 0 && day.length > 0) {
      onChange(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`)
    } else {
      onChange('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, day])

  return (
    <div className="birthdate-input-group">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="年"
        maxLength={4}
        value={year}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 4)
          setYear(v)
          if (v.length === 4) monthRef.current?.focus()
        }}
        className="birthdate-year"
      />
      <span className="birthdate-sep">/</span>
      <input
        ref={monthRef}
        type="text"
        inputMode="numeric"
        placeholder="月"
        maxLength={2}
        value={month}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 2)
          setMonth(v)
          if (v.length === 2) dayRef.current?.focus()
        }}
        className="birthdate-month"
      />
      <span className="birthdate-sep">/</span>
      <input
        ref={dayRef}
        type="text"
        inputMode="numeric"
        placeholder="日"
        maxLength={2}
        value={day}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 2)
          setDay(v)
        }}
        className="birthdate-day"
      />
      <button
        type="button"
        className="birthdate-calendar-button"
        aria-label="カレンダーから選択"
        onClick={() => {
          const el = nativeDateRef.current as (HTMLInputElement & { showPicker?: () => void }) | null
          el?.showPicker ? el.showPicker() : el?.focus()
        }}
      >
        📅
      </button>
      <input
        ref={nativeDateRef}
        type="date"
        className="birthdate-native-picker"
        tabIndex={-1}
        value={year.length === 4 && month.length > 0 && day.length > 0 ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` : ''}
        onChange={(e) => {
          const [y, m, d] = e.target.value.split('-')
          if (y && m && d) {
            setYear(y)
            setMonth(m)
            setDay(d)
          }
        }}
      />
    </div>
  )
}

function AppContent() {
  // Authentication state
  const [authenticated, setAuthenticated] = useState(isAuthenticated())
  const [authLoading, setAuthLoading] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  // Screen state
  const [screen, setScreen] = useState<'landing' | 'door' | 'guide-conversation' | 'guest-conversation' | 'guest-farewell' | 'tutorial' | 'character-selection' | 'form' | 'mbti-quiz' | 'love64-quiz' | 'palm-capture' | 'palm-qr-handoff' | 'result' | 'history' | 'compatibility' | 'compatibility-result'>('landing')
  const [doorState, setDoorState] = useState<'closed' | 'knocking' | 'open'>('closed')
  const [doorExiting, setDoorExiting] = useState(false)  // ✅ door から form への遷移アニメーション
  const [mode, setMode] = useState<'guest' | 'authenticated'>('guest')

  // Character state
  const [selectedCharacterId, setSelectedCharacterId] = useState<number>(1) // デフォルト：ナツメ
  const [kuriDiagnosisMode, setKuriDiagnosisMode] = useState<'mbti' | 'love64'>('mbti') // クリのみ：性格診断/ラブタイプ診断のどちらを使うか

  // 石（診断に使う仮想通貨）
  const [stoneBalance, setStoneBalance] = useState<number | null>(null)
  const [stoneBonusMessage, setStoneBonusMessage] = useState('')
  const [watchingAd, setWatchingAd] = useState(false)

  // 診断履歴
  const [readingHistory, setReadingHistory] = useState<ReadingSummary[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [viewingHistoryReading, setViewingHistoryReading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  // 相性診断
  const [compatLoading, setCompatLoading] = useState(false)
  const [compatNameA, setCompatNameA] = useState('')
  const [compatBirthDateA, setCompatBirthDateA] = useState('')
  const [compatBirthTimeA, setCompatBirthTimeA] = useState('')
  const [compatNameB, setCompatNameB] = useState('')
  const [compatBirthDateB, setCompatBirthDateB] = useState('')
  const [compatBirthTimeB, setCompatBirthTimeB] = useState('')
  const [compatResult, setCompatResult] = useState<CompatibilityResponse | null>(null)

  // 案内役（ムスビ）のドア挨拶
  const [guideDialogue, setGuideDialogue] = useState('')
  const [guideExpression, setGuideExpression] = useState<1 | 2 | 3 | 4>(2)
  const [guideNoSplit, setGuideNoSplit] = useState(false)
  const [guideNextScreen, setGuideNextScreen] = useState<'form' | 'character-selection'>('form')

  // ゲスト体験フロー（固定シナリオ：占いの館前でムスビと出会う）
  const [guestPhase, setGuestPhase] = useState<'pre-form' | 'post-result'>('pre-form')
  const [guestStep, setGuestStep] = useState(0)

  // 初回ログイン（サインアップ）チュートリアル
  const [tutorialSegment, setTutorialSegment] = useState<'intro' | 'meeting' | 'after-result' | 'meet-character' | null>(null)
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0)

  // 新キャラクターとの「初対面イベント」（解放後、次のキャラ選択画面アクセス時に一度だけ再生）
  const [meetingCharacterId, setMeetingCharacterId] = useState<CharacterId | null>(null)
  const [pendingMeetingCheck, setPendingMeetingCheck] = useState(false)

  // 会話シーン共通：1文字ずつ表示するタイプライター演出
  // タイプライターの進み具合と、何文目を出すか。どちらも「どの文・どのステップのものか」を一緒に持つ。
  // 別々の値だけで持つと、セリフが切り替わった最初の1フレームに、前のセリフの進み具合や文の番号が残り、
  // 新しい文が一瞬まるごと見えたり、別の文が見えたりする（描画のあとに effect で0へ戻すため）
  const [typedState, setTypedState] = useState({ text: '', n: 0 })
  const [sentenceState, setSentenceState] = useState({ key: '', index: 0 })
  const typewriterTimerRef = useRef<number | null>(null)

  // Form state
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [duplicateNotice, setDuplicateNotice] = useState<{ message: string; existingReadingId: string } | null>(null)
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

  // 診断履歴一覧を開く
  const openHistory = async () => {
    setError('')
    setHistoryLoading(true)
    setScreen('history')
    try {
      const result = await getReadingHistory()
      setReadingHistory(result.readings)
    } catch (err) {
      setError('診断履歴の取得に失敗しました。')
    } finally {
      setHistoryLoading(false)
    }
  }

  // 診断履歴の1件を結果画面で表示
  const viewHistoryItem = async (id: string) => {
    setError('')
    try {
      const result = await getReadingDetail(id)
      const r = result.reading
      setReading({
        baZi: r.baZi,
        numerology: r.numerology,
        kyuseiSeisun: r.kyuseiSeisun,
        westernZodiac: r.westernZodiac,
        mbtiResult: r.mbtiResult,
        loveTypeResult: r.loveTypeResult,
        analysis: r.analysis,
        cached: true
      })
      setJustUnlockedCharacter(null)
      setViewingHistoryReading(true)
      setScreen('result')
    } catch (err) {
      setError('診断履歴の取得に失敗しました。')
    }
  }

  // 相性診断フォームを開く
  const openCompatibility = () => {
    setError('')
    setScreen('compatibility')
  }

  // 相性診断実行
  const handleCompatibilitySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoadingMessage(pickRandomLoadingMessage())
    setCompatLoading(true)

    try {
      const response = await callCompatibilityAPI(
        { name: compatNameA, birthDate: compatBirthDateA, birthTime: compatBirthTimeA || undefined },
        { name: compatNameB, birthDate: compatBirthDateB, birthTime: compatBirthTimeB || undefined }
      )

      if (typeof response.stoneBalance === 'number') {
        setStoneBalance(response.stoneBalance)
      }

      if (!response.success) {
        setError(response.message || response.error || '相性診断に失敗しました')
      } else {
        setCompatResult(response)
        setScreen('compatibility-result')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setCompatLoading(false)
    }
  }

  // ランディングページで背景音を開始
  useEffect(() => {
    if (screen === 'landing') {
      startAmbientLoop()
    }
  }, [screen])

  // 会話パート（案内役／ゲスト体験）では、既存BGMに森の音を小さめに重ねる
  useEffect(() => {
    if (screen === 'guide-conversation' || screen === 'guest-conversation') {
      startForestBgmLayer()
    } else {
      stopForestBgmLayer()
    }
  }, [screen])

  // キャラ選択画面に入る直前、初対面イベント未再生の解放済みキャラがいないか確認する
  // （いれば通常のキャラ選択より先に、偶然出くわした体の出会いイベントを割り込ませる）
  useEffect(() => {
    if (screen !== 'character-selection') return
    setPendingMeetingCheck(true)
    let cancelled = false
    ;(async () => {
      try {
        const result = await getNextUnmetCharacter()
        if (cancelled) return
        if (result.success && result.characterId !== null) {
          enterCharacterMeeting(result.characterId as CharacterId)
        } else {
          setPendingMeetingCheck(false)
        }
      } catch (error) {
        console.error('Failed to check next unmet character:', error)
        if (!cancelled) setPendingMeetingCheck(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [screen])

  // 現在のチュートリアルステップ（tutorial画面以外ではnull）
  const currentTutorialStep: TutorialStep | null =
    screen === 'tutorial' && tutorialSegment
      ? getTutorialSteps(tutorialSegment, meetingCharacterId)[tutorialStepIndex] || null
      : null

  // 現在のステップのセリフ全文（会話シーン以外では空文字）
  const currentStepFullText =
    screen === 'guest-conversation'
      ? (guestPhase === 'pre-form' ? GUEST_PRE_FORM_LINES : GUEST_POST_RESULT_LINES)[guestStep] || ''
      : screen === 'guide-conversation'
        ? guideDialogue
        : screen === 'tutorial' && currentTutorialStep &&
            (currentTutorialStep.type === 'narration' || currentTutorialStep.type === 'dialogue')
          ? currentTutorialStep.text
          : ''

  // このステップを「。」で分割せず一度に表示するか（不自然な分割を避けるための逃げ道）
  const currentStepNoSplit =
    screen === 'guide-conversation'
      ? guideNoSplit
      : screen === 'tutorial' && currentTutorialStep &&
          (currentTutorialStep.type === 'narration' || currentTutorialStep.type === 'dialogue')
        ? !!currentTutorialStep.noSplit
        : false

  // 「。」区切りで分割し、1文ずつ表示する（タップで次の文、最後の文でようやく次のステップへ）
  // noSplit指定時は全文をそのまま1つのまとまりとして表示する
  const currentDialogueSentences = !currentStepFullText
    ? ['']
    : currentStepNoSplit
      ? [currentStepFullText]
      : splitIntoSentences(currentStepFullText)
  // 会話シーンで使う画像（背景・キャラの表情）を先に読み込む。切り替えのたびに読み込むと、
  // 読み込み中は前の画像が残ったり、一瞬別の絵が見えたりするため
  useEffect(() => {
    const urls = new Set<string>(['/assets/room001.jpg', '/assets/index001.jpg'])
    for (let i = 1; i <= 4; i++) urls.add(`/assets/characters/0-musubi/ham00${i}.webp`)
    if (screen === 'tutorial' && tutorialSegment) {
      const folders: Record<string, string> = { musubi: '0-musubi', natsume: '1-natsume', tsuki: '2-tsuki', kokuu: '3-kokuu', kuri: '4-kuri' }
      for (const st of getTutorialSteps(tutorialSegment, meetingCharacterId)) {
        if (st.type === 'dialogue' && st.image) urls.add(`/assets/characters/${folders[st.character ?? 'musubi'] ?? '0-musubi'}/${st.image}.webp`)
        if (st.type === 'itemReveal' && st.image) urls.add(st.image)
      }
    }
    urls.forEach((u) => {
      const img = new Image()
      img.src = u
    })
  }, [screen, tutorialSegment, meetingCharacterId])

  // ステップが切り替わったら、文の分割位置は自動で先頭に戻る（キーが変わるため）
  const dialogueStepKey = `${screen}|${guestPhase}|${guestStep}|${guideDialogue}|${tutorialSegment}|${tutorialStepIndex}`
  const dialogueSentenceIndex = sentenceState.key === dialogueStepKey ? sentenceState.index : 0
  const setDialogueSentenceIndex = (index: number) => setSentenceState({ key: dialogueStepKey, index })
  const currentDialogueText = currentDialogueSentences[dialogueSentenceIndex] ?? currentDialogueSentences[0] ?? ''
  // 表示する文字数：別の文のものなら0（切り替わった瞬間に、新しい文が見えてしまわないように）
  const typedLength = typedState.text === currentDialogueText ? typedState.n : 0
  const setTypedLength = (n: number) => setTypedState({ text: currentDialogueText, n })

  // セリフが変わるたびに、1文字ずつ表示するタイプライター演出を開始
  useEffect(() => {
    if (typewriterTimerRef.current) {
      window.clearInterval(typewriterTimerRef.current)
      typewriterTimerRef.current = null
    }
    setTypedState({ text: currentDialogueText, n: 0 })
    if (!currentDialogueText) return

    let i = 0
    typewriterTimerRef.current = window.setInterval(() => {
      i++
      setTypedState({ text: currentDialogueText, n: i })
      if (i >= currentDialogueText.length && typewriterTimerRef.current) {
        window.clearInterval(typewriterTimerRef.current)
        typewriterTimerRef.current = null
      }
    }, 40)

    return () => {
      if (typewriterTimerRef.current) {
        window.clearInterval(typewriterTimerRef.current)
        typewriterTimerRef.current = null
      }
    }
  }, [currentDialogueText])

  // 会話ボックスをクリックした時：
  // ①タイプ中なら現在の文を全表示にスキップ
  // ②表示済みで、まだ同じステップ内に次の文があればそちらへ
  // ③最後の文まで表示済みなら、ステップ自体を進める（onAdvance）
  const handleDialogueBoxClick = (onAdvance: () => void) => {
    if (typedLength < currentDialogueText.length) {
      if (typewriterTimerRef.current) {
        window.clearInterval(typewriterTimerRef.current)
        typewriterTimerRef.current = null
      }
      setTypedLength(currentDialogueText.length)
      return
    }
    if (dialogueSentenceIndex < currentDialogueSentences.length - 1) {
      setDialogueSentenceIndex(dialogueSentenceIndex + 1)
      return
    }
    onAdvance()
  }

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

          if (response.isNewUser) {
            // ✅ 初回ログイン（サインアップ）：チュートリアルを開始
            console.log('✅ New user — starting tutorial')
            startTutorial()
          } else {
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

                // 800ms 後に案内役（ムスビ）の会話シーンへ遷移
                setTimeout(() => {
                  setDoorExiting(false)  // ✅ リセット
                  enterGuideConversation('form')
                }, 800)
              }, 800)
            }, 1500)
          }
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
  // ゲストはドアのノック演出をせず、直接ムスビとの出会いの会話へ
  const handleStartGuest = () => {
    setMode('guest')
    enterGuestConversation()
  }

  // 案内役（ムスビ）の会話シーンへ遷移（ドアが開いた直後、form/character-selection へ行く前に挟む）
  const enterGuideConversation = async (nextScreen: 'form' | 'character-selection') => {
    setGuideNextScreen(nextScreen)
    setScreen('guide-conversation')
    switchToRoomBGM()
    try {
      const result = await greetGuide()
      if (result.success && result.dialogue) {
        setGuideDialogue(result.dialogue)
        setGuideExpression(result.expression || 2)
        setGuideNoSplit(!!result.noSplit)
      } else {
        setGuideDialogue('いらっしゃい。キミの運勢を見てあげようか')
        setGuideExpression(2)
        setGuideNoSplit(false)
      }
    } catch {
      setGuideDialogue('いらっしゃい。キミの運勢を見てあげようか')
      setGuideExpression(2)
      setGuideNoSplit(false)
    }
  }

  // 会話シーンから次の画面へ進む
  const handleGuideContinue = () => {
    setScreen(guideNextScreen)
  }

  // 初回ログイン（サインアップ）チュートリアルを開始
  const startTutorial = () => {
    setTutorialSegment('intro')
    setTutorialStepIndex(0)
    setScreen('tutorial')
  }

  // handoffステップに到達した時の実処理（ドアノック演出 or フォームへ遷移）
  const runTutorialHandoff = (action: 'doorKnock' | 'gotoForm') => {
    if (action === 'gotoForm') {
      setScreen('form')
      return
    }

    // ドアノック演出（ランディングのドア演出と同じ choreography）→ 完了後に館内（meeting）へ
    setScreen('door')
    setDoorState('knocking')
    setDoorExiting(false)
    playKnock()
    setTimeout(() => {
      setDoorState('open')
      playDoorOpen()
      setTimeout(() => {
        setDoorExiting(true)
        setTimeout(() => {
          setDoorExiting(false)
          switchToRoomBGM()
          setTutorialSegment('meeting')
          setTutorialStepIndex(0)
          setScreen('tutorial')
          // チュートリアルでの出会い自体を「来館1回目」として記録しておく（結果を使わないfire-and-forget）。
          // これにより次回の通常ログインは自然にLv.2（通常ティア）から始まり、
          // GUIDE_GREETINGSの「初回」挨拶とチュートリアルの導入が重複しない。
          greetGuide().catch(() => {})
        }, 800)
      }, 800)
    }, 1500)
  }

  // チュートリアルのセリフ／ナレーションを進める
  const handleTutorialAdvance = () => {
    if (!tutorialSegment) return
    const steps = getTutorialSteps(tutorialSegment, meetingCharacterId)
    const nextIndex = tutorialStepIndex + 1

    if (nextIndex >= steps.length) {
      // セグメントの最後まで到達（intro/meetingは必ずhandoffで終わる想定。after-result/meet-characterはここで終了）
      if (tutorialSegment === 'meet-character') {
        finishCharacterMeeting()
      } else {
        finishTutorial()
      }
      return
    }

    const nextStep = steps[nextIndex]
    if (nextStep.type === 'handoff') {
      runTutorialHandoff(nextStep.action)
    } else {
      setTutorialStepIndex(nextIndex)
    }
  }

  // 診断結果画面から、チュートリアルの続き（Segment C）へ
  const enterTutorialAfterResult = () => {
    setTutorialSegment('after-result')
    setTutorialStepIndex(0)
    setScreen('tutorial')
  }

  // チュートリアル最終セグメントの終了 → 通常のキャラクター選択画面へ
  const finishTutorial = () => {
    setTutorialSegment(null)
    setScreen('character-selection')
  }

  // 新キャラクターとの初対面イベントを開始（キャラ選択画面へ入る直前に割り込む）
  const enterCharacterMeeting = (characterId: CharacterId) => {
    setMeetingCharacterId(characterId)
    setTutorialSegment('meet-character')
    setTutorialStepIndex(0)
    setScreen('tutorial')
  }

  // 初対面イベントの終了 → 既読フラグを記録し、キャラ選択画面へ戻る
  // （戻った先で再度チェックが走るため、複数キャラが同時解放されていても1体ずつ続けて処理される）
  const finishCharacterMeeting = async () => {
    const metCharacterId = meetingCharacterId
    setTutorialSegment(null)
    setMeetingCharacterId(null)
    if (metCharacterId !== null) {
      try {
        await markCharacterMet(metCharacterId)
      } catch (error) {
        console.error('Failed to mark character met:', error)
      }
    }
    setScreen('character-selection')
  }

  // ゲスト体験フロー：占いの館前でムスビと出会う会話シーンへ（固定シナリオ、アカウント不要）
  const enterGuestConversation = () => {
    setGuestPhase('pre-form')
    setGuestStep(0)
    setScreen('guest-conversation')
  }

  // ゲスト会話シーンのセリフを進める（pre-form の最後→診断フォームへ／post-result の最後→お別れ画面へ）
  const handleGuestDialogueClick = () => {
    const lines = guestPhase === 'pre-form' ? GUEST_PRE_FORM_LINES : GUEST_POST_RESULT_LINES
    if (guestStep < lines.length - 1) {
      setGuestStep(guestStep + 1)
    } else if (guestPhase === 'pre-form') {
      setScreen('form')
    } else {
      setScreen('guest-farewell')
    }
  }

  // 診断結果を見終えたゲストの会話（結果画面の「占いの館を出る」から呼ばれる）
  const enterGuestPostResultConversation = () => {
    setGuestPhase('post-result')
    setGuestStep(0)
    setScreen('guest-conversation')
  }

  // お別れ画面をタップしたらトップページへ戻る
  const handleGuestFarewellDone = () => {
    setScreen('landing')
    setMode('guest')
    setReading(null)
    setBirthDate('')
    setBirthTime('')
    setBirthPlace('')
    setConcern('')
    setError('')
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

          // 800ms 後にムスビの挨拶会話シーンへ遷移（このドアは認証済みユーザーのみ通る。ゲストはドアを介さず直接会話へ）
          setTimeout(() => {
            setDoorExiting(false)  // ✅ リセット
            enterGuideConversation('character-selection')
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
    setDuplicateNotice(null)
    setLoadingMessage(pickRandomLoadingMessage())
    setLoading(true)
    setViewingHistoryReading(false)

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

      if (response.duplicate && response.existingReadingId) {
        setDuplicateNotice({
          message: response.message || 'ちょっと待って、前も全く同じ内容で占ってるよ',
          existingReadingId: response.existingReadingId,
        })
      } else if (!response.success) {
        setError(response.error || 'Failed to get reading')
      } else if (response.reading) {
        setReading(response.reading)
        setJustUnlockedCharacter(
          response.intimacy?.justUnlocked !== null && response.intimacy?.justUnlocked !== undefined
            ? (response.intimacy.justUnlocked as CharacterId)
            : null
        )
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
  // SNSシェア用のテキストを組み立てる（Markdown記法を除去し、短く要約）
  const buildShareText = () => {
    if (!reading) return ''
    // ゲスト診断はムスビが担当だが、ゲストには正体を明かさないためキャラ名は出さない
    const characterName = mode === 'guest' ? '' : (CHARACTER_MASTER_DATA[selectedCharacterId as CharacterId]?.name ?? '')
    const plain = reading.analysis
      .replace(/[#*_`>\-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    const excerpt = plain.length > 60 ? `${plain.slice(0, 60)}…` : plain
    const characterLine = mode === 'guest'
      ? '占いの森で占ってもらいました。\n'
      : (characterName ? `${characterName}に占ってもらいました。\n` : '')
    return `${characterLine}「${excerpt}」\n#占いの森`
  }

  const handleShareToX = () => {
    const text = buildShareText()
    const url = window.location.origin
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
    window.open(intentUrl, '_blank', 'noopener,noreferrer')
  }

  const handleCopyShareText = async () => {
    const text = `${buildShareText()}\n${window.location.origin}`
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch {
      setError('コピーに失敗しました')
    }
  }

  const handleBack = () => {
    if (mode === 'guest' && !viewingHistoryReading) {
      // ゲストは診断フォームに戻さず、ムスビとのお別れの会話へ
      enterGuestPostResultConversation()
    } else if (tutorialSegment === 'meeting' && !viewingHistoryReading) {
      // チュートリアル中の初回診断後は、続き（ナツメ→ルーンストーン→ムスビ）へ
      enterTutorialAfterResult()
    } else if (viewingHistoryReading) {
      setScreen('history')
    } else {
      setScreen(getDiagnosisEntryScreen(selectedCharacterId, kuriDiagnosisMode))
    }
    setError('')
    setFeedback('')
    setFeedbackSubmitted(false)
    setJustUnlockedCharacter(null)
    setViewingHistoryReading(false)
  }

  // 新しい診断
  const handleNewReading = () => {
    // ✅ フォーム入力をクリア（UI をリセット）
    setBirthDate('')
    setBirthTime('')
    setBirthPlace('')
    setConcern('')

    // ✅ 画面状態をリセット（キャラごとに専用の診断入口へ戻す）
    setScreen(getDiagnosisEntryScreen(selectedCharacterId, kuriDiagnosisMode))
    setReading(null)
    setFeedback('')
    setFeedbackSubmitted(false)
    setJustUnlockedCharacter(null)
    setViewingHistoryReading(false)

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
          <div className="landing-bg">
            {/* 背景画像。ドアのボタンと同じ寸法の式（landing-stage）で置くので、どの画面・ブラウザでもドアとボタンの位置が一致する */}
            <div className="landing-stage landing-stage-bg">
              <img src="/assets/index001.jpg" alt="" className="landing-bg-image" draggable={false} />
            </div>
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
                  <button onClick={openHistory} className="landing-history-button">
                    📜 診断履歴
                  </button>
                )}
                {authenticated && (
                  <button onClick={handleLogout} className="landing-logout-button">
                    ログアウト
                  </button>
                )}
              </div>
            </div>

            {/* ドア（ログイン済みなら form 画面へ、未ログインなら Google ログイン） */}
            <div className="landing-stage">
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
            </div>

            {/* ゲスト診断リンク（ログイン済みには不要） */}
            {!authenticated && (
              <div className="landing-guest">
                <button onClick={handleStartGuest} className="guest-button">
                  ゲスト診断を試す
                </button>
              </div>
            )}

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

  // ========== 案内役（ムスビ）会話シーン ==========
  if (screen === 'guide-conversation') {
    const isTyping = typedLength < currentDialogueText.length
    return (
      <div className="vn-scene" style={{ backgroundImage: 'url(/assets/room001.jpg)' }}>
        <div className="vn-character-bust-wrap">
          <img
            src={`/assets/characters/0-musubi/ham00${guideExpression}.webp`}
            alt="ムスビ"
            className="vn-character-bust"
          />
        </div>
        {guideDialogue && (
          <div className="vn-dialogue-box" onClick={() => handleDialogueBoxClick(handleGuideContinue)}>
            <div className="vn-speaker-name">ムスビ</div>
            <p className="vn-dialogue-text">{currentDialogueText.slice(0, typedLength)}</p>
            {!isTyping && <div className="vn-continue-hint">▼</div>}
          </div>
        )}
      </div>
    )
  }

  // ========== ゲスト体験フロー：ムスビとの会話（フォーム前／結果後） ==========
  if (screen === 'guest-conversation') {
    const isTyping = typedLength < currentDialogueText.length
    // 初対面の第一声（pre-form の最初の1文）だけは、まだキャラクターを見せない
    const showCharacter = !(guestPhase === 'pre-form' && guestStep === 0)
    return (
      <div className="vn-scene" style={{ backgroundImage: 'url(/assets/index001.jpg)' }}>
        <div className="vn-character-bust-wrap">
          {showCharacter && (
            <img
              key="guest-musubi"
              src="/assets/characters/0-musubi/ham003.webp"
              alt="???"
              className="vn-character-bust"
            />
          )}
        </div>
        <div className="vn-dialogue-box" onClick={() => handleDialogueBoxClick(handleGuestDialogueClick)}>
          <div className="vn-speaker-name">???</div>
          <p className="vn-dialogue-text">{currentDialogueText.slice(0, typedLength)}</p>
          {!isTyping && <div className="vn-continue-hint">▼</div>}
        </div>
      </div>
    )
  }

  // ========== ゲスト体験フロー：お別れ（フェードアウト＋お礼メッセージ） ==========
  if (screen === 'guest-farewell') {
    return (
      <div
        className="farewell-container"
        style={{ backgroundImage: 'url(/assets/index001.jpg)' }}
        onClick={handleGuestFarewellDone}
      >
        <div className="farewell-white-overlay"></div>
        <div className="farewell-message">
          ゲスト診断を体験してくれてありがとう！
          <br />
          ドアからログインをすると、全サービスが遊べるよ！
        </div>
      </div>
    )
  }

  // ========== 初回ログイン（サインアップ）チュートリアル ==========
  if (screen === 'tutorial' && currentTutorialStep) {
    const step = currentTutorialStep
    const isTyping = typedLength < currentDialogueText.length
    const background = tutorialSegment === 'intro' ? '/assets/index001.jpg' : '/assets/room001.jpg'

    if (step.type === 'narration') {
      return (
        <div
          className="vn-scene vn-scene-narration"
          style={{ backgroundImage: `url(${background})` }}
          onClick={() => handleDialogueBoxClick(handleTutorialAdvance)}
        >
          <div className="vn-narration-box">
            <p className="vn-narration-text">{currentDialogueText.slice(0, typedLength)}</p>
            {!isTyping && <div className="vn-continue-hint vn-continue-hint-narration">▼</div>}
          </div>
        </div>
      )
    }

    if (step.type === 'itemReveal') {
      return (
        <div
          className="vn-scene item-reveal-scene"
          style={{ backgroundImage: `url(${background})` }}
          onClick={handleTutorialAdvance}
        >
          <div className="item-reveal-frame-wrap">
            <img src="/assets/ui/flame101.webp" alt="" className="item-reveal-frame" />
            <img src={step.image} alt="" className="item-reveal-item" />
          </div>
        </div>
      )
    }

    if (step.type === 'handoff') {
      // 通常到達しない（handoffは advance 時に即座に処理されるため）
      return null
    }

    // step.type === 'dialogue'
    const TUTORIAL_CHARACTER_FOLDERS: Record<string, string> = {
      musubi: '0-musubi',
      natsume: '1-natsume',
      tsuki: '2-tsuki',
      kokuu: '3-kokuu',
      kuri: '4-kuri',
    }
    const folder = TUTORIAL_CHARACTER_FOLDERS[step.character ?? 'musubi'] ?? '0-musubi'
    return (
      <div className="vn-scene" style={{ backgroundImage: `url(${background})` }}>
        {step.image && (
          <div className="vn-character-bust-wrap">
            <img
              src={`/assets/characters/${folder}/${step.image}.webp`}
              alt={step.character ?? ''}
              className="vn-character-bust"
            />
          </div>
        )}
        <div className="vn-dialogue-box" onClick={() => handleDialogueBoxClick(handleTutorialAdvance)}>
          {step.speaker && <div className="vn-speaker-name">{step.speaker}</div>}
          <p className="vn-dialogue-text">{currentDialogueText.slice(0, typedLength)}</p>
          {!isTyping && <div className="vn-continue-hint">▼</div>}
        </div>
      </div>
    )
  }

  // ========== フォーム画面（占い場） ==========
  const requiredStoneCost = DIAGNOSIS_STONE_COST[selectedCharacterId as CharacterId] ?? 1
  if (screen === 'form') {
    return (
      <div
        className="form-container"
        style={{ backgroundImage: mode === 'guest' ? 'url(/assets/index001.jpg)' : 'url(/assets/room001.jpg)' }}
      >
        {loading && <HamsterLoading message={loadingMessage} />}
        <div className="form-overlay">
          <div className="form-header" style={mode === 'guest' ? { justifyContent: 'flex-end' } : undefined}>
            {mode !== 'guest' && <h1>占いの館</h1>}
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
            <BirthDateInput id="birthDate" value={birthDate} onChange={setBirthDate} />
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
            <label htmlFor="concern">悩み・状況（任意）</label>
            <textarea
              id="concern"
              placeholder="未入力の場合は、生年月日・出生時刻・出生地から総合的に診断します。（例: キャリアチェンジを考えています。今後の方向性について知りたいです。）"
              value={concern}
              onChange={(e) => setConcern(e.target.value)}
              rows={4}
            />
          </div>

          {error && <div className="error">{error}</div>}

          {duplicateNotice && (
            <div className="duplicate-notice">
              <p>{duplicateNotice.message}</p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => viewHistoryItem(duplicateNotice.existingReadingId)}
              >
                過去の診断結果を確認
              </button>
              <p className="duplicate-notice-hint">※ 悩み・状況を入力すると、改めて診断できます</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (authenticated && stoneBalance !== null && stoneBalance < requiredStoneCost)}
            className="primary-button"
          >
            {loading ? '診断中...' : `診断を実行（石${requiredStoneCost}個）`}
          </button>

          {mode === 'guest' && (
            <p className="guest-notice">
              ゲストモードでは1日1回までの診断が可能です。複数回試したい場合はログインしてください。
            </p>
          )}
          {authenticated && stoneBalance !== null && stoneBalance < requiredStoneCost && (
            <p className="guest-notice">
              ルーンストーンが足りません（必要: {requiredStoneCost}個）。広告を見るか、また明日ログインボーナスを受け取ってください。
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
      <div
        className="form-container"
        style={{ backgroundImage: mode === 'guest' ? 'url(/assets/index001.jpg)' : 'url(/assets/room001.jpg)' }}
      >
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
          {reading.westernZodiac ? (
            <div className="result-section">
              <h2>【西洋占星術】</h2>
              <div className="bazi-result">
                <div>星座: <strong>{reading.westernZodiac.sign}</strong></div>
                <div>エレメント: {reading.westernZodiac.element}</div>
                <div>モダリティ: {reading.westernZodiac.modality}</div>
                <div>支配星: {reading.westernZodiac.rulingPlanet}</div>
              </div>
            </div>
          ) : reading.mbtiResult ? (
            <div className="result-section">
              <h2>【性格診断（16タイプ）】</h2>
              <MBTIResultCard result={reading.mbtiResult} />
            </div>
          ) : reading.loveTypeResult ? (
            <div className="result-section">
              <h2>【ラブタイプ診断64】</h2>
              <div className="bazi-result">
                <div>タイプ: <strong>{reading.loveTypeResult.fullType}</strong>（{reading.loveTypeResult.characterName} × {reading.loveTypeResult.subTypeName}）</div>
                <div>{reading.loveTypeResult.characterDesc}</div>
                <div className="love-subtype-tagline">{reading.loveTypeResult.subTypeTagline}</div>
                <ul>
                  {reading.loveTypeResult.subTypeTraits.map((trait, i) => (
                    <li key={i}>{trait}</li>
                  ))}
                </ul>
              </div>
              <LoveResultExtras fullType={reading.loveTypeResult.fullType} />
            </div>
          ) : reading.baZi && reading.numerology && reading.kyuseiSeisun ? (
            <>
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
            </>
          ) : null}

          {reading.palm && (
            <div className="result-section">
              <h2>【手相の読み取り】</h2>
              <PalmAnnotatedResult imageUrl={reading.palm.imageUrl} lines={reading.palm.lines} />
            </div>
          )}

          <div className="result-section">
            <h2>【総合結論】</h2>
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
                {displayAnalysis(reading.analysis)}
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

          <div className="share-section">
            <button onClick={handleShareToX} className="share-x-button">
              𝕏でシェア
            </button>
            <button onClick={handleCopyShareText} className="share-copy-button">
              {shareCopied ? 'コピーしました！' : 'テキストをコピー'}
            </button>
          </div>

          <div className="result-actions">
            <button onClick={handleNewReading} className="primary-button">
              新しい診断
            </button>
            <button onClick={handleBack} className="secondary-button">
              {mode === 'guest' && !viewingHistoryReading ? '占いの館を出る' : '戻る'}
            </button>
          </div>
        </div>
        </div>
      </div>
    )
  }

  // ========== 診断履歴画面 ==========
  if (screen === 'history') {
    return (
      <div className="form-container" style={{ backgroundImage: 'url(/assets/room001.jpg)' }}>
        <div className="form-overlay">
          <div className="form-header">
            <h1>診断履歴</h1>
            <button onClick={() => setScreen('landing')} className="logout-button">
              戻る
            </button>
          </div>

          {error && <div className="error">{error}</div>}

          {historyLoading ? (
            <p className="guest-notice">読み込み中...</p>
          ) : readingHistory.length === 0 ? (
            <p className="guest-notice">まだ診断履歴がありません。診断を実行すると、ここに記録されます。</p>
          ) : (
            <ul className="history-list">
              {readingHistory.map((r) => {
                const character = r.characterId !== null ? CHARACTER_MASTER_DATA[r.characterId as CharacterId] : null
                const date = new Date(r.createdAt).toLocaleDateString('ja-JP', {
                  year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                })
                return (
                  <li key={r.id} className="history-item" onClick={() => viewHistoryItem(r.id)}>
                    <div className="history-item-header">
                      <span className="history-date">{date}</span>
                      {character && <span className="history-character">{character.name}</span>}
                    </div>
                    <p className="history-concern">{r.concern}</p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    )
  }

  // ========== 相性診断フォーム画面 ==========
  if (screen === 'compatibility') {
    return (
      <div className="form-container" style={{ backgroundImage: 'url(/assets/room001.jpg)' }}>
        {compatLoading && <HamsterLoading message={loadingMessage} />}
        <div className="form-overlay">
          <div className="form-header">
            <h1>💞 相性診断</h1>
            <button onClick={() => setScreen('landing')} className="logout-button">
              戻る
            </button>
          </div>

          <form onSubmit={handleCompatibilitySubmit} className="form">
            <div className="compatibility-person">
              <h2>Aさん</h2>
              <div className="form-group">
                <label htmlFor="compatNameA">お名前（任意）</label>
                <input
                  id="compatNameA"
                  type="text"
                  placeholder="例: たろう"
                  value={compatNameA}
                  onChange={(e) => setCompatNameA(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="compatBirthDateA">生年月日 *</label>
                <BirthDateInput id="compatBirthDateA" value={compatBirthDateA} onChange={setCompatBirthDateA} />
              </div>
              <div className="form-group">
                <label htmlFor="compatBirthTimeA">出生時刻（任意）</label>
                <input
                  id="compatBirthTimeA"
                  type="time"
                  value={compatBirthTimeA}
                  onChange={(e) => setCompatBirthTimeA(e.target.value)}
                />
              </div>
            </div>

            <div className="compatibility-person">
              <h2>Bさん</h2>
              <div className="form-group">
                <label htmlFor="compatNameB">お名前（任意）</label>
                <input
                  id="compatNameB"
                  type="text"
                  placeholder="例: はなこ"
                  value={compatNameB}
                  onChange={(e) => setCompatNameB(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="compatBirthDateB">生年月日 *</label>
                <BirthDateInput id="compatBirthDateB" value={compatBirthDateB} onChange={setCompatBirthDateB} />
              </div>
              <div className="form-group">
                <label htmlFor="compatBirthTimeB">出生時刻（任意）</label>
                <input
                  id="compatBirthTimeB"
                  type="time"
                  value={compatBirthTimeB}
                  onChange={(e) => setCompatBirthTimeB(e.target.value)}
                />
              </div>
            </div>

            {error && <div className="error">{error}</div>}

            <button type="submit" className="primary-button" disabled={compatLoading}>
              相性を診断する
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ========== 相性診断結果画面 ==========
  if (screen === 'compatibility-result' && compatResult) {
    return (
      <div className="form-container" style={{ backgroundImage: 'url(/assets/room001.jpg)' }}>
        <div className="form-overlay">
          <div className="form-header">
            <h1>相性診断結果</h1>
            <button onClick={() => setScreen('landing')} className="logout-button">
              戻る
            </button>
          </div>

          <div className="result">
            <div className="result-section">
              <h2>【{compatResult.personA?.label}】</h2>
              <div>日干: {compatResult.personA?.baZi.dayStem} / ライフパスナンバー: <strong>{compatResult.personA?.numerology.lifePathNumber}</strong> / 本命星: <strong>{compatResult.personA?.kyuseiSeisun}</strong></div>
            </div>

            <div className="result-section">
              <h2>【{compatResult.personB?.label}】</h2>
              <div>日干: {compatResult.personB?.baZi.dayStem} / ライフパスナンバー: <strong>{compatResult.personB?.numerology.lifePathNumber}</strong> / 本命星: <strong>{compatResult.personB?.kyuseiSeisun}</strong></div>
            </div>

            <div className="result-section">
              <h2>【AI相性診断】</h2>
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
                  {displayAnalysis(compatResult.analysis ?? "")}
                </Markdown>
              </div>
              {compatResult.cached && <small className="cache-notice">※ キャッシュから取得</small>}
            </div>

            {error && <div className="error">{error}</div>}

            <div className="result-actions">
              <button onClick={() => setScreen('compatibility')} className="primary-button">
                もう一度診断する
              </button>
              <button onClick={() => setScreen('landing')} className="secondary-button">
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
    if (pendingMeetingCheck) {
      return <div className="app-container" />
    }
    return (
      <div className="app-container">
        <CharacterSelectionPage
          onCharacterSelected={(characterId, kuriMode) => {
            setSelectedCharacterId(characterId)
            if (characterId === 4) {
              // クリ：生年月日フォームではなく、選んだ方のクイズ画面へ
              const mode = kuriMode ?? 'mbti'
              setKuriDiagnosisMode(mode)
              setScreen(mode === 'love64' ? 'love64-quiz' : 'mbti-quiz')
            } else if (characterId === 3) {
              // コクウ：手相診断。スマホ本体なら直接撮影、PCならQRコードでスマホに連携
              setScreen(isMobileDevice() ? 'palm-capture' : 'palm-qr-handoff')
            } else {
              setScreen('form')
            }
          }}
        />
      </div>
    )
  }

  // 性格診断（16タイプ診断）クイズ画面（クリ専用）
  if (screen === 'mbti-quiz') {
    return (
      <div className="app-container">
        <MBTIQuizPage
          onCancel={() => setScreen('character-selection')}
          onComplete={(response) => {
            if (typeof response.stoneBalance === 'number') {
              setStoneBalance(response.stoneBalance)
            }
            setJustUnlockedCharacter(
              response.intimacy?.justUnlocked !== null && response.intimacy?.justUnlocked !== undefined
                ? (response.intimacy.justUnlocked as CharacterId)
                : null
            )
            setReading({
              mbtiResult: response.result,
              analysis: response.analysis || '',
              cached: response.cached,
            })
            setViewingHistoryReading(false)
            setScreen('result')
          }}
        />
      </div>
    )
  }

  // ラブタイプ診断64 クイズ画面（クリ専用）
  if (screen === 'love64-quiz') {
    return (
      <div className="app-container">
        <LoveType64QuizPage
          onCancel={() => setScreen('character-selection')}
          onComplete={(response) => {
            if (typeof response.stoneBalance === 'number') {
              setStoneBalance(response.stoneBalance)
            }
            setJustUnlockedCharacter(
              response.intimacy?.justUnlocked !== null && response.intimacy?.justUnlocked !== undefined
                ? (response.intimacy.justUnlocked as CharacterId)
                : null
            )
            setReading({
              loveTypeResult: response.result,
              analysis: response.analysis || '',
              cached: response.cached,
            })
            setViewingHistoryReading(false)
            setScreen('result')
          }}
        />
      </div>
    )
  }

  // 手相診断：スマホ本体からの直接撮影画面（コクウ専用）
  if (screen === 'palm-capture') {
    return (
      <div className="app-container">
        <PalmCapturePage
          onCancel={() => setScreen('character-selection')}
          onComplete={(response) => {
            if (typeof response.stoneBalance === 'number') {
              setStoneBalance(response.stoneBalance)
            }
            setJustUnlockedCharacter(
              response.intimacy?.justUnlocked !== null && response.intimacy?.justUnlocked !== undefined
                ? (response.intimacy.justUnlocked as CharacterId)
                : null
            )
            setReading({
              analysis: response.analysis || '',
              palm: response.image && response.lines && response.lines.length > 0
                ? { imageUrl: `data:${response.image.mimeType};base64,${response.image.base64}`, lines: response.lines }
                : null,
            })
            setViewingHistoryReading(false)
            setScreen('result')
          }}
        />
      </div>
    )
  }

  // 手相診断：PC側のQRコード表示・スマホ連携待ち画面（コクウ専用）
  if (screen === 'palm-qr-handoff') {
    return (
      <div className="app-container">
        <PalmQRHandoffPage
          onCancel={() => setScreen('character-selection')}
          onComplete={(response) => {
            if (typeof response.stoneBalance === 'number') {
              setStoneBalance(response.stoneBalance)
            }
            setJustUnlockedCharacter(
              response.intimacy?.justUnlocked !== null && response.intimacy?.justUnlocked !== undefined
                ? (response.intimacy.justUnlocked as CharacterId)
                : null
            )
            setReading({
              analysis: response.analysis || '',
              palm: response.image && response.lines && response.lines.length > 0
                ? { imageUrl: `data:${response.image.mimeType};base64,${response.image.base64}`, lines: response.lines }
                : null,
            })
            setViewingHistoryReading(false)
            setScreen('result')
          }}
        />
      </div>
    )
  }

  return null
}

// 画面端に常時表示する設定ボタン（BGM/SEのON・OFF切り替え）
function SettingsButton() {
  const [open, setOpen] = useState(false)
  const [bgmOn, setBgmOn] = useState(!isBgmMuted())
  const [seOn, setSeOn] = useState(!isSeMuted())
  // 音量は 0〜100（％）で扱う。保存は audio.ts 側（0〜1）
  const [bgmVol, setBgmVol] = useState(Math.round(getBgmVolume() * 100))
  const [seVol, setSeVol] = useState(Math.round(getSeVolume() * 100))

  const changeBgmVolume = (percent: number) => {
    setBgmVol(percent)
    setBgmVolume(percent / 100)
  }

  const changeSeVolume = (percent: number) => {
    setSeVol(percent)
    setSeVolume(percent / 100)
  }

  const toggleBgm = () => {
    const next = !bgmOn
    setBgmOn(next)
    setBgmMuted(!next)
  }

  const toggleSe = () => {
    const next = !seOn
    setSeOn(next)
    setSeMuted(!next)
  }

  return (
    <div className="settings-widget">
      <button
        type="button"
        className="settings-button"
        onClick={() => setOpen(!open)}
        aria-label="設定"
      >
        ⚙️
      </button>
      {open && (
        <div className="settings-panel">
          <button type="button" className="settings-toggle-row" onClick={toggleBgm}>
            <span>BGM</span>
            <span>{bgmOn ? 'ON' : 'OFF'}</span>
          </button>
          <label className={`settings-volume-row${bgmOn ? '' : ' is-off'}`}>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={bgmVol}
              disabled={!bgmOn}
              aria-label="BGMの音量"
              onChange={(e) => changeBgmVolume(Number(e.target.value))}
            />
            <span className="settings-volume-value">{bgmVol}%</span>
          </label>
          <button type="button" className="settings-toggle-row" onClick={toggleSe}>
            <span>SE</span>
            <span>{seOn ? 'ON' : 'OFF'}</span>
          </button>
          <label className={`settings-volume-row${seOn ? '' : ' is-off'}`}>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={seVol}
              disabled={!seOn}
              aria-label="効果音の音量"
              onChange={(e) => changeSeVolume(Number(e.target.value))}
              // 離したときに、ノック音を1回鳴らして、音量を確かめられるようにする
              onPointerUp={() => playKnock()}
              onKeyUp={() => playKnock()}
            />
            <span className="settings-volume-value">{seVol}%</span>
          </label>
        </div>
      )}
    </div>
  )
}

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AppContent />
      <SettingsButton />
    </GoogleOAuthProvider>
  )
}

export default App

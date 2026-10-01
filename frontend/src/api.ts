/**
 * Backend API クライアント
 */

export interface FortuneRequest {
  birthDate: string
  birthTime?: string
  birthPlace?: string
  concern: string
  characterId?: number
}

export interface BaZiPillar {
  stem: string
  branch: string
  element: string
}

export interface BaZiChart {
  yearPillar: BaZiPillar
  monthPillar: BaZiPillar
  dayPillar: BaZiPillar
  timePillar: BaZiPillar
  dayStem: string
}

export interface NumerologyResult {
  lifePathNumber: number
  isMasterNumber: boolean
}

export interface WesternZodiac {
  sign: string
  element: string
  modality: string
  rulingPlanet: string
}

export interface MBTIDimensionResult {
  traitA: string
  traitB: string
  percentageA: number
  percentageB: number
  winner: string
}

export interface MBTIQuizResult {
  personalityType: string
  dimensions: Record<'EI' | 'SN' | 'TF' | 'JP' | 'AT', MBTIDimensionResult>
}

export interface LoveType64Result {
  type1: string
  type2: string
  fullType: string
  scores: Record<'LF' | 'CA' | 'PR' | 'OE' | 'VN' | 'DI', number>
  characterName: string
  characterDesc: string
  subTypeName: string
  subTypeTagline: string
  subTypeTraits: string[]
}

export interface FortuneReading {
  baZi?: BaZiChart | null
  numerology?: NumerologyResult | null
  kyuseiSeisun?: string | null
  westernZodiac?: WesternZodiac | null
  mbtiResult?: MBTIQuizResult | null
  loveTypeResult?: LoveType64Result | null
  analysis: string
  tokensUsed?: number
  cached?: boolean
}

export interface IntimacyResult {
  characterId: number
  intimacyLevel: number
  justUnlocked: number | null
}

export interface FortuneResponse {
  success: boolean
  reading?: FortuneReading
  intimacy?: IntimacyResult | null
  stoneBalance?: number | null
  error?: string
  duplicate?: boolean
  existingReadingId?: string
  message?: string
}

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// トークン管理
export function getToken(): string | null {
  return localStorage.getItem('authToken')
}

export function setToken(token: string): void {
  localStorage.setItem('authToken', token)
}

export function clearToken(): void {
  localStorage.removeItem('authToken')
}

// ユーザーメール管理
export function getUserEmail(): string | null {
  return localStorage.getItem('userEmail')
}

export function setUserEmail(email: string): void {
  localStorage.setItem('userEmail', email)
}

export function clearUserEmail(): void {
  localStorage.removeItem('userEmail')
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

// API ヘッダーに認証情報を追加
function getAuthHeaders() {
  const token = getToken()
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

// Google OAuth ログイン
export interface GoogleAuthResponse {
  success: boolean
  token?: string
  isNewUser?: boolean
  user?: {
    userId: string
    email: string
    name: string
  }
  error?: string
}

export async function authenticateWithGoogle(idToken: string): Promise<GoogleAuthResponse> {
  const response = await fetch(`${API_URL}/api/auth/google`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ idToken })
  })

  if (!response.ok) {
    const error = await response.json()
    return {
      success: false,
      error: error.error || 'Authentication failed'
    }
  }

  const data = await response.json()
  if (data.success && data.token) {
    setToken(data.token)
    // ✅ ユーザーメールアドレスも保存
    if (data.user?.email) {
      setUserEmail(data.user.email)
    }
  }
  return data
}

// ログアウト
export async function logout(): Promise<{ success: boolean }> {
  try {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders()
    })
  } catch (error) {
    console.error('Logout error:', error)
  }
  clearToken()
  clearUserEmail()  // ✅ ユーザーメールもクリア
  return { success: true }
}

export async function callFortuneAPI(request: FortuneRequest): Promise<FortuneResponse> {
  const response = await fetch(`${API_URL}/api/fortune`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(request)
  })

  if (!response.ok) {
    // 429: レート制限エラー
    if (response.status === 429) {
      return {
        success: false,
        error: '本日の診断回数上限に達しました。明日もう一度お試しください。'
      }
    }

    // その他のエラー
    try {
      const error = await response.json()
      return {
        success: false,
        error: error.message || error.error || 'Failed to call fortune API'
      }
    } catch (e) {
      // JSON パースに失敗した場合
      return {
        success: false,
        error: `エラーが発生しました (${response.status})`
      }
    }
  }

  return await response.json()
}

export async function submitFeedback(readingId: string, comment: string): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(`${API_URL}/api/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ readingId, comment })
  })

  if (!response.ok) {
    const error = await response.json()
    return {
      success: false,
      error: error.error || 'Failed to submit feedback'
    }
  }

  return await response.json()
}

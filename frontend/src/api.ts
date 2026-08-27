/**
 * Backend API クライアント
 */

export interface FortuneRequest {
  birthDate: string
  birthTime?: string
  birthPlace?: string
  concern: string
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

export interface FortuneReading {
  baZi: BaZiChart
  numerology: NumerologyResult
  kyuseiSeisun: string
  analysis: string
  tokensUsed?: number
  cached?: boolean
}

export interface FortuneResponse {
  success: boolean
  reading?: FortuneReading
  error?: string
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

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
  return { success: true }
}

export async function callFortuneAPI(request: FortuneRequest): Promise<FortuneResponse> {
  const response = await fetch(`${API_URL}/api/fortune`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(request)
  })

  if (!response.ok) {
    const error = await response.json()
    return {
      success: false,
      error: error.error || 'Failed to call fortune API'
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

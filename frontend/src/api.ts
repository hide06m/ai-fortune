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

export async function callFortuneAPI(request: FortuneRequest): Promise<FortuneResponse> {
  const response = await fetch(`${API_URL}/api/fortune`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
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

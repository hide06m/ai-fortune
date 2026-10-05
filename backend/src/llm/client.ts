/**
 * Google Gemini API ラッパー
 */

import dotenv from 'dotenv'
dotenv.config()

import { GoogleGenerativeAI } from '@google/generative-ai'

const apiKey = process.env.GEMINI_API_KEY

console.log('🔑 GEMINI_API_KEY loaded:', !!apiKey)
console.log('🔑 API key length:', apiKey?.length || 'undefined')

if (!apiKey) {
  console.error('❌ ERROR: GEMINI_API_KEY is not set!')
  process.exit(1)
}

const genAI = new GoogleGenerativeAI(apiKey)

// temperatureを下げめにすることで、同じ命式に対する診断内容（強み・向いている職業など）の
// ブレを抑える。0にすると表現が硬く単調になりやすいため、自然な文章の幅は残す程度に留める。
// アンカー（anchors.ts）による内容の一貫性担保とあわせて、内容と文章表現のブレを両方抑える狙い。
const DIAGNOSIS_TEMPERATURE = 0.55

/**
 * Gemini の一時的な混雑（503/429）やネットワーク断のとき、少し待って再試行する。
 * 診断ごとに石を消費しているので、一時エラーはユーザーに見せずに吸収したい。
 */
const MAX_ATTEMPTS = 3
const RETRY_DELAYS_MS = [1500, 3500]

function isTransientError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return /[(429|500|502|503|504)[ ]]/.test(msg) || /fetch failed|ECONNRESET|ETIMEDOUT|network/i.test(msg)
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS || !isTransientError(error)) throw error
      const delay = RETRY_DELAYS_MS[attempt - 1] ?? 3500
      console.warn(`[Gemini] 一時的なエラーのため${delay}ms後に再試行します（${attempt}/${MAX_ATTEMPTS - 1}）`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}

export interface FortuneAnalysisResult {
  analysis: string
  tokensUsed: number
}

/**
 * 占術計算結果を Gemini で統合診断文に変換
 */
export async function generateFortuneAnalysis(
  fortuneDescription: string,
  concernText: string
): Promise<FortuneAnalysisResult> {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      generationConfig: { temperature: DIAGNOSIS_TEMPERATURE }
    })

    const hasConcern = !!concernText && concernText.trim().length > 0
    const concernSection = hasConcern ? `\n\nユーザーの悩み・現在の状況:\n${concernText}` : ''
    const prompt = `${fortuneDescription}${concernSection}\n\nこの情報から統合された診断文を生成してください。親切で前向きなメッセージにしてください。`

    const result = await withRetry(() => model.generateContent(prompt))
    const analysis = result.response.text()

    return {
      analysis,
      tokensUsed: 0 // Gemini は token count がないため 0
    }
  } catch (error) {
    console.error('Error calling Gemini API:', error)
    throw error
  }
}

/**
 * 画像（手のひらの写真）とプロンプトを一緒に Gemini（マルチモーダル）に渡して診断文を生成する
 * 手相診断専用。四柱推命等と違い決定論的な計算層が無く、Geminiの画像解釈がそのまま結果になる
 */
export async function generateFromImagePrompt(
  prompt: string,
  imageBase64: string,
  mimeType: string
): Promise<FortuneAnalysisResult> {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      generationConfig: { temperature: DIAGNOSIS_TEMPERATURE }
    })

    const result = await withRetry(() => model.generateContent([
      { text: prompt },
      { inlineData: { data: imageBase64, mimeType } }
    ]))
    const analysis = result.response.text()

    return {
      analysis,
      tokensUsed: 0
    }
  } catch (error) {
    console.error('Error calling Gemini API (vision):', error)
    throw error
  }
}

/**
 * 完成済みのプロンプトをそのまま Gemini に渡して診断文を生成する
 * （相性診断など、独自の指示文をすべてプロンプト側で組み立て済みのケース用）
 */
export async function generateFromPrompt(prompt: string): Promise<FortuneAnalysisResult> {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      generationConfig: { temperature: DIAGNOSIS_TEMPERATURE }
    })
    const result = await withRetry(() => model.generateContent(prompt))
    const analysis = result.response.text()

    return {
      analysis,
      tokensUsed: 0
    }
  } catch (error) {
    console.error('Error calling Gemini API:', error)
    throw error
  }
}

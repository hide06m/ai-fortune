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
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' })

    const prompt = `${fortuneDescription}\n\nユーザーの悩み・現在の状況:\n${concernText}\n\nこの情報から統合された診断文を生成してください。親切で前向きなメッセージにしてください。`

    const result = await model.generateContent(prompt)
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

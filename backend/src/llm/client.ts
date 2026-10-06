/**
 * Google Gemini API ラッパー
 */

import dotenv from 'dotenv'
dotenv.config()

import { GoogleGenerativeAI, SchemaType, type GenerateContentRequest, type GenerateContentResult, type ModelParams } from '@google/generative-ai'

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

const TRANSIENT_STATUS_CODES = [429, 500, 502, 503, 504]

export function isTransientError(error: unknown): boolean {
  // @google/generative-ai のエラーは status を持つ（GoogleGenerativeAIFetchError）。無い場合はメッセージの "[503 …]" で判定
  const status = (error as { status?: number } | null)?.status
  if (typeof status === 'number' && TRANSIENT_STATUS_CODES.includes(status)) return true
  const msg = error instanceof Error ? error.message : String(error)
  return TRANSIENT_STATUS_CODES.some((code) => msg.includes(`[${code} `)) || /fetch failed|ECONNRESET|ETIMEDOUT|network/i.test(msg)
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = MAX_ATTEMPTS): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt >= maxAttempts || !isTransientError(error)) throw error
      const delay = RETRY_DELAYS_MS[attempt - 1] ?? 3500
      console.warn(`[Gemini] 一時的なエラーのため${delay}ms後に再試行します（${attempt}/${maxAttempts - 1}）`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}

/**
 * 使うモデルの優先順。先頭のモデルが混雑（503など）で、再試行しても通らないときだけ、次のモデルに切り替える。
 * 混雑が続くと、診断のたびに失敗して石の払い戻しになってしまうため。
 * 切り替え先は、画像入力とJSON出力（responseSchema）で実際に応答することを、2026-10-06 に確認した flash モデル。
 * （gemini-3.7-flash / 3.8-flash は同日に混雑、gemini-2.5-flash はこのキーでは 404、gemini-3-flash-preview は応答に約1分かかった）
 */
const MODEL_CHAIN = ['gemini-3.6-flash', 'gemini-3.5-flash']

/** 混雑で失敗したら次のモデルに切り替えながら generateContent する、簡易のモデル */
function fallbackModel(config: Omit<ModelParams, 'model'>) {
  return {
    async generateContent(request: string | GenerateContentRequest | Array<string | { text: string } | { inlineData: { data: string; mimeType: string } }>): Promise<GenerateContentResult> {
      // 最初のモデルで起きた本来のエラーを覚えておく。切り替え先が 404 などで失敗しても、利用者には本来の理由を返す
      let firstError: unknown
      for (let i = 0; i < MODEL_CHAIN.length; i++) {
        const name = MODEL_CHAIN[i]
        const model = genAI.getGenerativeModel({ ...config, model: name })
        try {
          // 先頭のモデルは通常どおり再試行する。切り替え先は、待ち時間を抑えるため再試行を減らす
          return await withRetry(() => model.generateContent(request as never), i === 0 ? MAX_ATTEMPTS : 2)
        } catch (error) {
          if (i === 0) {
            firstError = error
            // 混雑などの一時エラーでなければ（入力の誤りなど）、別のモデルでも直らないので、切り替えずに終える
            if (!isTransientError(error)) throw error
          } else {
            console.warn(`[Gemini] 切り替え先の ${name} も失敗しました:`, error instanceof Error ? error.message.slice(-100) : error)
          }
          if (i < MODEL_CHAIN.length - 1) {
            console.warn(`[Gemini] ${i === 0 ? '先頭の' : ''}${name} が使えないため、${MODEL_CHAIN[i + 1]} に切り替えます`)
          }
        }
      }
      throw firstError
    },
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
    const model = fallbackModel({
      generationConfig: { temperature: DIAGNOSIS_TEMPERATURE }
    })

    const hasConcern = !!concernText && concernText.trim().length > 0
    const concernSection = hasConcern ? `\n\nユーザーの悩み・現在の状況:\n${concernText}` : ''
    const prompt = `${fortuneDescription}${concernSection}\n\nこの情報から統合された診断文を生成してください。親切で前向きなメッセージにしてください。`

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
    const model = fallbackModel({
      generationConfig: { temperature: DIAGNOSIS_TEMPERATURE }
    })

    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { data: imageBase64, mimeType } }
    ])
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
 * 手相診断：手のひらの写真1枚とプロンプトを渡し、診断文と、検出済みの線ごとの読みをJSONで受け取る。
 * 線の検出・座標は画像処理側の仕事なので、Gemini には書かせない。返り値は未検証の生テキスト
 */
export async function generatePalmistryReadingJson(
  prompt: string,
  imageBase64: string,
  mimeType: string
): Promise<FortuneAnalysisResult> {
  try {
    const model = fallbackModel({
      generationConfig: {
        temperature: DIAGNOSIS_TEMPERATURE,
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            analysis: { type: SchemaType.STRING },
            lines: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  id: {
                    type: SchemaType.STRING,
                    format: 'enum',
                    enum: ['heart', 'head', 'life', 'fate', 'simian', 'marriage', 'sun', 'health'],
                  },
                  reading: { type: SchemaType.STRING },
                },
                required: ['id', 'reading'],
              },
            },
          },
          required: ['analysis', 'lines'],
        },
      },
    })

    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { data: imageBase64, mimeType } }
    ])
    return { analysis: result.response.text(), tokensUsed: 0 }
  } catch (error) {
    console.error('Error calling Gemini API (palmistry reading):', error)
    throw error
  }
}

/**
 * 完成済みのプロンプトをそのまま Gemini に渡して診断文を生成する
 * （相性診断など、独自の指示文をすべてプロンプト側で組み立て済みのケース用）
 */
export async function generateFromPrompt(prompt: string): Promise<FortuneAnalysisResult> {
  try {
    const model = fallbackModel({
      generationConfig: { temperature: DIAGNOSIS_TEMPERATURE }
    })
    const result = await model.generateContent(prompt)
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

/**
 * Google Gemini API ラッパー
 */

import dotenv from 'dotenv'
dotenv.config()

import { withLlmSlot } from './concurrency.js'
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
// 混雑（503）は、同じモデルに少し待って再試行しても、すぐには直らないことが多い。再試行は控えめにして、早めに別のモデルへ切り替える
const MAX_ATTEMPTS = 2
const RETRY_DELAYS_MS = [1500, 3500]

/**
 * 1回の呼び出しの待ち時間の上限。応答が返らないまま待ち続けると、診断が固まり、石も戻らないため。
 * 超えたら中断して、一時エラーとして扱う（再試行、または別モデルへの切り替え）。
 * 画像つきの診断は、通常でも十数秒かかることがあるため、短くしすぎない
 */
const REQUEST_TIMEOUT_MS = 40_000

/**
 * SDK のタイムアウトとは別に、呼び出し全体に掛ける「確実な上限」。
 * 万一 SDK のタイムアウトが効かない状況（応答の途中で止まるなど）でも、この時間で必ず制御が戻る
 */
function withHardTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Gemini request timed out after ${ms}ms`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

/** 1回の診断（再試行・モデルの切り替えを含む）にかけてよい時間の上限 */
const OVERALL_DEADLINE_MS = 100_000

const TRANSIENT_STATUS_CODES = [429, 500, 502, 503, 504]

export function isTransientError(error: unknown): boolean {
  // @google/generative-ai のエラーは status を持つ（GoogleGenerativeAIFetchError）。無い場合はメッセージの "[503 …]" で判定
  const status = (error as { status?: number } | null)?.status
  if (typeof status === 'number' && TRANSIENT_STATUS_CODES.includes(status)) return true
  const msg = error instanceof Error ? error.message : String(error)
  return (
    TRANSIENT_STATUS_CODES.some((code) => msg.includes(`[${code} `)) ||
    /fetch failed|ECONNRESET|ETIMEDOUT|network|aborted|timed? ?out/i.test(msg)
  )
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = MAX_ATTEMPTS, deadline = Infinity): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt >= maxAttempts || !isTransientError(error)) throw error
      const delay = RETRY_DELAYS_MS[attempt - 1] ?? 3500
      // 診断全体の時間の上限を超えそうなら、これ以上は待たずに失敗とする（払い戻しにつなげる）
      if (Date.now() + delay + REQUEST_TIMEOUT_MS > deadline) throw error
      const cause = (error as { cause?: { code?: string; message?: string } })?.cause
      console.warn(`[Gemini] 一時的なエラーのため${delay}ms後に再試行します（${attempt}/${maxAttempts - 1}）`, cause?.code ?? cause?.message ?? (error instanceof Error ? error.message.slice(0, 120) : ''))
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
// 先頭のモデルが混雑（503）のとき、次のモデルへ切り替える。2026-10-13 に、画像入力とJSON出力（responseSchema）で応答することを確認した flash 系を並べている。
// 先頭の2つが同時に混雑して全滅した日があったので、系統の違うモデルを後ろに足してある
// 最後の2つは、混雑で上が全滅したときの、最後の手段（応答は軽いモデル）
const MODEL_CHAIN = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3-flash-preview', 'gemini-3.7-flash', 'gemini-3.1-flash-lite']

/** 混雑で失敗したら次のモデルに切り替えながら generateContent する、簡易のモデル */
type GenerateRequest = string | GenerateContentRequest | Array<string | { text: string } | { inlineData: { data: string; mimeType: string } }>

function fallbackModel(config: Omit<ModelParams, 'model'>) {
  return {
    // 同時実行数の上限のもとで呼び出す（順番待ちが長すぎたら、失敗として返す。石は払い戻される）
    generateContent(request: GenerateRequest): Promise<GenerateContentResult> {
      return withLlmSlot(() => generateWithFallback(config, request))
    },
  }
}

async function generateWithFallback(config: Omit<ModelParams, 'model'>, request: GenerateRequest): Promise<GenerateContentResult> {
  // 最初のモデルで起きた本来のエラーを覚えておく。切り替え先が 404 などで失敗しても、利用者には本来の理由を返す
  let firstError: unknown
  const deadline = Date.now() + OVERALL_DEADLINE_MS
  for (let i = 0; i < MODEL_CHAIN.length; i++) {
    const name = MODEL_CHAIN[i]
    // 診断全体の時間の上限に達していたら、切り替え先も試さず、最初のエラーを返す
    if (i > 0 && Date.now() + REQUEST_TIMEOUT_MS > deadline) break
    const model = genAI.getGenerativeModel({ ...config, model: name }, { timeout: REQUEST_TIMEOUT_MS })
    try {
      // 先頭のモデルは通常どおり再試行する。切り替え先は、待ち時間を抑えるため再試行を減らす
      const startedAt = Date.now()
      const result = await withRetry(
        () => withHardTimeout(model.generateContent(request as never), REQUEST_TIMEOUT_MS + 5_000),
        MAX_ATTEMPTS,
        deadline
      )
      console.log(`[Gemini] ${name} 成功（${Math.round((Date.now() - startedAt) / 1000)}秒）`)
      return result
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

/**
 * Claude API 呼び出しラッパー
 */

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
})

export interface FortuneAnalysisResult {
  analysis: string
  tokensUsed: number
}

/**
 * 占術計算結果をLLMで統合診断文に変換
 */
export async function generateFortuneAnalysis(
  fortundescript: string,
  concernText: string
): Promise<FortuneAnalysisResult> {
  try {
    const response = await client.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `${fortundescript}\n\nユーザーの悩み・現在の状況:\n${concernText}\n\nこの情報から統合された占い診断文を生成してください。`
        }
      ]
    })

    const analysis = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')

    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)

    return {
      analysis,
      tokensUsed
    }
  } catch (error) {
    console.error('Error calling Claude API:', error)
    throw error
  }
}

/**
 * AI（Gemini）の生成に失敗したときの、共通の応答
 *
 * 失敗を、成功（200）の「診断文」として返すと、利用者には、結果のように見えてしまい、やり直しの導線も作れない。
 * 503 で、「失敗したこと」と「ルーンストーンはお返ししたこと」を、はっきり返す。画面は、同じ入力のまま、もう一度試せる。
 */

import { Response } from 'express'

export const LLM_FAILED_MESSAGE =
  '占いの精霊が少し混み合っているようです。しばらく待ってから、もう一度お試しください。（ルーンストーンは、お返ししました）'

export function llmFailed(res: Response, stoneBalance: number | null) {
  res.locals.diagnosisFailed = true
  return res.status(503).json({ success: false, error: 'LLM_FAILED', message: LLM_FAILED_MESSAGE, stoneBalance })
}

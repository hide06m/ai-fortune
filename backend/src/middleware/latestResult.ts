/**
 * 診断が成功したとき、その結果を「最新の結果」として保存するミドルウェア
 *
 * 診断のエンドポイントの応答（res.json）を横取りして、応答を返したあとに、非同期で保存する。
 * 保存に失敗しても、診断の応答には影響しない（ログだけ残す）。
 * 次の場合は、保存しない：未ログイン／失敗した診断／重複診断の案内／診断結果ではない応答
 */

import { Request, Response, NextFunction } from 'express'
import { saveLatestResult, type LatestKind } from '../db/latestResults.js'

interface CaptureSpec {
  /** どの種類の結果として保存するか（保存しないときは null） */
  kind: (req: Request, body: any) => LatestKind | null
  /** 応答の本体から、画面にそのまま出せる形の結果を取り出す（保存しないときは null） */
  payload: (body: any) => unknown | null
}

export function captureLatestResult(spec: CaptureSpec) {
  return (req: Request, res: Response, next: NextFunction) => {
    const original = res.json.bind(res)
    res.json = (body: any) => {
      try {
        if (req.isAuthenticated && req.user && body?.success === true && !body.duplicate && !res.locals.diagnosisFailed) {
          const kind = spec.kind(req, body)
          const payload = kind ? spec.payload(body) : null
          if (kind && payload) {
            saveLatestResult(req.user.userId, kind, payload).catch((error) => {
              console.error(`[latest-result] 保存に失敗しました（${kind}）:`, error)
            })
          }
        }
      } catch (error) {
        console.error('[latest-result] 保存の準備に失敗しました:', error)
      }
      return original(body)
    }
    next()
  }
}

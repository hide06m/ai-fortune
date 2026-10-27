/**
 * 診断が成功したとき、その結果を「最新の結果」として保存するミドルウェア
 *
 * 診断のエンドポイントの応答（res.json）を横取りして、応答を返したあとに、非同期で保存する。
 * 保存に失敗しても、診断の応答には影響しない（ログだけ残す）。
 * 次の場合は、保存しない：未ログイン／失敗した診断／重複診断の案内／診断結果ではない応答
 */

import { Request, Response, NextFunction } from 'express'
import { saveLatestResult, type LatestKind } from '../db/latestResults.js'
import { incrementStat, recordCollection, type CollectionKind } from '../db/collection.js'

interface CaptureSpec {
  /** どの種類の結果として保存するか（保存しないときは null） */
  kind: (req: Request, body: any) => LatestKind | null
  /** 応答の本体から、画面にそのまま出せる形の結果を取り出す（保存しないときは null） */
  payload: (body: any) => unknown | null
  /** 図鑑に載せるタイプ（あれば）。応答の本体から取り出す */
  collect?: (body: any) => { kind: CollectionKind; code: string } | null
}

export function captureLatestResult(spec: CaptureSpec) {
  return (req: Request, res: Response, next: NextFunction) => {
    const original = res.json.bind(res)
    res.json = (body: any) => {
      const pending: Promise<unknown>[] = []
      try {
        if (req.isAuthenticated && req.user && body?.success === true && !body.duplicate && !res.locals.diagnosisFailed) {
          const kind = spec.kind(req, body)
          const payload = kind ? spec.payload(body) : null
          if (kind && payload) {
            const userId = req.user.userId
            pending.push(saveLatestResult(userId, kind, payload).catch((error) => {
              console.error(`[latest-result] 保存に失敗しました（${kind}）:`, error)
            }))
            // 診断の回数（実績用）と、図鑑
            pending.push(incrementStat(userId, 'diagnoses').catch(() => {}))
            pending.push(incrementStat(userId, `kind:${kind}`).catch(() => {}))
            const c = spec.collect?.(body)
            if (c && c.code) pending.push(recordCollection(userId, c.kind, c.code).catch((error) => console.error('[collection] 記録に失敗しました:', error)))
          }
        }
      } catch (error) {
        console.error('[latest-result] 保存の準備に失敗しました:', error)
      }
      // Workers：返事を返すと DB の接続が閉じられるので、保存が終わってから返す
      if (process.env.CF_WORKER && pending.length) {
        void Promise.allSettled(pending).then(() => original(body))
        return res
      }
      return original(body)
    }
    next()
  }
}

/**
 * 手相診断のPC↔スマホ連携用セッション API
 * POST /api/palm-session            - PC側：ペアリングセッションを作成（QRコード用トークン発行）
 * GET  /api/palm-session/:token     - PC側：スマホの撮影完了をポーリングで確認
 * POST /api/palm-session/:token/upload - スマホ側：撮影した画像をアップロード
 */

import { Router, Request, Response } from 'express'
import { createPalmSession, getPalmSessionStatus, setPalmSessionImage, peekPalmSessionImage, requestPalmRetake } from '../palm/sessionStore.js'

const router = Router()

router.post('/', (req: Request, res: Response) => {
  const { token, expiresAt } = createPalmSession()
  res.json({ success: true, token, expiresAt })
})

router.get('/:token', (req: Request, res: Response) => {
  const status = getPalmSessionStatus(req.params.token)
  if (!status) {
    return res.status(404).json({ success: false, error: 'セッションが見つからないか、期限切れです' })
  }
  res.json({ success: true, status: status.status, retakeMessage: status.retakeMessage })
})

// PC側：解析のために、アップロードされた画像を取得する（消費しない。診断の送信で初めて破棄される）
router.get('/:token/image', (req: Request, res: Response) => {
  const image = peekPalmSessionImage(req.params.token)
  if (!image) {
    return res.status(404).json({ success: false, error: '画像がありません' })
  }
  res.json({ success: true, ...image })
})

// PC側：解析の結果、撮り直しが必要になったことをスマホへ伝える
router.post('/:token/retake', (req: Request, res: Response) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.slice(0, 200) : '撮り直してください'
  if (!requestPalmRetake(req.params.token, message)) {
    return res.status(404).json({ success: false, error: 'セッションが見つからないか、期限切れです' })
  }
  res.json({ success: true })
})

router.post('/:token/upload', (req: Request, res: Response) => {
  const { imageBase64, mimeType, lines } = req.body

  if (typeof imageBase64 !== 'string' || !imageBase64 || typeof mimeType !== 'string' || !mimeType.startsWith('image/')) {
    return res.status(400).json({ success: false, error: 'imageBase64（string）とmimeType（image/*）が必要です' })
  }

  const extras = { lines: Array.isArray(lines) ? lines : null }
  const ok = setPalmSessionImage(req.params.token, imageBase64, mimeType, extras)
  if (!ok) {
    return res.status(404).json({ success: false, error: 'セッションが見つからないか、期限切れです' })
  }

  res.json({ success: true })
})

export default router

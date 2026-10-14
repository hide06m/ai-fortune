/**
 * 同じユーザー（未ログインなら、同じIP）の診断を、同時に1つだけにする
 *
 * 二度押し・画面の再読み込み・通信の再送で、同じ診断が重なって走ると、ルーンストーンが二重に消えたり、
 * AI の呼び出しが無駄に増えたりする。実行中にもう一度来たら、409 で断る（先の診断は、そのまま続く）。
 */

import { Request, Response, NextFunction } from 'express'

const running = new Set<string>()

function keyOf(req: Request): string {
  if (req.user?.userId) return `user:${req.user.userId}`
  return `ip:${(req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown'}`
}

export function inFlightGuard(req: Request, res: Response, next: NextFunction) {
  const key = keyOf(req)
  if (running.has(key)) {
    return res.status(409).json({
      success: false,
      error: 'IN_PROGRESS',
      message: '診断を進めています。結果が出るまで、少しお待ちください。',
    })
  }
  running.add(key)
  let released = false
  const release = () => {
    if (released) return
    released = true
    running.delete(key)
  }
  res.on('finish', release)
  res.on('close', release)
  next()
}

/**
 * レート制限ミドルウェア
 * IP単位で「1日3回まで」の制限を実装
 */

import rateLimit from 'express-rate-limit'

// IP単位でのレート制限(1日3回)
export const dailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 3, // 3 requests per window
  keyGenerator: (req) => {
    // X-Forwarded-Forヘッダー優先(Render環境でのプロキシ対応)
    return (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown'
  },
  message: 'Too many fortune readings from this IP. Please try again tomorrow.',
  statusCode: 429,
  skip: (req) => {
    // ヘルスチェックエンドポイントはスキップ
    return req.path === '/health'
  }
})

// 開発環境用: 制限なし
export const noopLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000, // ほぼ無制限
  skip: () => process.env.NODE_ENV === 'development'
})

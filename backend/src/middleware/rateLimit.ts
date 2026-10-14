/**
 * レート制限ミドルウェア
 * ゲスト: IP単位で1日1回まで。
 * ログイン済み: ユーザー単位で1日20回までの「安全網」。実際の利用回数は石の残高
 *   （db/stones.ts、1診断=石1個）で制御されるため、こちらは石システムが万一
 *   悪用された場合の保険として緩めに設定している。
 */

import rateLimit from 'express-rate-limit'

const GUEST_DAILY_LIMIT = 1
const AUTHENTICATED_DAILY_LIMIT = 20

export const dailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: (req: any) => (req.user?.userId ? AUTHENTICATED_DAILY_LIMIT : GUEST_DAILY_LIMIT),
  keyGenerator: (req: any) => {
    // ログイン済みはユーザー単位、未ログインはIP単位でカウント
    if (req.user?.userId) return `user:${req.user.userId}`
    // X-Forwarded-Forヘッダー優先(Render環境でのプロキシ対応)
    return `ip:${(req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown'}`
  },
  message: 'Too many fortune readings today. Please try again tomorrow.',
  statusCode: 429,
  skip: (req: any) => req.path === '/health',
  // 診断（AIの生成）が失敗したときは、1日の回数に数えない。
  // 失敗は 200 で返ることもあるので、各ルートが res.locals.diagnosisFailed を立てたものも「失敗」とみなす
  skipFailedRequests: true,
  requestWasSuccessful: (_req: any, res: any) => res.statusCode < 400 && !res.locals?.diagnosisFailed && !res.locals?.skipDailyCount,
})

// 開発環境用: 制限なし
export const noopLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000, // ほぼ無制限
  skip: () => process.env.NODE_ENV === 'development'
})

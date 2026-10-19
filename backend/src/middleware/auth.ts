import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../auth/jwt.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        googleId: string;
      };
      isAuthenticated?: boolean;
    }
  }
}

/**
 * JWT 認証ミドルウェア
 * 認証済みユーザーの場合、req.user に情報を設定
 * 未認証の場合、req.isAuthenticated = false
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // 認証なし（ゲストモード）
    req.isAuthenticated = false;
    return next();
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);

  if (!decoded) {
    // トークン無効
    req.isAuthenticated = false;
    return next();
  }

  // トークン有効
  req.user = decoded;
  req.isAuthenticated = true;
  next();
}

/**
 * 認証が必須のルート用ミドルウェア
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated || !req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }
  next();
}

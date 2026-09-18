import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

interface UserPayload {
  userId: string;
  email: string;
  googleId: string;
}

const DEV_FALLBACK_SECRET = 'dev-only-insecure-secret-do-not-use-in-production';

/**
 * JWT署名用のシークレットを取得。
 * 本番（NODE_ENV=production）でJWT_SECRET未設定の場合は起動時に落とす
 * （固定値へのフォールバックはログイントークンの偽造を許してしまうため）。
 * 開発環境では利便性のためフォールバックを許可する。
 */
function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is not set. Refusing to start in production without it.');
  }

  console.warn('⚠️  JWT_SECRET is not set — using an insecure development-only fallback.');
  return DEV_FALLBACK_SECRET;
}

/**
 * JWT トークンを生成
 */
export function generateToken(user: UserPayload): string {
  return jwt.sign(user, getSecret(), {
    expiresIn: '30d',
  });
}

/**
 * JWT トークンを検証
 */
export function verifyToken(token: string): UserPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret()) as UserPayload;
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * 新規ユーザーの ID を生成
 */
export function generateUserId(): string {
  return uuidv4();
}

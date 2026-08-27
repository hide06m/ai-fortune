import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

interface UserPayload {
  userId: string;
  email: string;
  googleId: string;
}

/**
 * JWT トークンを生成
 */
export function generateToken(user: UserPayload): string {
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  return jwt.sign(user, secret, {
    expiresIn: '30d',
  });
}

/**
 * JWT トークンを検証
 */
export function verifyToken(token: string): UserPayload | null {
  try {
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.verify(token, secret) as UserPayload;
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

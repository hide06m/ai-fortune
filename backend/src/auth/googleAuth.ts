import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Google ID Token を検証して、ユーザー情報を取得する
 * @param idToken - Google から返された ID Token
 * @returns ユーザー情報（email, name, picture）
 */
export async function verifyGoogleToken(idToken: string) {
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new Error('Invalid token payload');
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name || '',
      picture: payload.picture || null,
    };
  } catch (error) {
    console.error('Google token verification failed:', error);
    throw new Error('Invalid Google token');
  }
}


import jwt, { type JwtPayload } from 'jsonwebtoken';
import { authConfig, jwtSecret } from '../config/auth.js';

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  sid?: string;
  address?: string;
}

export function signToken(payload: Record<string, unknown>): string {
  return jwt.sign(
    payload,
    jwtSecret(),
    typeof payload.exp === 'number'
      ? { algorithm: 'HS256' }
      : { algorithm: 'HS256', expiresIn: authConfig().accessTtlSeconds }
  );
}

export function verifyToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, jwtSecret(), { algorithms: ['HS256'] });
  if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
    throw new Error('Invalid token payload');
  }
  return decoded as AccessTokenPayload;
}

import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-testing-only-32-chars-long';

function base64UrlEncode(str: string | Buffer): string {
  const buffer = typeof str === 'string' ? Buffer.from(str) : str;
  return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

export function signToken(payload: Record<string, unknown>): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const data = base64UrlEncode(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
    })
  );

  const hmac = crypto.createHmac('sha256', JWT_SECRET);
  hmac.update(`${header}.${data}`);
  const signature = base64UrlEncode(hmac.digest());

  return `${header}.${data}.${signature}`;
}

export function verifyToken(token: string): { sub: string; [key: string]: unknown } {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [header, data, signature] = parts;

  const hmac = crypto.createHmac('sha256', JWT_SECRET);
  hmac.update(`${header}.${data}`);
  const expectedSignature = base64UrlEncode(hmac.digest());

  if (signature !== expectedSignature) {
    throw new Error('Invalid signature');
  }

  return JSON.parse(base64UrlDecode(data));
}

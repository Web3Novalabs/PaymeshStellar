import crypto from 'crypto';

const TOKEN_TTL_SECONDS = 60 * 60 * 24; // 24 hours

function getSecret(): string {
  return process.env.JWT_SECRET || 'fallback-secret-for-testing-only-32-chars-long';
}

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
  const now = Math.floor(Date.now() / 1000);
  const data = base64UrlEncode(
    JSON.stringify({
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
      ...payload,
    })
  );

  const hmac = crypto.createHmac('sha256', getSecret());
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

  const hmac = crypto.createHmac('sha256', getSecret());
  hmac.update(`${header}.${data}`);
  const expectedSignature = base64UrlEncode(hmac.digest());

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('Invalid signature');
  }

  const decoded = JSON.parse(base64UrlDecode(data)) as Record<string, unknown>;

  if (typeof decoded.exp === 'number' && decoded.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return decoded as { sub: string; [key: string]: unknown };
}

import { Keypair, Networks } from '@stellar/stellar-sdk';

const DEFAULT_ACCESS_TTL_SECONDS = 15 * 60;
const DEFAULT_REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_CHALLENGE_TTL_SECONDS = 5 * 60;

function positiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export function validateAuthEnvironment(): void {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV !== 'test' && (!secret || Buffer.byteLength(secret, 'utf8') < 32)) {
    throw new Error('JWT_SECRET must be set and contain at least 32 bytes');
  }

  if (process.env.NODE_ENV !== 'test') {
    const signingSecret = process.env.STELLAR_SIGNING_SECRET;
    if (!signingSecret) throw new Error('STELLAR_SIGNING_SECRET must be set');
    Keypair.fromSecret(signingSecret);
  }
}

export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    if (process.env.NODE_ENV === 'test') return 'test-only-jwt-secret-at-least-32-bytes';
    throw new Error('JWT_SECRET must be set and contain at least 32 bytes');
  }
  return secret;
}

export function authConfig() {
  const testKeypair = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 7));
  const signingSecret = process.env.STELLAR_SIGNING_SECRET;
  if (!signingSecret && process.env.NODE_ENV !== 'test') {
    throw new Error('STELLAR_SIGNING_SECRET must be set');
  }
  const signingKeypair = signingSecret ? Keypair.fromSecret(signingSecret) : testKeypair;

  return {
    accessTtlSeconds: positiveInteger('ACCESS_TOKEN_TTL_SECONDS', DEFAULT_ACCESS_TTL_SECONDS),
    refreshTtlSeconds: positiveInteger('REFRESH_TOKEN_TTL_SECONDS', DEFAULT_REFRESH_TTL_SECONDS),
    challengeTtlSeconds: positiveInteger('CHALLENGE_TTL_SECONDS', DEFAULT_CHALLENGE_TTL_SECONDS),
    cleanupIntervalSeconds: positiveInteger('AUTH_CLEANUP_INTERVAL_SECONDS', 60 * 60),
    homeDomain: process.env.STELLAR_HOME_DOMAIN || 'localhost',
    webAuthDomain: process.env.STELLAR_WEB_AUTH_DOMAIN || 'localhost',
    networkPassphrase: process.env.STELLAR_NETWORK || Networks.TESTNET,
    signingKeypair,
  };
}

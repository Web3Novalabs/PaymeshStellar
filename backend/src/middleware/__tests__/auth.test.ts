import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { NextFunction, Response } from 'express';
import request from 'supertest';
import { Keypair, TransactionBuilder } from '@stellar/stellar-sdk';
import { app } from '../../index.js';
import { authConfig } from '../../config/auth.js';
import { challengesService } from '../../services/challenges.js';
import { accountAuthService } from '../../services/sep10.js';
import { signToken, verifyToken } from '../../utils/jwt.js';
import { requireAuth, type AuthenticatedRequest } from '../auth.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-32-characters-minimum';

const ADDRESS = 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU';
const OTHER_ADDRESS = 'GAYO55R3JM3OHUB7W52QO7P6CDH5P3WTAF4V6QG4EIVTT6OJZIMIC75W';
const wallet = Keypair.random();

function issueToken(payload: Record<string, unknown> = {}): string {
  return signToken({ sub: ADDRESS, address: ADDRESS, ...payload });
}

interface HarnessState {
  statusCode?: number;
  body?: unknown;
}

/**
 * Builds a fake Express req/res/next triple so `requireAuth` can be exercised
 * directly (without spinning up an HTTP request) while still capturing the
 * status code and JSON body it writes on rejection.
 */
function createHarness() {
  const next = mock.fn<NextFunction>(() => {});
  const state: HarnessState = {};
  const res = {
    status(code: number) {
      state.statusCode = code;
      return {
        json: (body: unknown) => {
          state.body = body;
        },
      };
    },
  } as unknown as Response;
  const req = { headers: {} } as AuthenticatedRequest;

  return { req, res, next, state };
}

function assertUnauthorizedBody(body: unknown): void {
  const typed = body as { success: boolean; error: { code: string; message: string } };
  assert.strictEqual(typed.success, false);
  assert.strictEqual(typed.error.code, 'UNAUTHORIZED');
  assert.strictEqual(typeof typed.error.message, 'string');
  assert.ok(typed.error.message.length > 0, 'error message should not be empty');
}

beforeEach(async () => {
  mock.restoreAll();
  await challengesService.clear();
});

describe('verifyToken (JWT signing & verification)', () => {
  it('decodes a valid token with the expected claims', () => {
    const decoded = verifyToken(issueToken());

    assert.strictEqual(decoded.sub, ADDRESS);
    assert.strictEqual(decoded.address, ADDRESS);
    assert.strictEqual(typeof decoded.iat, 'number');
    assert.strictEqual(typeof decoded.exp, 'number');
    assert.ok((decoded.exp as number) > (decoded.iat as number), 'exp must be after iat');
  });

  it('rejects a token with the wrong number of segments', () => {
    assert.throws(() => verifyToken('only-one-segment'), /malformed|format/i);
    assert.throws(() => verifyToken('two.segments'), /malformed|format/i);
    assert.throws(() => verifyToken('four.segments.in.a.row'), /malformed|format/i);
  });

  it('rejects a tampered signature', () => {
    const parts = issueToken().split('.');
    const signature = parts[2].split('');
    signature[0] = signature[0] === 'A' ? 'B' : 'A';
    parts[2] = signature.join('');

    assert.throws(() => verifyToken(parts.join('.')), /signature/i);
  });

  it('rejects a tampered payload', () => {
    const parts = issueToken().split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    payload.sub = OTHER_ADDRESS;
    parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64url');

    assert.throws(() => verifyToken(parts.join('.')), /signature/i);
  });

  it('rejects an expired token without real waiting', () => {
    const expired = issueToken({ exp: Math.floor(Date.now() / 1000) - 1 });

    assert.throws(() => verifyToken(expired), /expired/i);
  });

  it('rejects a token signed with a different secret', () => {
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'a-completely-different-secret-32-chars';
    const foreignToken = signToken({ sub: ADDRESS, address: ADDRESS });
    process.env.JWT_SECRET = originalSecret;

    assert.throws(() => verifyToken(foreignToken), /signature/i);
  });
});

describe('requireAuth middleware (unit)', () => {
  it('calls next() and populates req.user for a valid token', () => {
    const { req, res, next, state } = createHarness();
    req.headers.authorization = `Bearer ${issueToken()}`;

    requireAuth(req, res, next);

    assert.strictEqual(next.mock.calls.length, 1);
    assert.strictEqual(req.user?.publicKey, ADDRESS);
    assert.strictEqual(state.statusCode, undefined);
  });

  it('returns 401 when the Authorization header is missing', () => {
    const { req, res, next, state } = createHarness();

    requireAuth(req, res, next);

    assert.strictEqual(next.mock.calls.length, 0);
    assert.strictEqual(state.statusCode, 401);
    assertUnauthorizedBody(state.body);
  });

  it('returns 401 for a non-Bearer authorization scheme', () => {
    const { req, res, next, state } = createHarness();
    req.headers.authorization = 'Basic dXNlcjpwYXNz';

    requireAuth(req, res, next);

    assert.strictEqual(next.mock.calls.length, 0);
    assert.strictEqual(state.statusCode, 401);
    assertUnauthorizedBody(state.body);
  });

  it('returns 401 for a Bearer header with an empty token', () => {
    const { req, res, next, state } = createHarness();
    req.headers.authorization = 'Bearer ';

    requireAuth(req, res, next);

    assert.strictEqual(next.mock.calls.length, 0);
    assert.strictEqual(state.statusCode, 401);
    assertUnauthorizedBody(state.body);
  });

  it('returns 401 for a malformed token', () => {
    const { req, res, next, state } = createHarness();
    req.headers.authorization = 'Bearer not-a-real-jwt';

    requireAuth(req, res, next);

    assert.strictEqual(next.mock.calls.length, 0);
    assert.strictEqual(state.statusCode, 401);
    assertUnauthorizedBody(state.body);
  });

  it('returns 401 for an expired token', () => {
    const { req, res, next, state } = createHarness();
    req.headers.authorization = `Bearer ${issueToken({
      exp: Math.floor(Date.now() / 1000) - 1,
    })}`;

    requireAuth(req, res, next);

    assert.strictEqual(next.mock.calls.length, 0);
    assert.strictEqual(state.statusCode, 401);
    assertUnauthorizedBody(state.body);
  });
});

describe('requireAuth via protected route (integration)', () => {
  it('rejects a request with no Authorization header', async () => {
    const res = await request(app).get('/api/groups').expect(401);

    assertUnauthorizedBody(res.body);
  });

  it('rejects a tampered token', async () => {
    const parts = issueToken().split('.');
    const signature = parts[2].split('');
    signature[0] = signature[0] === 'A' ? 'B' : 'A';
    const tampered = `${parts[0]}.${parts[1]}.${signature.join('')}`;

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${tampered}`)
      .expect(401);

    assertUnauthorizedBody(res.body);
  });

  it('rejects an expired token without real waiting', async () => {
    const expired = issueToken({ exp: Math.floor(Date.now() / 1000) - 1 });

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);

    assertUnauthorizedBody(res.body);
  });

  it('accepts a valid token and reaches the protected route', async () => {
    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${issueToken()}`)
      .expect(200);

    assert.strictEqual(res.body.success, true);
  });
});

describe('wallet authentication flow (challenge → verify → JWT)', () => {
  function signChallenge(xdr: string, signer: Keypair): string {
    const tx = TransactionBuilder.fromXDR(xdr, authConfig().networkPassphrase);
    tx.sign(signer);
    return tx.toXDR();
  }

  function mockAccount(keypair: Keypair): void {
    mock.method(accountAuthService, 'load', async () => ({
      mediumThreshold: 1,
      signers: [{ key: keypair.publicKey(), weight: 1, type: 'ed25519_public_key' }],
    }));
  }

  it('issues a JWT for a valid signature and authorizes a protected route', async () => {
    mockAccount(wallet);

    const challengeRes = await request(app)
      .post('/auth/challenge')
      .send({ address: wallet.publicKey() });
    assert.strictEqual(challengeRes.status, 200);
    const signed = signChallenge(challengeRes.body.data.transaction, wallet);

    const verifyRes = await request(app)
      .post('/auth/verify')
      .send({ transaction: signed })
      .expect(200);
    assert.strictEqual(verifyRes.body.success, true);
    assert.strictEqual(verifyRes.body.data.address, wallet.publicKey());
    assert.strictEqual(typeof verifyRes.body.data.token, 'string');

    const decoded = verifyToken(verifyRes.body.data.token);
    assert.strictEqual(decoded.sub, wallet.publicKey());

    const protectedRes = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${verifyRes.body.data.token}`)
      .expect(200);
    assert.strictEqual(protectedRes.body.success, true);
  });

  it('rejects an invalid signature with 401 and a clear error shape', async () => {
    mockAccount(wallet);

    const challengeRes = await request(app)
      .post('/auth/challenge')
      .send({ address: wallet.publicKey() });
    const unsigned = challengeRes.body.data.transaction;

    const res = await request(app).post('/auth/verify').send({ transaction: unsigned }).expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
    assert.strictEqual(typeof res.body.error.message, 'string');
  });

  it('rejects a challenge signed by a different keypair', async () => {
    mockAccount(wallet);
    const other = Keypair.random();

    const challengeRes = await request(app)
      .post('/auth/challenge')
      .send({ address: wallet.publicKey() });
    const signedByOther = signChallenge(challengeRes.body.data.transaction, other);

    const res = await request(app)
      .post('/auth/verify')
      .send({ transaction: signedByOther })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });
});

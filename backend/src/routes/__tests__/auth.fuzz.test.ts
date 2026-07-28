import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import request from 'supertest';
import { app } from '../../index.js';
import { challengesService } from '../../services/challenges.js';
import { stellarSignatureVerifier } from '../../utils/stellar.js';
import { signToken, verifyToken } from '../../utils/jwt.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-32-characters-minimum';

// Extensive edge-case / fuzz coverage for the wallet auth flow introduced
// in #76: POST /auth/challenge, POST /auth/verify, and the requireAuth
// JWT middleware. Each case below is a deliberately isolated, literally
// written test (rather than a data-driven loop) so failures surface with
// a specific, greppable test name in CI output.

const VALID_ADDRESS = 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU';
const REAL_ADDRESS = 'GDHVHQN2JFDZ5XYBIA3QBLGTHR7GXJZVUDTVQJJXM7SOMXA5YYBSDFWX';

function buildRawToken(
  payload: Record<string, unknown>,
  secret = process.env.JWT_SECRET as string
): string {
  function base64UrlEncode(input: string | Buffer): string {
    const buffer = typeof input === 'string' ? Buffer.from(input) : input;
    return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const data = base64UrlEncode(JSON.stringify(payload));
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${header}.${data}`);
  const signature = base64UrlEncode(hmac.digest());
  return `${header}.${data}.${signature}`;
}

beforeEach(async () => {
  mock.restoreAll();
  await challengesService.clear();
});

describe('POST /auth/challenge — invalid address matrix', () => {
  it('rejects address: length 0', async () => {
    const res = await request(app).post('/auth/challenge').send({ address: '' }).expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 1', async () => {
    const res = await request(app).post('/auth/challenge').send({ address: 'G' }).expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 2', async () => {
    const res = await request(app).post('/auth/challenge').send({ address: 'GA' }).expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 3', async () => {
    const res = await request(app).post('/auth/challenge').send({ address: 'GAA' }).expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 4', async () => {
    const res = await request(app).post('/auth/challenge').send({ address: 'GAAA' }).expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 5', async () => {
    const res = await request(app).post('/auth/challenge').send({ address: 'GAAAA' }).expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 6', async () => {
    const res = await request(app).post('/auth/challenge').send({ address: 'GAAAAA' }).expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 7', async () => {
    const res = await request(app).post('/auth/challenge').send({ address: 'GAAAAAA' }).expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 8', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 9', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 10', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 11', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 12', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 13', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 14', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 15', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 16', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 17', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 18', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 19', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 20', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 21', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 22', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 23', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 24', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 25', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 26', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 27', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 28', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 29', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 30', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 31', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 32', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 33', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 34', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 35', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 36', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 37', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 38', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 39', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 40', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 41', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 42', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 43', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 44', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 45', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 46', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 47', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 48', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 49', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 50', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 51', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 52', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 53', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 54', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 55', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 57', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 58', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 59', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 60', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 61', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 62', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 63', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 64', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 65', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 66', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 67', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 68', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 69', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 70', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 0', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: '!DQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 1', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'G!QOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 2', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GD!OMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 3', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQ!MSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 4', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQO!SFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 5', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOM!FX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 6', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMS!X2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 7', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSF!2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 8', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX!N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 9', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2!6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 10', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N!HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 11', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6!XZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 12', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6H!ZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 13', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HX!I5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 14', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZ!5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 15', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI!V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 16', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5!3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 17', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V!QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 18', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3!Z3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 19', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3Q!3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 20', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ!E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 21', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3!36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 22', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E!6XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 23', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E3!XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 24', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36!W4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 25', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36X!4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 26', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW!B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 27', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4!2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 28', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B!DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 29', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2!OKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 30', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2D!KWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 31', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DO!WZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 32', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOK!Z4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 33', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKW!4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 34', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ!C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 35', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4!3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 36', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C!G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 37', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3!42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 38', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G!2NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 39', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G4!NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 40', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42!IXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 41', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42N!XQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 42', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NI!QDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 43', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIX!DX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 44', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQ!X722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 45', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQD!722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 46', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX!22Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 47', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX7!2Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 48', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX72!Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 49', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722!6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 50', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y!M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 51', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6!42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 52', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M!2SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 53', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M4!SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 54', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42!U' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 55', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42S!' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'A'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'ADQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'B'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'BDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'C'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'CDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'D'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'DDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'E'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'EDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'F'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'FDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'H'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'HDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'I'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'IDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'J'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'JDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'K'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'KDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'L'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'LDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'M'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'MDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'N'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'NDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'O'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'ODQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'P'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'PDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'Q'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'QDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'R'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'RDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'S'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'SDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'T'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'TDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'U'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'UDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'V'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'VDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'W'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'WDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'X'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'XDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'Y'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'YDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'Z'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'ZDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix '0'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: '0DQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix '1'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: '1DQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix '2'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: '2DQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix '3'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: '3DQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix '4'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: '4DQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix '5'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: '5DQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix '6'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: '6DQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix '7'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: '7DQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix '8'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: '8DQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix '9'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: '9DQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'a'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'aDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'b'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'bDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'c'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'cDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'd'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'dDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'e'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'eDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'f'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'fDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'g'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'gDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'h'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'hDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'i'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'iDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'j'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'jDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'k'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'kDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'l'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'lDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'm'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'mDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'n'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'nDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'o'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'oDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'p'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'pDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'q'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'qDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'r'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'rDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 's'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'sDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 't'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'tDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'u'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'uDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'v'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'vDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'w'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'wDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'x'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'xDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'y'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'yDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'z'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'zDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'E'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GEQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'F'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GFQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'G'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GGQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'H'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GHQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'I'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GIQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'J'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GJQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'K'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GKQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'L'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GLQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'M'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GMQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'N'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GNQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'O'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GOQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'P'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GPQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'Q'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GQQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'R'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GRQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'S'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GSQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'T'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GTQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'U'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GUQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'V'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GVQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'W'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GWQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'X'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GXQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'Y'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GYQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'Z'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GZQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character '0'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'G0QOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character '1'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'G1QOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character '4'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'G4QOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character '8'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'G8QOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character '9'", async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'G9QOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: entirely lowercase', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'gdqomsfx2n6hxzi5v3qz3e36xw4b2dokwz4c3g42nixqdx722y6m42su' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: lowercase network prefix only', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'gDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: mixed case throughout', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'gDqOmSfX2N6HxZi5v3qZ3E36xW4B2DoKwZ4C3G42nIxQdX722Y6M42sU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: trailing lowercase run', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6m42su' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: leading lowercase run', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'gdqomsFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: empty string', async () => {
    const res = await request(app).post('/auth/challenge').send({ address: '' }).expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: single space', async () => {
    const res = await request(app).post('/auth/challenge').send({ address: ' ' }).expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: tab character', async () => {
    const res = await request(app).post('/auth/challenge').send({ address: '\t' }).expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: newline character', async () => {
    const res = await request(app).post('/auth/challenge').send({ address: '\n' }).expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: whitespace padded valid-looking value', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: '  GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU  ' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: leading whitespace', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: ' GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: trailing whitespace', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU ' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: literal "null"', async () => {
    const res = await request(app).post('/auth/challenge').send({ address: 'null' }).expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: literal "undefined"', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'undefined' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: literal "NaN"', async () => {
    const res = await request(app).post('/auth/challenge').send({ address: 'NaN' }).expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: SQL injection attempt', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: "'; DROP TABLE users; --" })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: script tag injection', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: '<script>alert(1)</script>' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: path traversal attempt', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: '../../../etc/passwd' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: all-zero digits', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: '00000000000000000000000000000000000000000000000000000000' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: all-nine digits', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: '99999999999999999999999999999999999999999999999999999999' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: all G characters (second char out of range)', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: emoji sequence', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: '🚀🔥💥N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: embedded null byte', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'GDQOMSFX2N\u0000HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: unicode homoglyph prefix', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'ԌDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: very long string (5000 chars)', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({
        address:
          'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: JSON-looking string', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: '{"address":"forged"}' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: contract-style C address', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'CDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: muxed-style M address', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'MDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: seed-style S address', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'SDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: numeric-only value', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: '1234567890123456789012345678901234567890123456789012345678' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });
});

describe('POST /auth/verify — invalid address matrix', () => {
  it('rejects address: length 0', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: '', nonce: 'deadbeefdeadbeefdeadbeefdeadbeef', signature: 'ZmFrZQ==' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 1', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: 'G', nonce: 'deadbeefdeadbeefdeadbeefdeadbeef', signature: 'ZmFrZQ==' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 2', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: 'GA', nonce: 'deadbeefdeadbeefdeadbeefdeadbeef', signature: 'ZmFrZQ==' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 3', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: 'GAA', nonce: 'deadbeefdeadbeefdeadbeefdeadbeef', signature: 'ZmFrZQ==' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 4', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: 'GAAA', nonce: 'deadbeefdeadbeefdeadbeefdeadbeef', signature: 'ZmFrZQ==' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 5', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: 'GAAAA', nonce: 'deadbeefdeadbeefdeadbeefdeadbeef', signature: 'ZmFrZQ==' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 6', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: 'GAAAAA', nonce: 'deadbeefdeadbeefdeadbeefdeadbeef', signature: 'ZmFrZQ==' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 7', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 8', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 9', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 10', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 11', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 12', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 13', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 14', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 15', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 16', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 17', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 18', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 19', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 20', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 21', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 22', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 23', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 24', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 25', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 26', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 27', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 28', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 29', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 30', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 31', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 32', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 33', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 34', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 35', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 36', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 37', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 38', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 39', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 40', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 41', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 42', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 43', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 44', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 45', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 46', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 47', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 48', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 49', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 50', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 51', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 52', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 53', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 54', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 55', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 57', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 58', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 59', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 60', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 61', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 62', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 63', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 64', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 65', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 66', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 67', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 68', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 69', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: length 70', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 0', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: '!DQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 1', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'G!QOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 2', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GD!OMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 3', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQ!MSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 4', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQO!SFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 5', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOM!FX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 6', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMS!X2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 7', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSF!2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 8', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX!N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 9', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2!6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 10', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N!HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 11', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6!XZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 12', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6H!ZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 13', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HX!I5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 14', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZ!5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 15', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI!V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 16', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5!3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 17', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V!QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 18', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3!Z3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 19', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3Q!3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 20', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ!E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 21', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3!36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 22', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E!6XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 23', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E3!XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 24', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36!W4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 25', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36X!4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 26', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW!B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 27', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4!2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 28', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B!DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 29', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2!OKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 30', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2D!KWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 31', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DO!WZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 32', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOK!Z4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 33', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKW!4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 34', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ!C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 35', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4!3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 36', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C!G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 37', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3!42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 38', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G!2NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 39', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G4!NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 40', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42!IXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 41', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42N!XQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 42', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NI!QDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 43', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIX!DX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 44', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQ!X722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 45', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQD!722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 46', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX!22Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 47', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX7!2Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 48', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX72!Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 49', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722!6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 50', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y!M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 51', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6!42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 52', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M!2SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 53', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M4!SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 54', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42!U',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: character mutation at position 55', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42S!',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'A'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'ADQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'B'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'BDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'C'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'CDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'D'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'DDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'E'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'EDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'F'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'FDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'H'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'HDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'I'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'IDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'J'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'JDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'K'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'KDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'L'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'LDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'M'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'MDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'N'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'NDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'O'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'ODQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'P'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'PDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'Q'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'QDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'R'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'RDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'S'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'SDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'T'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'TDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'U'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'UDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'V'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'VDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'W'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'WDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'X'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'XDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'Y'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'YDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix 'Z'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'ZDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix '0'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: '0DQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix '1'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: '1DQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix '2'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: '2DQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix '3'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: '3DQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix '4'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: '4DQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix '5'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: '5DQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix '6'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: '6DQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix '7'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: '7DQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix '8'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: '8DQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid network prefix '9'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: '9DQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'a'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'aDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'b'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'bDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'c'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'cDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'd'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'dDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'e'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'eDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'f'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'fDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'g'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'gDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'h'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'hDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'i'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'iDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'j'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'jDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'k'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'kDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'l'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'lDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'm'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'mDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'n'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'nDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'o'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'oDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'p'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'pDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'q'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'qDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'r'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'rDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 's'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'sDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 't'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'tDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'u'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'uDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'v'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'vDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'w'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'wDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'x'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'xDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'y'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'yDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: lowercase network prefix 'z'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'zDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'E'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GEQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'F'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GFQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'G'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GGQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'H'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GHQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'I'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GIQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'J'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GJQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'K'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GKQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'L'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GLQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'M'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GMQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'N'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GNQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'O'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GOQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'P'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GPQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'Q'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GQQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'R'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GRQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'S'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GSQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'T'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GTQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'U'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GUQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'V'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GVQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'W'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GWQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'X'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GXQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'Y'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GYQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character 'Z'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GZQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character '0'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'G0QOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character '1'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'G1QOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character '4'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'G4QOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character '8'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'G8QOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it("rejects address: invalid second character '9'", async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'G9QOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: entirely lowercase', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'gdqomsfx2n6hxzi5v3qz3e36xw4b2dokwz4c3g42nixqdx722y6m42su',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: lowercase network prefix only', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'gDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: mixed case throughout', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'gDqOmSfX2N6HxZi5v3qZ3E36xW4B2DoKwZ4C3G42nIxQdX722Y6M42sU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: trailing lowercase run', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6m42su',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: leading lowercase run', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'gdqomsFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: empty string', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: '', nonce: 'deadbeefdeadbeefdeadbeefdeadbeef', signature: 'ZmFrZQ==' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: single space', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: ' ', nonce: 'deadbeefdeadbeefdeadbeefdeadbeef', signature: 'ZmFrZQ==' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: tab character', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: '\t', nonce: 'deadbeefdeadbeefdeadbeefdeadbeef', signature: 'ZmFrZQ==' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: newline character', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: '\n', nonce: 'deadbeefdeadbeefdeadbeefdeadbeef', signature: 'ZmFrZQ==' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: whitespace padded valid-looking value', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: '  GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU  ',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: leading whitespace', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: ' GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: trailing whitespace', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU ',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: literal "null"', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: 'null', nonce: 'deadbeefdeadbeefdeadbeefdeadbeef', signature: 'ZmFrZQ==' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: literal "undefined"', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'undefined',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: literal "NaN"', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: 'NaN', nonce: 'deadbeefdeadbeefdeadbeefdeadbeef', signature: 'ZmFrZQ==' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: SQL injection attempt', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: "'; DROP TABLE users; --",
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: script tag injection', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: '<script>alert(1)</script>',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: path traversal attempt', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: '../../../etc/passwd',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: all-zero digits', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: '00000000000000000000000000000000000000000000000000000000',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: all-nine digits', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: '99999999999999999999999999999999999999999999999999999999',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: all G characters (second char out of range)', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: emoji sequence', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: '🚀🔥💥N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: embedded null byte', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'GDQOMSFX2N\u0000HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: unicode homoglyph prefix', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'ԌDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: very long string (5000 chars)', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address:
          'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: JSON-looking string', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: '{"address":"forged"}',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: contract-style C address', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'CDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: muxed-style M address', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'MDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: seed-style S address', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: 'SDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address: numeric-only value', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: '1234567890123456789012345678901234567890123456789012345678',
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });
});

describe('POST /auth/verify — invalid nonce matrix', () => {
  it('rejects nonce: empty string', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: '', signature: 'ZmFrZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: single space', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: ' ', signature: 'ZmFrZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: too short hex', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: 'deadbeef', signature: 'ZmFrZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: too long hex', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: VALID_ADDRESS,
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: uppercase hex of correct length', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: VALID_ADDRESS,
        nonce: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        signature: 'ZmFrZQ==',
      })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: non-hex letters', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: VALID_ADDRESS,
        nonce: 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
        signature: 'ZmFrZQ==',
      })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: symbols', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: VALID_ADDRESS,
        nonce: '!@#$%^&*()_+-=[]{}|;:,.<>/?~`',
        signature: 'ZmFrZQ==',
      })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: sql injection attempt', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: "' OR '1'='1", signature: 'ZmFrZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: script tag injection', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: '<script>alert(1)</script>', signature: 'ZmFrZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: path traversal attempt', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: '../../../etc/passwd', signature: 'ZmFrZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: whitespace only', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: '     ', signature: 'ZmFrZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: newline embedded', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: 'dead\nbeef', signature: 'ZmFrZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: null byte embedded', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: 'dead\u0000beef', signature: 'ZmFrZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: unicode content', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: '🔥nonce🔥', signature: 'ZmFrZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: literal "null"', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: 'null', signature: 'ZmFrZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: literal "undefined"', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: 'undefined', signature: 'ZmFrZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: numeric string', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: VALID_ADDRESS,
        nonce: '123456789012345678901234567890',
        signature: 'ZmFrZQ==',
      })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: base64-looking value', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: 'ZGVhZGJlZWZkZWFkYmVlZg==', signature: 'ZmFrZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: very long value (2000 chars)', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: VALID_ADDRESS,
        nonce:
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        signature: 'ZmFrZQ==',
      })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: single character', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: 'a', signature: 'ZmFrZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: uuid-shaped value', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: VALID_ADDRESS,
        nonce: '123e4567-e89b-12d3-a456-426614174000',
        signature: 'ZmFrZQ==',
      })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: hex with one flipped char (would-be off-by-one)', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: VALID_ADDRESS,
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeee',
        signature: 'ZmFrZQ==',
      })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: hex with uppercase mix', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: VALID_ADDRESS,
        nonce: 'DeAdBeEfDeAdBeEfDeAdBeEfDeAdBeEf',
        signature: 'ZmFrZQ==',
      })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: double-encoded value', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: VALID_ADDRESS,
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: JSON-looking string', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: '{"nonce":"forged"}', signature: 'ZmFrZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: trailing whitespace', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: VALID_ADDRESS,
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef ',
        signature: 'ZmFrZQ==',
      })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: leading whitespace', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: VALID_ADDRESS,
        nonce: ' deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: repeated zero bytes', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: VALID_ADDRESS,
        nonce: '00000000000000000000000000000000',
        signature: 'ZmFrZQ==',
      })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: repeated f bytes (valid shape, wrong value)', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: VALID_ADDRESS,
        nonce: 'ffffffffffffffffffffffffffffffff',
        signature: 'ZmFrZQ==',
      })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: mixed-length garbage', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: 'ab12', signature: 'ZmFrZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: emoji only', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: '🎲🎲🎲🎲', signature: 'ZmFrZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: control characters', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: '\u0001\u0002\u0003\u0004', signature: 'ZmFrZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: percent-encoded garbage', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: '%20%00%FF', signature: 'ZmFrZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: tab embedded', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: VALID_ADDRESS,
        nonce: 'dead\tbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: carriage return embedded', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: VALID_ADDRESS,
        nonce: 'dead\rbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: backslash sequences', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: '\\\\\\\\\\\\\\\\', signature: 'ZmFrZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: quote characters', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: VALID_ADDRESS,
        nonce: '""""""""""""""""""""""""""""""""',
        signature: 'ZmFrZQ==',
      })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: very short numeric', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: '0', signature: 'ZmFrZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: negative number string', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: '-1', signature: 'ZmFrZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects nonce: scientific notation string', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    await request(app).post('/auth/challenge').send({ address: VALID_ADDRESS });

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: '1e10', signature: 'ZmFrZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });
});

describe('POST /auth/verify — invalid signature matrix (real verifier)', () => {
  it('rejects signature: empty string', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: REAL_ADDRESS, nonce, signature: '' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: single space', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: REAL_ADDRESS, nonce, signature: ' ' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: not base64 at all', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: REAL_ADDRESS, nonce, signature: '!!!not-base64!!!' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: too short base64', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: REAL_ADDRESS, nonce, signature: 'YQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: too long base64 (256 random bytes)', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: REAL_ADDRESS,
        nonce,
        signature:
          'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBw==',
      })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: all-zero-byte signature', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: REAL_ADDRESS,
        nonce,
        signature:
          'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
      })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: all-0xFF-byte signature', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: REAL_ADDRESS,
        nonce,
        signature:
          '/////////////////////////////////////////////////////////////////////////////////////w==',
      })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: ASCII text re-encoded as base64', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: REAL_ADDRESS, nonce, signature: 'dGhpcyBpcyBub3QgYSBzaWduYXR1cmU=' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: correct-length random bytes', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: REAL_ADDRESS,
        nonce,
        signature:
          'KioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKg==',
      })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: url-safe base64 characters (-_)', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: REAL_ADDRESS, nonce, signature: 'YQ-_YQ-_YQ-_YQ-_YQ-_YQ-_YQ-_YQ-_' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: whitespace only', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: REAL_ADDRESS, nonce, signature: '        ' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: sql injection attempt', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: REAL_ADDRESS, nonce, signature: "'; DROP TABLE users; --" })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: script tag injection', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: REAL_ADDRESS, nonce, signature: '<script>alert(1)</script>' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: literal "null"', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: REAL_ADDRESS, nonce, signature: 'null' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: literal "undefined"', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: REAL_ADDRESS, nonce, signature: 'undefined' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: newline embedded', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: REAL_ADDRESS, nonce, signature: 'ZmFr\nZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: null byte embedded', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: REAL_ADDRESS, nonce, signature: 'ZmFr\u0000ZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: unicode content', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: REAL_ADDRESS, nonce, signature: '🔥signature🔥' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: very long value (5000 chars)', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: REAL_ADDRESS,
        nonce,
        signature:
          'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: single character', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: REAL_ADDRESS, nonce, signature: 'A' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: hex string instead of base64', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: REAL_ADDRESS, nonce, signature: 'deadbeefdeadbeefdeadbeefdeadbeef' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: JSON-looking string', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: REAL_ADDRESS, nonce, signature: '{"signature":"forged"}' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: duplicated valid-looking chunk', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: REAL_ADDRESS,
        nonce,
        signature:
          'ZmFrZQ==ZmFrZQ==ZmFrZQ==ZmFrZQ==ZmFrZQ==ZmFrZQ==ZmFrZQ==ZmFrZQ==ZmFrZQ==ZmFrZQ==ZmFrZQ==ZmFrZQ==ZmFrZQ==ZmFrZQ==ZmFrZQ==ZmFrZQ==ZmFrZQ==ZmFrZQ==ZmFrZQ==ZmFrZQ==',
      })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: padding-only string', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: REAL_ADDRESS, nonce, signature: '====' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: percent-encoded garbage', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: REAL_ADDRESS, nonce, signature: '%20%00%FF' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: trailing whitespace', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: REAL_ADDRESS, nonce, signature: 'ZmFrZQ== ' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: leading whitespace', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: REAL_ADDRESS, nonce, signature: ' ZmFrZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: control characters', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: REAL_ADDRESS, nonce, signature: '\u0001\u0002\u0003\u0004' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: mixed valid/invalid base64 chars', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: REAL_ADDRESS, nonce, signature: 'ZmFrZQ==!!!' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects signature: emoji only', async () => {
    const challengeRes = await request(app).post('/auth/challenge').send({ address: REAL_ADDRESS });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: REAL_ADDRESS, nonce, signature: '🎲🎲🎲🎲' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });
});

describe('POST /auth/challenge — type-confused address field', () => {
  it('rejects address of type: number', async () => {
    const res = await request(app).post('/auth/challenge').send({ address: 123456 }).expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address of type: boolean true', async () => {
    const res = await request(app).post('/auth/challenge').send({ address: true }).expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address of type: boolean false', async () => {
    const res = await request(app).post('/auth/challenge').send({ address: false }).expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address of type: null', async () => {
    const res = await request(app).post('/auth/challenge').send({ address: null }).expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address of type: array', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: ['not', 'a', 'string'] })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address of type: object', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: { forged: true } })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address of type: nested object', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: { address: { nested: true } } })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });
});

describe('POST /auth/verify — type-confused fields', () => {
  it('rejects address of type: number', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: 123456, nonce: 'deadbeefdeadbeefdeadbeefdeadbeef', signature: 'ZmFrZQ==' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address of type: boolean true', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: true, nonce: 'deadbeefdeadbeefdeadbeefdeadbeef', signature: 'ZmFrZQ==' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address of type: boolean false', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: false, nonce: 'deadbeefdeadbeefdeadbeefdeadbeef', signature: 'ZmFrZQ==' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address of type: null', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: null, nonce: 'deadbeefdeadbeefdeadbeefdeadbeef', signature: 'ZmFrZQ==' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address of type: array', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: ['not', 'a', 'string'],
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address of type: object', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: { forged: true },
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects address of type: nested object', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: { address: { nested: true } },
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 'ZmFrZQ==',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects nonce of type: number', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: 123456, signature: 'ZmFrZQ==' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects nonce of type: boolean true', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: true, signature: 'ZmFrZQ==' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects nonce of type: boolean false', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: false, signature: 'ZmFrZQ==' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects nonce of type: null', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: null, signature: 'ZmFrZQ==' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects nonce of type: array', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: ['not', 'a', 'string'], signature: 'ZmFrZQ==' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects nonce of type: object', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: { forged: true }, signature: 'ZmFrZQ==' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects nonce of type: nested object', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: { address: { nested: true } }, signature: 'ZmFrZQ==' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects signature of type: number', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: VALID_ADDRESS,
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: 123456,
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects signature of type: boolean true', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: 'deadbeefdeadbeefdeadbeefdeadbeef', signature: true })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects signature of type: boolean false', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: 'deadbeefdeadbeefdeadbeefdeadbeef', signature: false })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects signature of type: null', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: VALID_ADDRESS, nonce: 'deadbeefdeadbeefdeadbeefdeadbeef', signature: null })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects signature of type: array', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: VALID_ADDRESS,
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: ['not', 'a', 'string'],
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects signature of type: object', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: VALID_ADDRESS,
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: { forged: true },
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects signature of type: nested object', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({
        address: VALID_ADDRESS,
        nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
        signature: { address: { nested: true } },
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });
});

describe('requireAuth — malformed JWT matrix (via protected route)', () => {
  it('rejects token: zero segments', async () => {
    const token = '';

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects token: one segment', async () => {
    const token = 'onlyoneseg';

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects token: two segments', async () => {
    const token = 'headerpart.datapart';

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects token: four segments', async () => {
    const token = 'a.b.c.d';

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects token: five segments', async () => {
    const token = 'a.b.c.d.e';

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects token: empty string', async () => {
    const token = '';

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects token: whitespace only', async () => {
    const token = '   ';

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects token: non-base64 header', async () => {
    const token = '!!!.eyJzdWIiOiJ4In0.sig';

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects token: flipped payload character at offset 1', async () => {
    const token = (() => {
      const t = signToken({ sub: VALID_ADDRESS });
      const parts = t.split('.');
      const p = parts[1].split('');
      p[1] = p[1] === 'A' ? 'B' : 'A';
      parts[1] = p.join('');
      return parts.join('.');
    })();

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects token: flipped payload character at offset 2', async () => {
    const token = (() => {
      const t = signToken({ sub: VALID_ADDRESS });
      const parts = t.split('.');
      const p = parts[1].split('');
      p[2] = p[2] === 'A' ? 'B' : 'A';
      parts[1] = p.join('');
      return parts.join('.');
    })();

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects token: flipped payload character at offset 3', async () => {
    const token = (() => {
      const t = signToken({ sub: VALID_ADDRESS });
      const parts = t.split('.');
      const p = parts[1].split('');
      p[3] = p[3] === 'A' ? 'B' : 'A';
      parts[1] = p.join('');
      return parts.join('.');
    })();

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects token: flipped payload character at offset 4', async () => {
    const token = (() => {
      const t = signToken({ sub: VALID_ADDRESS });
      const parts = t.split('.');
      const p = parts[1].split('');
      p[4] = p[4] === 'A' ? 'B' : 'A';
      parts[1] = p.join('');
      return parts.join('.');
    })();

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects token: flipped payload character at offset 5', async () => {
    const token = (() => {
      const t = signToken({ sub: VALID_ADDRESS });
      const parts = t.split('.');
      const p = parts[1].split('');
      p[5] = p[5] === 'A' ? 'B' : 'A';
      parts[1] = p.join('');
      return parts.join('.');
    })();

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects token: flipped payload character at offset 6', async () => {
    const token = (() => {
      const t = signToken({ sub: VALID_ADDRESS });
      const parts = t.split('.');
      const p = parts[1].split('');
      p[6] = p[6] === 'A' ? 'B' : 'A';
      parts[1] = p.join('');
      return parts.join('.');
    })();

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects token: flipped payload character at offset 7', async () => {
    const token = (() => {
      const t = signToken({ sub: VALID_ADDRESS });
      const parts = t.split('.');
      const p = parts[1].split('');
      p[7] = p[7] === 'A' ? 'B' : 'A';
      parts[1] = p.join('');
      return parts.join('.');
    })();

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects token: flipped payload character at offset 8', async () => {
    const token = (() => {
      const t = signToken({ sub: VALID_ADDRESS });
      const parts = t.split('.');
      const p = parts[1].split('');
      p[8] = p[8] === 'A' ? 'B' : 'A';
      parts[1] = p.join('');
      return parts.join('.');
    })();

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects token: flipped payload character at offset 9', async () => {
    const token = (() => {
      const t = signToken({ sub: VALID_ADDRESS });
      const parts = t.split('.');
      const p = parts[1].split('');
      p[9] = p[9] === 'A' ? 'B' : 'A';
      parts[1] = p.join('');
      return parts.join('.');
    })();

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects token: flipped payload character at offset 10', async () => {
    const token = (() => {
      const t = signToken({ sub: VALID_ADDRESS });
      const parts = t.split('.');
      const p = parts[1].split('');
      p[10] = p[10] === 'A' ? 'B' : 'A';
      parts[1] = p.join('');
      return parts.join('.');
    })();

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects token: flipped signature character at offset 1', async () => {
    const token = (() => {
      const t = signToken({ sub: VALID_ADDRESS });
      const parts = t.split('.');
      const s = parts[2].split('');
      s[1] = s[1] === 'A' ? 'B' : 'A';
      parts[2] = s.join('');
      return parts.join('.');
    })();

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects token: flipped signature character at offset 2', async () => {
    const token = (() => {
      const t = signToken({ sub: VALID_ADDRESS });
      const parts = t.split('.');
      const s = parts[2].split('');
      s[2] = s[2] === 'A' ? 'B' : 'A';
      parts[2] = s.join('');
      return parts.join('.');
    })();

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects token: flipped signature character at offset 3', async () => {
    const token = (() => {
      const t = signToken({ sub: VALID_ADDRESS });
      const parts = t.split('.');
      const s = parts[2].split('');
      s[3] = s[3] === 'A' ? 'B' : 'A';
      parts[2] = s.join('');
      return parts.join('.');
    })();

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects token: flipped signature character at offset 4', async () => {
    const token = (() => {
      const t = signToken({ sub: VALID_ADDRESS });
      const parts = t.split('.');
      const s = parts[2].split('');
      s[4] = s[4] === 'A' ? 'B' : 'A';
      parts[2] = s.join('');
      return parts.join('.');
    })();

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects token: flipped signature character at offset 5', async () => {
    const token = (() => {
      const t = signToken({ sub: VALID_ADDRESS });
      const parts = t.split('.');
      const s = parts[2].split('');
      s[5] = s[5] === 'A' ? 'B' : 'A';
      parts[2] = s.join('');
      return parts.join('.');
    })();

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects token: flipped signature character at offset 6', async () => {
    const token = (() => {
      const t = signToken({ sub: VALID_ADDRESS });
      const parts = t.split('.');
      const s = parts[2].split('');
      s[6] = s[6] === 'A' ? 'B' : 'A';
      parts[2] = s.join('');
      return parts.join('.');
    })();

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });
});

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../index.js';
import { challengesService } from '../../services/challenges.js';
import { stellarSignatureVerifier } from '../../utils/stellar.js';
import { verifyToken } from '../../utils/jwt.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-32-characters-minimum';

const address1 = 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU';
const address2 = 'GAYO55R3JM3OHUB7W52QO7P6CDH5P3WTAF4V6QG4EIVTT6OJZIMIC75W';

beforeEach(async () => {
  mock.restoreAll();
  await challengesService.clear();
});

describe('POST /auth/challenge', () => {
  it('issues a nonce and message for a valid address', async () => {
    const res = await request(app).post('/auth/challenge').send({ address: address1 }).expect(200);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.address, address1);
    assert.strictEqual(typeof res.body.data.nonce, 'string');
    assert.ok(res.body.data.nonce.length > 0);
    assert.ok(res.body.data.message.includes(address1));
    assert.ok(res.body.data.message.includes(res.body.data.nonce));
    assert.strictEqual(typeof res.body.data.expiresAt, 'string');
  });

  it('issues a distinct nonce on each call', async () => {
    const res1 = await request(app).post('/auth/challenge').send({ address: address1 });
    const res2 = await request(app).post('/auth/challenge').send({ address: address1 });

    assert.notStrictEqual(res1.body.data.nonce, res2.body.data.nonce);
  });

  it('rejects a missing address', async () => {
    const res = await request(app).post('/auth/challenge').send({}).expect(400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects a malformed address', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: 'not-a-stellar-address' })
      .expect(400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });
});

describe('POST /auth/verify', () => {
  it('issues a JWT when the signature is valid', async () => {
    const verifyMock = mock.method(stellarSignatureVerifier, 'verify', () => true);

    const challengeRes = await request(app).post('/auth/challenge').send({ address: address1 });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: address1, nonce, signature: 'ZmFrZS1zaWduYXR1cmU=' })
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.address, address1);
    assert.strictEqual(typeof res.body.data.token, 'string');
    assert.strictEqual(verifyMock.mock.calls.length, 1);

    const decoded = verifyToken(res.body.data.token);
    assert.strictEqual(decoded.sub, address1);
    assert.strictEqual(decoded.address, address1);
    assert.strictEqual(typeof decoded.exp, 'number');
  });

  it('rejects an invalid signature', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => false);

    const challengeRes = await request(app).post('/auth/challenge').send({ address: address1 });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: address1, nonce, signature: 'YmFkLXNpZ25hdHVyZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects reuse of an already-consumed nonce (single-use)', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    const challengeRes = await request(app).post('/auth/challenge').send({ address: address1 });
    const { nonce } = challengeRes.body.data;
    const payload = { address: address1, nonce, signature: 'ZmFrZS1zaWduYXR1cmU=' };

    await request(app).post('/auth/verify').send(payload).expect(200);
    const res = await request(app).post('/auth/verify').send(payload).expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects an unknown nonce', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: address1, nonce: 'does-not-exist', signature: 'ZmFrZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects a nonce issued for a different address', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    const challengeRes = await request(app).post('/auth/challenge').send({ address: address1 });
    const { nonce } = challengeRes.body.data;

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: address2, nonce, signature: 'ZmFrZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects an expired challenge', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    // create() returns the same object reference held internally, so mutating
    // expiresAt here simulates time passing without needing fake timers.
    const challenge = await challengesService.create(address1);
    challenge.expiresAt = new Date(Date.now() - 1000);

    const res = await request(app)
      .post('/auth/verify')
      .send({ address: address1, nonce: challenge.nonce, signature: 'ZmFrZQ==' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects missing fields with 400', async () => {
    const res = await request(app).post('/auth/verify').send({ address: address1 }).expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('rejects a malformed address with 400', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: 'bad-address', nonce: 'x', signature: 'ZmFrZQ==' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });
});

describe('requireAuth middleware (via a protected route)', () => {
  it('rejects requests with no Authorization header', async () => {
    const res = await request(app).get('/api/groups').expect(401);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects a malformed Authorization header', async () => {
    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', 'NotBearer sometoken')
      .expect(401);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects an invalid token', async () => {
    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', 'Bearer not-a-real-jwt')
      .expect(401);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('accepts a valid token end-to-end from /auth/verify and populates req.user', async () => {
    mock.method(stellarSignatureVerifier, 'verify', () => true);

    const challengeRes = await request(app).post('/auth/challenge').send({ address: address1 });
    const { nonce } = challengeRes.body.data;
    const verifyRes = await request(app)
      .post('/auth/verify')
      .send({ address: address1, nonce, signature: 'ZmFrZQ==' })
      .expect(200);

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${verifyRes.body.data.token}`)
      .expect(200);

    assert.strictEqual(res.body.success, true);
  });
});

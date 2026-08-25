import { after, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import request from 'supertest';
import { Keypair, Transaction, TransactionBuilder, WebAuth } from '@stellar/stellar-sdk';
import { app } from '../../index.js';
import { authConfig } from '../../config/auth.js';
import { challengesService, type Challenge } from '../../services/challenges.js';
import { accountAuthService } from '../../services/sep10.js';
import { sessionsService } from '../../services/sessions.js';
import { verifyToken } from '../../utils/jwt.js';

const client = Keypair.random();
const secondSigner = Keypair.random();

function signChallenge(xdr: string, ...signers: Keypair[]): string {
  const tx = TransactionBuilder.fromXDR(xdr, authConfig().networkPassphrase);
  tx.sign(...signers);
  return tx.toXDR();
}

function nonceFrom(xdr: string): string {
  const tx = TransactionBuilder.fromXDR(xdr, authConfig().networkPassphrase);
  const operation = tx.operations[0];
  assert.ok(operation?.type === 'manageData' && operation.value);
  return operation.value.toString('utf8');
}

function cookieFrom(res: request.Response): string {
  const setCookie = res.headers['set-cookie'];
  assert.ok(setCookie);
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return raw.split(';', 1)[0];
}

function fullCookieFrom(res: request.Response): string {
  const setCookie = res.headers['set-cookie'];
  assert.ok(setCookie);
  return Array.isArray(setCookie) ? setCookie[0] : setCookie;
}

function mockAccount(
  mediumThreshold = 1,
  signers = [{ key: client.publicKey(), weight: 1, type: 'ed25519_public_key' }]
): void {
  mock.method(accountAuthService, 'load', async () => ({ mediumThreshold, signers }));
}

async function login(): Promise<{ accessToken: string; cookie: string }> {
  const challenge = await request(app)
    .post('/auth/challenge')
    .send({ address: client.publicKey() })
    .expect(200);
  const signed = signChallenge(challenge.body.data.transaction, client);
  const verified = await request(app)
    .post('/auth/verify')
    .send({ transaction: signed })
    .expect(200);
  return { accessToken: verified.body.data.accessToken, cookie: cookieFrom(verified) };
}

beforeEach(async () => {
  mock.restoreAll();
  await challengesService.clear();
  await sessionsService.clear();
});

after(() => mock.restoreAll());

describe('SEP-10 authentication', () => {
  it('issues a standard 300-second SEP-10 challenge XDR', async () => {
    const res = await request(app)
      .post('/auth/challenge')
      .send({ address: client.publicKey() })
      .expect(200);
    const tx = TransactionBuilder.fromXDR(
      res.body.data.transaction,
      authConfig().networkPassphrase
    );

    assert.ok(tx instanceof Transaction);
    assert.equal(tx.sequence, '0');
    assert.equal(tx.source, authConfig().signingKeypair.publicKey());
    assert.equal(tx.operations[0]?.type, 'manageData');
    assert.equal(tx.operations[0]?.name, `${authConfig().homeDomain} auth`);
    assert.equal(Buffer.from(nonceFrom(res.body.data.transaction), 'base64').length, 48);
    assert.equal(tx.operations[1]?.type, 'manageData');
    assert.equal(tx.operations[1]?.name, 'web_auth_domain');
    assert.equal(Number(tx.timeBounds!.maxTime) - Number(tx.timeBounds!.minTime), 300);
  });

  it('verifies the client signature and issues a 15-minute access token plus secure cookie', async () => {
    mockAccount();
    const result = await login();
    const decoded = verifyToken(result.accessToken);
    assert.equal(decoded.sub, client.publicKey());
    assert.ok(decoded.sid);
    assert.equal(decoded.exp! - decoded.iat!, 900);
    const issued = await sessionsService.create(client.publicKey());
    const refreshed = await request(app)
      .post('/auth/refresh')
      .set('Cookie', `paymesh_refresh=${issued.refreshToken}`)
      .expect(200);
    const setCookie = fullCookieFrom(refreshed);
    assert.match(setCookie, /^paymesh_refresh=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /Secure/i);
    assert.match(setCookie, /SameSite=Strict/i);
  });

  it('rejects tampered XDR', async () => {
    mockAccount();
    const issued = await request(app).post('/auth/challenge').send({ address: client.publicKey() });
    const signed = signChallenge(issued.body.data.transaction, client);
    const bytes = Buffer.from(signed, 'base64');
    bytes[Math.floor(bytes.length / 2)] ^= 1;
    await request(app)
      .post('/auth/verify')
      .send({ transaction: bytes.toString('base64') })
      .expect(401);
  });

  it('rejects a challenge signed by the wrong server key', async () => {
    const attacker = Keypair.random();
    const xdr = WebAuth.buildChallengeTx(
      attacker,
      client.publicKey(),
      authConfig().homeDomain,
      300,
      authConfig().networkPassphrase,
      authConfig().webAuthDomain
    );
    const tx = TransactionBuilder.fromXDR(xdr, authConfig().networkPassphrase);
    const fake: Challenge = {
      id: crypto.randomUUID(),
      nonce: nonceFrom(xdr),
      address: client.publicKey(),
      transaction: xdr,
      transactionHash: Buffer.from(tx.hash()),
      expiresAt: new Date(Date.now() + 300_000),
      usedAt: null,
    };
    mock.method(challengesService, 'find', async () => fake);
    await request(app)
      .post('/auth/verify')
      .send({ transaction: signChallenge(xdr, client) })
      .expect(401);
  });

  it('rejects expired time bounds', async () => {
    const xdr = WebAuth.buildChallengeTx(
      authConfig().signingKeypair,
      client.publicKey(),
      authConfig().homeDomain,
      300,
      authConfig().networkPassphrase,
      authConfig().webAuthDomain
    );
    const tx = TransactionBuilder.fromXDR(xdr, authConfig().networkPassphrase);
    const fake: Challenge = {
      id: crypto.randomUUID(),
      nonce: nonceFrom(xdr),
      address: client.publicKey(),
      transaction: xdr,
      transactionHash: Buffer.from(tx.hash()),
      expiresAt: new Date(Date.now() + 86_400_000),
      usedAt: null,
    };
    mock.method(challengesService, 'find', async () => fake);
    mockAccount();
    const future = Date.now() + 3_600_000;
    mock.method(Date, 'now', () => future);
    await request(app)
      .post('/auth/verify')
      .send({ transaction: signChallenge(xdr, client) })
      .expect(401);
  });

  it('rejects a missing client signature', async () => {
    mockAccount();
    const issued = await request(app).post('/auth/challenge').send({ address: client.publicKey() });
    await request(app)
      .post('/auth/verify')
      .send({ transaction: issued.body.data.transaction })
      .expect(401);
  });

  it('rejects multisig weight below the medium threshold', async () => {
    mockAccount(2, [
      { key: client.publicKey(), weight: 1, type: 'ed25519_public_key' },
      { key: secondSigner.publicKey(), weight: 1, type: 'ed25519_public_key' },
    ]);
    const issued = await request(app).post('/auth/challenge').send({ address: client.publicKey() });
    await request(app)
      .post('/auth/verify')
      .send({ transaction: signChallenge(issued.body.data.transaction, client) })
      .expect(401);
  });

  it('rejects nonce replay', async () => {
    mockAccount();
    const issued = await request(app).post('/auth/challenge').send({ address: client.publicKey() });
    const signed = signChallenge(issued.body.data.transaction, client);
    await request(app).post('/auth/verify').send({ transaction: signed }).expect(200);
    await request(app).post('/auth/verify').send({ transaction: signed }).expect(401);
  });
});

describe('refresh sessions and revocation', () => {
  it('rotates a refresh token successfully', async () => {
    mockAccount();
    const first = await login();
    const refreshed = await request(app)
      .post('/auth/refresh')
      .set('Cookie', first.cookie)
      .expect(200);
    assert.notEqual(cookieFrom(refreshed), first.cookie);
    assert.equal(verifyToken(refreshed.body.data.accessToken).sub, client.publicKey());
  });

  it('detects reuse and revokes the entire token family', async () => {
    mockAccount();
    const first = await login();
    const rotated = await request(app)
      .post('/auth/refresh')
      .set('Cookie', first.cookie)
      .expect(200);
    const nextCookie = cookieFrom(rotated);
    await request(app).post('/auth/refresh').set('Cookie', first.cookie).expect(401);
    await request(app).post('/auth/refresh').set('Cookie', nextCookie).expect(401);
    await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${rotated.body.data.accessToken}`)
      .expect(401);
  });

  it('rejects an expired refresh token', async () => {
    const session = await sessionsService.create(client.publicKey());
    session.expiresAt.setTime(Date.now() - 1);
    await request(app)
      .post('/auth/refresh')
      .set('Cookie', `paymesh_refresh=${session.refreshToken}`)
      .expect(401);
  });

  it('logout revokes the session immediately', async () => {
    mockAccount();
    const credentials = await login();
    await request(app).post('/auth/logout').set('Cookie', credentials.cookie).expect(200);
    await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${credentials.accessToken}`)
      .expect(401);
  });

  it('logout-all revokes every session for the wallet', async () => {
    mockAccount();
    const first = await login();
    await challengesService.clear();
    const second = await login();
    await request(app)
      .post('/auth/logout-all')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .expect(200);
    await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${second.accessToken}`)
      .expect(401);
  });
});

describe('startup security', () => {
  it('refuses to boot with a short JWT_SECRET outside test', () => {
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '--eval', "import('./dist/index.js')"],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          NODE_ENV: 'development',
          JWT_SECRET: 'short',
          STELLAR_SIGNING_SECRET: authConfig().signingKeypair.secret(),
        },
      }
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /JWT_SECRET must be set and contain at least 32 bytes/);
  });
});

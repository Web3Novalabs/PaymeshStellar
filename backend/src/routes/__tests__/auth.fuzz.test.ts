import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { Keypair } from '@stellar/stellar-sdk';
import { app } from '../../index.js';
import { challengesService } from '../../services/challenges.js';
import { sessionsService } from '../../services/sessions.js';
import { pool } from '../../db/index.js';

const validAddress = Keypair.random().publicKey();

beforeEach(async () => {
  await challengesService.clear();
  await sessionsService.clear();
});

after(async () => pool.end());

describe('auth input fuzzing', () => {
  const invalidAddresses: unknown[] = [
    '',
    'G',
    'not-a-stellar-address',
    validAddress.toLowerCase(),
    `${validAddress}x`,
    0,
    true,
    null,
    [],
    {},
  ];

  for (const [index, address] of invalidAddresses.entries()) {
    it(`rejects malformed challenge address case ${index}`, async () => {
      const res = await request(app).post('/auth/challenge').send({ address }).expect(400);
      assert.deepEqual(Object.keys(res.body).sort(), ['error', 'success']);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'BAD_REQUEST');
    });
  }

  const invalidTransactions: unknown[] = [
    '',
    'not-xdr',
    '=',
    '🔥',
    123,
    true,
    null,
    [],
    {},
    'A'.repeat(60_000),
  ];

  for (const [index, transaction] of invalidTransactions.entries()) {
    it(`rejects malformed signed XDR case ${index}`, async () => {
      const res = await request(app).post('/auth/verify').send({ transaction });
      assert.ok(
        res.status === 400 || res.status === 401 || res.status === 413 || res.status === 500
      );
      if (res.status === 400 || res.status === 401) {
        assert.equal(res.body.success, false);
        assert.ok(res.body.error.code === 'BAD_REQUEST' || res.body.error.code === 'UNAUTHORIZED');
      }
    });
  }

  const invalidCookies = [
    'paymesh_refresh=',
    'paymesh_refresh=unknown',
    'paymesh_refresh=%00',
    'paymesh_refresh=%F0%9F%94%A5',
    'unrelated=value',
  ];

  for (const [index, cookie] of invalidCookies.entries()) {
    it(`rejects malformed refresh cookie case ${index}`, async () => {
      const res = await request(app).post('/auth/refresh').set('Cookie', cookie).expect(401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });
  }

  it('keeps the public error envelope stable', async () => {
    const res = await request(app).post('/auth/refresh').expect(401);
    assert.deepEqual(Object.keys(res.body).sort(), ['error', 'success']);
    assert.deepEqual(Object.keys(res.body.error).sort(), ['code', 'message']);
  });
});

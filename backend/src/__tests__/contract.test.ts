import { test, describe } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../index.js';
import { signToken } from '../utils/jwt.js';

describe('Contract Routes', () => {
  const token = signToken({ sub: 'GBXGQJWQO5D4Z4Q3T62E2G7L6R4S7G7I6X7Z6L6X5G7I6X7Z6L6X5G7I' });

  test('POST /api/contract/tx/submit with malformed XDR returns 400 Typed Code', async () => {
    const res = await request(app)
      .post('/api/contract/tx/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({ xdr: 'not-valid-base64-or-xdr!@#$' });

    assert.strictEqual(res.status, 400);
    assert.deepStrictEqual(res.body, {
      success: false,
      error: {
        code: 'MALFORMED_XDR',
        message: 'The provided XDR is malformed or invalid.',
      },
    });
  });

  test('POST /api/contract/tx/submit missing XDR returns 400', async () => {
    const res = await request(app)
      .post('/api/contract/tx/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });
});

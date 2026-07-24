import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index.js';

describe('Backend error and request handling', () => {
  it('returns structured 404 responses with request id', async () => {
    const response = await request(app).get('/api/does-not-exist').expect(404);

    assert.strictEqual(response.body.error.statusCode, 404);
    assert.strictEqual(response.body.error.message, 'Not Found');
    assert.ok(typeof response.body.error.timestamp === 'string');

    const requestId = response.headers['x-request-id'];
    assert.ok(typeof requestId === 'string');
    assert.strictEqual(response.body.error.requestId, requestId);
  });

  it('hides internal details for unexpected 5xx errors', async () => {
    const response = await request(app).get('/__test/error').expect(500);

    assert.strictEqual(response.body.error.statusCode, 500);
    assert.strictEqual(response.body.error.message, 'An unexpected error occurred.');
    assert.ok(typeof response.body.error.timestamp === 'string');
    assert.ok(typeof response.body.error.requestId === 'string');
    assert.strictEqual(response.body.error.requestId, response.headers['x-request-id']);
    assert.ok(!('stack' in response.body.error));
  });
});

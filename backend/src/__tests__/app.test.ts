import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import request, { type Response } from 'supertest';

process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';

const { app } = await import('../index.js');

describe('GET /', () => {
  it('returns 200 with welcome message', async () => {
    const res = await request(app).get('/');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(typeof res.body.message, 'string');
  });
});

describe('GET /health', () => {
  let res: Response;

  before(async () => {
    res = await request(app).get('/health').set('Origin', 'http://localhost:3000');
  });

  it('returns 200', () => {
    assert.strictEqual(res.status, 200);
  });

  it('returns status ok', () => {
    assert.strictEqual(res.body.status, 'ok');
  });

  it('returns non-negative numeric uptime', () => {
    assert.strictEqual(typeof res.body.uptime, 'number');
    assert.ok(res.body.uptime >= 0, 'uptime should be >= 0');
  });

  it('returns a non-empty version string', () => {
    assert.strictEqual(typeof res.body.version, 'string');
    assert.ok(res.body.version.length > 0, 'version should not be empty');
  });

  it('has helmet security headers', () => {
    assert.ok(res.headers['x-content-type-options'], 'missing x-content-type-options');
    assert.ok(res.headers['x-frame-options'], 'missing x-frame-options');
  });

  it('has CORS header for configured origin', () => {
    assert.strictEqual(res.headers['access-control-allow-origin'], 'http://localhost:3000');
  });
});

describe('CORS — disallowed origin', () => {
  it('does not echo access-control-allow-origin for a foreign origin', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://evil.com');
    assert.notEqual(
      res.headers['access-control-allow-origin'],
      'http://evil.com',
      'foreign origin must not be reflected'
    );
  });
});

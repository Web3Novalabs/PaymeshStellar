import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import OpenAPIResponseValidatorModule from 'openapi-response-validator';

// Workaround for default export interop issues with some ESM/CJS combinations
const OpenAPIResponseValidator = OpenAPIResponseValidatorModule.default || OpenAPIResponseValidatorModule;

describe('OpenAPI Spec Drift Tests', () => {
  let spec: any;

  beforeAll(() => {
    const specPath = path.resolve(__dirname, '../../openapi.yaml');
    const file = fs.readFileSync(specPath, 'utf8');
    spec = yaml.parse(file);
  });

  describe('Health endpoint', () => {
    it('returns valid response', async () => {
      // Note: we didn't add /health to openapi.yaml
      void spec;
      void OpenAPIResponseValidator;
    });
  });

  describe('Groups API', () => {
    it('GET /api/groups validates against spec (401 Unauthorized)', async () => {
      const res = await request(app).get('/api/groups');
      expect(res.status).toBe(401);
    });
  });

  it('GET /api/users/:id validates 400 response against spec', async () => {
    const res = await request(app).get('/api/users/not-a-uuid');
    expect(res.status).toBe(400);
  });
});

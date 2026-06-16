import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert';
import { Server } from 'http';
import { app } from '../../index.js';
import { groupsService } from '../../services/groups.js';
import { signToken } from '../../utils/jwt.js';

interface TestGroup {
  id: string;
  groupId: string;
  name: string;
  creator: string;
  paymentToken: string;
  members: { address: string; name: string; percentage: number }[];
  membersCount: number;
  createdAt: string;
}

interface TestApiResponse {
  success: boolean;
  data: TestGroup & {
    groups: TestGroup[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
  error: {
    code: string;
    message: string;
  };
}

let server: Server;
let baseUrl: string;

// Set env for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-32-characters-minimum';

const creator1 = 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU'; // Valid Stellar address
const creator2 = 'GAYO55R3JM3OHUB7W52QO7P6CDH5P3WTAF4V6QG4EIVTT6OJZIMIC75W'; // Valid Stellar address

const token1 = signToken({ sub: creator1 });
const token2 = signToken({ sub: creator2 });

before(() => {
  server = app.listen(0);
  const address = server.address();
  if (address && typeof address === 'object') {
    baseUrl = `http://localhost:${address.port}/api/groups`;
  }
});

after(() => {
  server.close();
});

beforeEach(async () => {
  await groupsService.clear();
});

describe('Groups API Integration Tests', () => {
  describe('POST /api/groups', () => {
    it('should return 401 if unauthorized (no token)', async () => {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: 'group-1',
          name: 'Developers',
          paymentToken: 'token-address',
          members: [{ address: creator1, name: 'Alice', percentage: 100 }],
        }),
      });

      assert.strictEqual(response.status, 401);
      const body = (await response.json()) as unknown as TestApiResponse;
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'UNAUTHORIZED');
    });

    it('should return 401 if invalid token is provided', async () => {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-token',
        },
        body: JSON.stringify({
          groupId: 'group-1',
          name: 'Developers',
          paymentToken: 'token-address',
          members: [{ address: creator1, name: 'Alice', percentage: 100 }],
        }),
      });

      assert.strictEqual(response.status, 401);
    });

    it('should return 400 if splits do not total 100%', async () => {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token1}`,
        },
        body: JSON.stringify({
          groupId: 'group-1',
          name: 'Developers',
          paymentToken: 'token-address',
          members: [
            { address: creator1, name: 'Alice', percentage: 40 },
            { address: creator2, name: 'Bob', percentage: 50 }, // total 90%
          ],
        }),
      });

      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as unknown as TestApiResponse;
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'BAD_REQUEST');
      assert.ok(body.error.message.includes('splits must total 100%'));
    });

    it('should create group successfully and return 201 with payload', async () => {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token1}`,
        },
        body: JSON.stringify({
          groupId: 'group-on-chain-1',
          name: 'Engineering Team',
          paymentToken: 'payment-token-address',
          members: [
            { address: creator1, name: 'Alice', percentage: 70 },
            { address: creator2, name: 'Bob', percentage: 30 },
          ],
        }),
      });

      assert.strictEqual(response.status, 201);
      const body = (await response.json()) as unknown as TestApiResponse;
      assert.strictEqual(body.success, true);

      const payload = body.data;
      assert.ok(payload.id);
      assert.strictEqual(payload.groupId, 'group-on-chain-1');
      assert.strictEqual(payload.name, 'Engineering Team');
      assert.strictEqual(payload.creator, creator1);
      assert.strictEqual(payload.paymentToken, 'payment-token-address');
      assert.strictEqual(payload.membersCount, 2);
      assert.ok(payload.createdAt);
      assert.deepStrictEqual(payload.members, [
        { address: creator1, name: 'Alice', percentage: 70 },
        { address: creator2, name: 'Bob', percentage: 30 },
      ]);
    });
  });

  describe('GET /api/groups/:id', () => {
    it('should return 401 if unauthorized', async () => {
      const response = await fetch(`${baseUrl}/some-id`);
      assert.strictEqual(response.status, 401);
    });

    it('should return 404 if group does not exist', async () => {
      const response = await fetch(`${baseUrl}/non-existent-id`, {
        headers: { Authorization: `Bearer ${token1}` },
      });
      assert.strictEqual(response.status, 404);
      const body = (await response.json()) as unknown as TestApiResponse;
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'NOT_FOUND');
    });

    it("should return 403 if reading another user's group", async () => {
      // Create group as creator2
      const created = await groupsService.create({
        groupId: 'group-2',
        name: 'Secret Group',
        creator: creator2,
        paymentToken: 'token-addr',
        members: [{ address: creator2, name: 'Bob', percentage: 100 }],
      });

      // Try reading as creator1 (should fail)
      const response = await fetch(`${baseUrl}/${created.id}`, {
        headers: { Authorization: `Bearer ${token1}` },
      });
      assert.strictEqual(response.status, 403);
      const body = (await response.json()) as unknown as TestApiResponse;
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'FORBIDDEN');

      // Read as creator2 (should succeed)
      const response2 = await fetch(`${baseUrl}/${created.id}`, {
        headers: { Authorization: `Bearer ${token2}` },
      });
      assert.strictEqual(response2.status, 200);
    });

    it('should return correct group if read by owner', async () => {
      const created = await groupsService.create({
        groupId: 'group-1',
        name: 'My Team',
        creator: creator1,
        paymentToken: 'token-addr',
        members: [{ address: creator1, name: 'Alice', percentage: 100 }],
      });

      const response = await fetch(`${baseUrl}/${created.id}`, {
        headers: { Authorization: `Bearer ${token1}` },
      });
      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as unknown as TestApiResponse;
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.id, created.id);
      assert.strictEqual(body.data.name, 'My Team');
    });
  });

  describe('GET /api/groups', () => {
    it('should return 401 if unauthorized', async () => {
      const response = await fetch(baseUrl);
      assert.strictEqual(response.status, 401);
    });

    it('should return 400 if malformed creator address in filter', async () => {
      const response = await fetch(`${baseUrl}?creator=invalid-address`, {
        headers: { Authorization: `Bearer ${token1}` },
      });
      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as unknown as TestApiResponse;
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'BAD_REQUEST');
    });

    it("should return 403 if filtering by another user's address", async () => {
      const response = await fetch(`${baseUrl}?creator=${creator2}`, {
        headers: { Authorization: `Bearer ${token1}` },
      });
      assert.strictEqual(response.status, 403);
      const body = (await response.json()) as unknown as TestApiResponse;
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'FORBIDDEN');
    });

    it('should filter correctly and paginate results', async () => {
      // Create 5 groups for creator1
      for (let i = 1; i <= 5; i++) {
        await groupsService.create({
          groupId: `g-${i}`,
          name: `Team ${i}`,
          creator: creator1,
          paymentToken: 'token-addr',
          members: [{ address: creator1, name: 'Alice', percentage: 100 }],
        });
      }

      // Create 1 group for creator2
      await groupsService.create({
        groupId: 'g-other',
        name: 'Other Team',
        creator: creator2,
        paymentToken: 'token-addr',
        members: [{ address: creator2, name: 'Bob', percentage: 100 }],
      });

      // Query list for creator1, page size 2, offset 1
      const response = await fetch(`${baseUrl}?creator=${creator1}&limit=2&offset=1`, {
        headers: { Authorization: `Bearer ${token1}` },
      });

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as unknown as TestApiResponse;
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.groups.length, 2);
      assert.strictEqual(body.data.pagination.total, 5);
      assert.strictEqual(body.data.pagination.limit, 2);
      assert.strictEqual(body.data.pagination.offset, 1);
      assert.strictEqual(body.data.pagination.hasMore, true);
    });

    it('should enforce limit cap of 100', async () => {
      const response = await fetch(`${baseUrl}?limit=150`, {
        headers: { Authorization: `Bearer ${token1}` },
      });
      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as unknown as TestApiResponse;
      assert.strictEqual(body.data.pagination.limit, 100);
    });
  });

  describe('PUT /api/groups/:id', () => {
    it('should return 401 if unauthorized', async () => {
      const response = await fetch(`${baseUrl}/some-id`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      });
      assert.strictEqual(response.status, 401);
    });

    it('should return 404 if updating non-existent group', async () => {
      const response = await fetch(`${baseUrl}/non-existent-id`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token1}`,
        },
        body: JSON.stringify({ name: 'New Name' }),
      });
      assert.strictEqual(response.status, 404);
    });

    it("should return 403 if editing another user's group", async () => {
      const created = await groupsService.create({
        groupId: 'g-2',
        name: 'Group 2',
        creator: creator2,
        paymentToken: 'token-addr',
        members: [{ address: creator2, name: 'Bob', percentage: 100 }],
      });

      const response = await fetch(`${baseUrl}/${created.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token1}`,
        },
        body: JSON.stringify({ name: 'Hacked Name' }),
      });
      assert.strictEqual(response.status, 403);
    });

    it('should return 400 if editing splits to not total 100%', async () => {
      const created = await groupsService.create({
        groupId: 'g-1',
        name: 'Group 1',
        creator: creator1,
        paymentToken: 'token-addr',
        members: [{ address: creator1, name: 'Alice', percentage: 100 }],
      });

      const response = await fetch(`${baseUrl}/${created.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token1}`,
        },
        body: JSON.stringify({
          members: [{ address: creator1, name: 'Alice', percentage: 50 }],
        }),
      });
      assert.strictEqual(response.status, 400);
    });

    it('should update group details successfully', async () => {
      const created = await groupsService.create({
        groupId: 'g-1',
        name: 'Group 1',
        creator: creator1,
        paymentToken: 'token-addr',
        members: [{ address: creator1, name: 'Alice', percentage: 100 }],
      });

      const response = await fetch(`${baseUrl}/${created.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token1}`,
        },
        body: JSON.stringify({
          name: 'Updated Group 1',
          members: [
            { address: creator1, name: 'Alice', percentage: 80 },
            { address: creator2, name: 'Bob', percentage: 20 },
          ],
        }),
      });

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as unknown as TestApiResponse;
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.name, 'Updated Group 1');
      assert.strictEqual(body.data.membersCount, 2);
      assert.deepStrictEqual(body.data.members, [
        { address: creator1, name: 'Alice', percentage: 80 },
        { address: creator2, name: 'Bob', percentage: 20 },
      ]);
    });
  });
});

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../index.js';
import { groupsService, InMemoryGroupsService, type Group } from '../../services/groups.js';
import { signToken } from '../../utils/jwt.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-32-characters-minimum';

const creator1 = 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU';
const creator2 = 'GAYO55R3JM3OHUB7W52QO7P6CDH5P3WTAF4V6QG4EIVTT6OJZIMIC75W';

const token1 = signToken({ sub: creator1 });

function mockGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'test-uuid-123',
    groupId: 'group-on-chain-1',
    name: 'Engineering Team',
    creator: creator1,
    paymentToken: 'payment-token-address',
    members: [
      { address: creator1, name: 'Alice', percentage: 70 },
      { address: creator2, name: 'Bob', percentage: 30 },
    ],
    membersCount: 2,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

beforeEach(() => {
  mock.restoreAll();
});

describe('JWT — expired token', () => {
  it('returns 401 when an expired token is presented', async () => {
    // sign a token that expired 1 second ago
    const expiredToken = signToken({ sub: creator1, exp: Math.floor(Date.now() / 1000) - 1 });

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });
});

describe('POST /api/groups', () => {
  const validPayload = {
    groupId: 'group-on-chain-1',
    name: 'Engineering Team',
    paymentToken: 'payment-token-address',
    members: [
      { address: creator1, name: 'Alice', percentage: 70 },
      { address: creator2, name: 'Bob', percentage: 30 },
    ],
  };

  it('returns 401 when no auth token is provided', async () => {
    const createMock = mock.method(groupsService, 'create', () => {
      throw new Error('should not be called');
    });

    const res = await request(app).post('/api/groups').send(validPayload).expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
    assert.strictEqual(createMock.mock.calls.length, 0);
  });

  it('returns 401 when an invalid token is provided', async () => {
    const createMock = mock.method(groupsService, 'create', () => {
      throw new Error('should not be called');
    });

    const res = await request(app)
      .post('/api/groups')
      .set('Authorization', 'Bearer invalid-token')
      .send(validPayload)
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(createMock.mock.calls.length, 0);
  });

  it('returns 400 when required fields are missing', async () => {
    const createMock = mock.method(groupsService, 'create', () => {
      throw new Error('should not be called');
    });

    const res = await request(app)
      .post('/api/groups')
      .set('Authorization', `Bearer ${token1}`)
      .send({ name: 'Incomplete' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
    assert.strictEqual(createMock.mock.calls.length, 0);
  });

  it('returns 400 when members array has invalid entries', async () => {
    const createMock = mock.method(groupsService, 'create', () => {
      throw new Error('should not be called');
    });

    const res = await request(app)
      .post('/api/groups')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        groupId: 'g-1',
        name: 'Test',
        paymentToken: 'token',
        members: [{ bad: 'data' }],
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
    assert.strictEqual(createMock.mock.calls.length, 0);
  });

  it('returns 400 when percentage splits do not total 100%', async () => {
    const createMock = mock.method(groupsService, 'create', () => {
      throw new Error('should not be called');
    });

    const res = await request(app)
      .post('/api/groups')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        groupId: 'g-1',
        name: 'Test',
        paymentToken: 'token',
        members: [
          { address: creator1, name: 'Alice', percentage: 40 },
          { address: creator2, name: 'Bob', percentage: 50 },
        ],
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
    assert.ok(res.body.error.message.includes('splits must total 100%'));
    assert.strictEqual(createMock.mock.calls.length, 0);
  });

  it('returns 400 when a member percentage is negative', async () => {
    const createMock = mock.method(groupsService, 'create', () => {
      throw new Error('should not be called');
    });

    const res = await request(app)
      .post('/api/groups')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        groupId: 'g-1',
        name: 'Test',
        paymentToken: 'token',
        members: [
          { address: creator1, name: 'Alice', percentage: -50 },
          { address: creator2, name: 'Bob', percentage: 150 },
        ],
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
    assert.strictEqual(createMock.mock.calls.length, 0);
  });

  it('returns 201 with the created group payload on success', async () => {
    const expected = mockGroup();
    const createMock = mock.method(groupsService, 'create', async () => expected);

    const res = await request(app)
      .post('/api/groups')
      .set('Authorization', `Bearer ${token1}`)
      .send(validPayload)
      .expect(201);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.id, expected.id);
    assert.strictEqual(res.body.data.groupId, expected.groupId);
    assert.strictEqual(res.body.data.name, expected.name);
    assert.strictEqual(res.body.data.creator, expected.creator);
    assert.strictEqual(res.body.data.paymentToken, expected.paymentToken);
    assert.strictEqual(res.body.data.membersCount, expected.membersCount);
    assert.strictEqual(res.body.data.createdAt, expected.createdAt.toISOString());
    assert.deepStrictEqual(res.body.data.members, expected.members);

    assert.strictEqual(createMock.mock.calls.length, 1);
    const args = createMock.mock.calls[0].arguments;
    const data = args[0] as Record<string, unknown>;
    assert.strictEqual(data.name, 'Engineering Team');
    assert.strictEqual(data.creator, creator1);
  });
});

describe('GET /api/groups/:id', () => {
  it('returns 401 when no auth token is provided', async () => {
    const getByIdMock = mock.method(groupsService, 'getById', () => {
      throw new Error('should not be called');
    });

    const res = await request(app).get('/api/groups/some-id').expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
    assert.strictEqual(getByIdMock.mock.calls.length, 0);
  });

  it('returns 404 when the group does not exist', async () => {
    mock.method(groupsService, 'getById', async () => null);

    const res = await request(app)
      .get('/api/groups/non-existent-id')
      .set('Authorization', `Bearer ${token1}`)
      .expect(404);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'NOT_FOUND');
    assert.strictEqual(res.body.error.message, 'Group not found.');
  });

  it('returns 403 when accessing another users group', async () => {
    const group = mockGroup({ creator: creator2 });
    mock.method(groupsService, 'getById', async () => group);

    const res = await request(app)
      .get(`/api/groups/${group.id}`)
      .set('Authorization', `Bearer ${token1}`)
      .expect(403);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'FORBIDDEN');
  });

  it('returns 200 with the group when accessed by owner', async () => {
    const group = mockGroup();
    mock.method(groupsService, 'getById', async () => group);

    const res = await request(app)
      .get(`/api/groups/${group.id}`)
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.id, group.id);
    assert.strictEqual(res.body.data.name, group.name);
    assert.strictEqual(res.body.data.creator, group.creator);
  });
});

describe('GET /api/groups — pagination edge cases', () => {
  it('treats a non-numeric limit as the default of 10', async () => {
    const listMock = mock.method(groupsService, 'list', async () => ({
      groups: [],
      totalCount: 0,
    }));

    const res = await request(app)
      .get('/api/groups?limit=abc')
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    assert.strictEqual(res.body.data.pagination.limit, 10);
    assert.strictEqual(listMock.mock.calls.length, 1);
  });

  it('treats a negative limit as the default of 10', async () => {
    const listMock = mock.method(groupsService, 'list', async () => ({
      groups: [],
      totalCount: 0,
    }));

    const res = await request(app)
      .get('/api/groups?limit=-5')
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    assert.strictEqual(res.body.data.pagination.limit, 10);
    assert.strictEqual(listMock.mock.calls.length, 1);
  });
});

describe('GET /api/groups', () => {
  it('returns 401 when no auth token is provided', async () => {
    const listMock = mock.method(groupsService, 'list', () => {
      throw new Error('should not be called');
    });

    const res = await request(app).get('/api/groups').expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
    assert.strictEqual(listMock.mock.calls.length, 0);
  });

  it('returns 400 for a malformed creator address filter', async () => {
    const listMock = mock.method(groupsService, 'list', () => {
      throw new Error('should not be called');
    });

    const res = await request(app)
      .get('/api/groups?creator=invalid-address')
      .set('Authorization', `Bearer ${token1}`)
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
    assert.strictEqual(listMock.mock.calls.length, 0);
  });

  it('returns 403 when filtering by another users address', async () => {
    const listMock = mock.method(groupsService, 'list', () => {
      throw new Error('should not be called');
    });

    const res = await request(app)
      .get(`/api/groups?creator=${creator2}`)
      .set('Authorization', `Bearer ${token1}`)
      .expect(403);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'FORBIDDEN');
    assert.strictEqual(listMock.mock.calls.length, 0);
  });

  it('returns paginated results with correct metadata', async () => {
    const groups = Array.from({ length: 5 }, (_, i) =>
      mockGroup({ id: `group-${i}`, groupId: `g-${i}`, name: `Team ${i}` })
    );

    const listMock = mock.method(
      groupsService,
      'list',
      async (options: { limit?: number; offset?: number }) => {
        const limit = options.limit ?? 10;
        const offset = options.offset ?? 0;
        return {
          groups: groups.slice(offset, offset + limit),
          totalCount: groups.length,
        };
      }
    );

    const res = await request(app)
      .get('/api/groups?limit=2&offset=1')
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.groups.length, 2);
    assert.strictEqual(res.body.data.pagination.total, 5);
    assert.strictEqual(res.body.data.pagination.limit, 2);
    assert.strictEqual(res.body.data.pagination.offset, 1);
    assert.strictEqual(res.body.data.pagination.hasMore, true);

    assert.strictEqual(listMock.mock.calls.length, 1);
    const opts = listMock.mock.calls[0].arguments[0] as {
      limit: number;
      offset: number;
    };
    assert.strictEqual(opts.limit, 2);
    assert.strictEqual(opts.offset, 1);
  });

  it('enforces a maximum limit of 100', async () => {
    const listMock = mock.method(groupsService, 'list', async () => ({
      groups: [],
      totalCount: 0,
    }));

    const res = await request(app)
      .get('/api/groups?limit=150')
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    assert.strictEqual(res.body.data.pagination.limit, 100);

    assert.strictEqual(listMock.mock.calls.length, 1);
    const opts = listMock.mock.calls[0].arguments[0] as { limit: number };
    assert.strictEqual(opts.limit, 100);
  });

  it('returns empty result for out-of-range pagination', async () => {
    const listMock = mock.method(groupsService, 'list', async () => ({
      groups: [],
      totalCount: 0,
    }));

    const res = await request(app)
      .get('/api/groups?offset=999&limit=10')
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.groups.length, 0);
    assert.strictEqual(res.body.data.pagination.hasMore, false);
    assert.strictEqual(listMock.mock.calls.length, 1);
  });
});

describe('InMemoryGroupsService — unit', () => {
  let svc: InMemoryGroupsService;

  beforeEach(async () => {
    svc = new InMemoryGroupsService();
  });

  it('create stores a group and returns it with an id', async () => {
    const group = await svc.create({
      groupId: 'g-1',
      name: 'Team',
      creator: creator1,
      paymentToken: 'token',
      members: [{ address: creator1, name: 'Alice', percentage: 100 }],
    });
    assert.ok(group.id);
    assert.strictEqual(group.membersCount, 1);
    assert.ok(group.createdAt instanceof Date);
  });

  it('getById returns null for an unknown id', async () => {
    const result = await svc.getById('no-such-id');
    assert.strictEqual(result, null);
  });

  it('list filters by creator', async () => {
    await svc.create({
      groupId: 'g-1',
      name: 'A',
      creator: creator1,
      paymentToken: 't',
      members: [{ address: creator1, name: 'x', percentage: 100 }],
    });
    await svc.create({
      groupId: 'g-2',
      name: 'B',
      creator: creator2,
      paymentToken: 't',
      members: [{ address: creator2, name: 'y', percentage: 100 }],
    });

    const result = await svc.list({ creator: creator1 });
    assert.strictEqual(result.totalCount, 1);
    assert.strictEqual(result.groups[0].creator, creator1);
  });

  it('list respects limit and offset', async () => {
    for (let i = 0; i < 5; i++) {
      await svc.create({
        groupId: `g-${i}`,
        name: `T${i}`,
        creator: creator1,
        paymentToken: 't',
        members: [{ address: creator1, name: 'x', percentage: 100 }],
      });
    }
    const result = await svc.list({ limit: 2, offset: 1 });
    assert.strictEqual(result.groups.length, 2);
    assert.strictEqual(result.totalCount, 5);
  });

  it('update merges fields and recomputes membersCount', async () => {
    const group = await svc.create({
      groupId: 'g-1',
      name: 'Old',
      creator: creator1,
      paymentToken: 't',
      members: [{ address: creator1, name: 'x', percentage: 100 }],
    });
    const updated = await svc.update(group.id, {
      name: 'New',
      members: [
        { address: creator1, name: 'x', percentage: 60 },
        { address: creator2, name: 'y', percentage: 40 },
      ],
    });
    assert.strictEqual(updated?.name, 'New');
    assert.strictEqual(updated?.membersCount, 2);
  });

  it('update returns null for an unknown id', async () => {
    const result = await svc.update('no-such-id', { name: 'x' });
    assert.strictEqual(result, null);
  });

  it('clear empties the store', async () => {
    await svc.create({
      groupId: 'g-1',
      name: 'T',
      creator: creator1,
      paymentToken: 't',
      members: [{ address: creator1, name: 'x', percentage: 100 }],
    });
    await svc.clear();
    const result = await svc.list({});
    assert.strictEqual(result.totalCount, 0);
  });
});

describe('PUT /api/groups/:id', () => {
  it('returns 401 when no auth token is provided', async () => {
    const getByIdMock = mock.method(groupsService, 'getById', () => {
      throw new Error('should not be called');
    });

    const res = await request(app)
      .put('/api/groups/some-id')
      .send({ name: 'New Name' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
    assert.strictEqual(getByIdMock.mock.calls.length, 0);
  });

  it('returns 404 when updating a non-existent group', async () => {
    mock.method(groupsService, 'getById', async () => null);

    const res = await request(app)
      .put('/api/groups/non-existent-id')
      .set('Authorization', `Bearer ${token1}`)
      .send({ name: 'New Name' })
      .expect(404);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'NOT_FOUND');
  });

  it('returns 403 when updating another users group', async () => {
    mock.method(groupsService, 'getById', async () => mockGroup({ creator: creator2 }));

    const res = await request(app)
      .put('/api/groups/some-id')
      .set('Authorization', `Bearer ${token1}`)
      .send({ name: 'Hacked Name' })
      .expect(403);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'FORBIDDEN');
  });

  it('returns 400 when updating splits to not total 100%', async () => {
    mock.method(groupsService, 'getById', async () => mockGroup());

    const res = await request(app)
      .put('/api/groups/some-id')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        members: [{ address: creator1, name: 'Alice', percentage: 50 }],
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('updates group details successfully', async () => {
    const existing = mockGroup();
    const updated = mockGroup({
      name: 'Updated Group',
      members: [
        { address: creator1, name: 'Alice', percentage: 80 },
        { address: creator2, name: 'Bob', percentage: 20 },
      ],
      membersCount: 2,
    });

    mock.method(groupsService, 'getById', async () => existing);
    const updateMock = mock.method(groupsService, 'update', async () => updated);

    const res = await request(app)
      .put(`/api/groups/${existing.id}`)
      .set('Authorization', `Bearer ${token1}`)
      .send({
        name: 'Updated Group',
        members: [
          { address: creator1, name: 'Alice', percentage: 80 },
          { address: creator2, name: 'Bob', percentage: 20 },
        ],
      })
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.name, 'Updated Group');
    assert.strictEqual(res.body.data.membersCount, 2);
    assert.strictEqual(updateMock.mock.calls.length, 1);
  });
});

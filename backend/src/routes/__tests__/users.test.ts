import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../index.js';
import { usersService, type User } from '../../services/users.js';
import { signToken } from '../../utils/jwt.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-32-characters-minimum';

const address1 = 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU';
const address2 = 'GAYO55R3JM3OHUB7W52QO7P6CDH5P3WTAF4V6QG4EIVTT6OJZIMIC75W';

const token1 = signToken({ sub: address1 });
const token2 = signToken({ sub: address2 });

function mockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-id-123',
    address: address1,
    name: 'Alice',
    email: 'alice@example.com',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

beforeEach(() => {
  mock.restoreAll();
});

describe('POST /api/users', () => {
  const validPayload = {
    name: 'Alice',
    email: 'alice@example.com',
  };

  it('returns 401 when no auth token is provided', async () => {
    const createMock = mock.method(usersService, 'create', () => {
      throw new Error('should not be called');
    });

    const res = await request(app).post('/api/users').send(validPayload).expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
    assert.strictEqual(createMock.mock.calls.length, 0);
  });

  it('returns 401 when an invalid token is provided', async () => {
    const createMock = mock.method(usersService, 'create', () => {
      throw new Error('should not be called');
    });

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', 'Bearer invalid-token')
      .send(validPayload)
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(createMock.mock.calls.length, 0);
  });

  it('returns 400 when name is missing', async () => {
    const createMock = mock.method(usersService, 'create', () => {
      throw new Error('should not be called');
    });

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token1}`)
      .send({ email: 'alice@example.com' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
    assert.match(res.body.error.message, /name/);
    assert.strictEqual(createMock.mock.calls.length, 0);
  });

  it('returns 400 when name is empty', async () => {
    const createMock = mock.method(usersService, 'create', () => {
      throw new Error('should not be called');
    });

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token1}`)
      .send({ name: '', email: 'alice@example.com' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
    assert.strictEqual(createMock.mock.calls.length, 0);
  });

  it('returns 400 when name is whitespace', async () => {
    const createMock = mock.method(usersService, 'create', () => {
      throw new Error('should not be called');
    });

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token1}`)
      .send({ name: '   ', email: 'alice@example.com' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
    assert.strictEqual(createMock.mock.calls.length, 0);
  });

  it('returns 400 when email is invalid', async () => {
    const createMock = mock.method(usersService, 'create', () => {
      throw new Error('should not be called');
    });

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token1}`)
      .send({ name: 'Alice', email: 'not-an-email' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
    assert.match(res.body.error.message, /email/);
    assert.strictEqual(createMock.mock.calls.length, 0);
  });

  it('returns 400 when extra fields are provided', async () => {
    const createMock = mock.method(usersService, 'create', () => {
      throw new Error('should not be called');
    });

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token1}`)
      .send({ name: 'Alice', email: 'alice@example.com', extraField: 'value' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
    assert.match(res.body.error.message, /Unknown fields/);
    assert.strictEqual(createMock.mock.calls.length, 0);
  });

  it('returns 201 when user is created successfully', async () => {
    const user = mockUser();
    mock.method(usersService, 'getByAddress', () => Promise.resolve(null));
    mock.method(usersService, 'create', () => Promise.resolve(user));

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token1}`)
      .send(validPayload)
      .expect(201);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.id, user.id);
    assert.strictEqual(res.body.data.address, address1);
    assert.strictEqual(res.body.data.name, 'Alice');
    assert.strictEqual(res.body.data.email, 'alice@example.com');
  });

  it('returns 409 when user profile already exists for address', async () => {
    const user = mockUser();
    mock.method(usersService, 'getByAddress', () => Promise.resolve(user));
    const createMock = mock.method(usersService, 'create', () => {
      throw new Error('should not be called');
    });

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token1}`)
      .send(validPayload)
      .expect(409);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'CONFLICT');
    assert.strictEqual(createMock.mock.calls.length, 0);
  });

  it('creates with optional email field omitted', async () => {
    const user = mockUser({ email: undefined });
    mock.method(usersService, 'getByAddress', () => Promise.resolve(null));
    mock.method(usersService, 'create', () => Promise.resolve(user));

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token1}`)
      .send({ name: 'Alice' })
      .expect(201);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.name, 'Alice');
    assert.strictEqual(res.body.data.email, undefined);
  });
});

describe('GET /api/users/:id', () => {
  it('returns 404 when user does not exist', async () => {
    mock.method(usersService, 'getById', () => Promise.resolve(null));

    const res = await request(app).get('/api/users/nonexistent-id').expect(404);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'NOT_FOUND');
  });

  it('returns 200 and user profile when found', async () => {
    const user = mockUser();
    mock.method(usersService, 'getById', () => Promise.resolve(user));

    const res = await request(app).get(`/api/users/${user.id}`).expect(200);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.id, user.id);
    assert.strictEqual(res.body.data.address, address1);
    assert.strictEqual(res.body.data.name, 'Alice');
    assert.strictEqual(res.body.data.email, 'alice@example.com');
  });

  it('does not require authentication', async () => {
    const user = mockUser();
    mock.method(usersService, 'getById', () => Promise.resolve(user));

    const res = await request(app).get(`/api/users/${user.id}`).expect(200);

    assert.strictEqual(res.body.success, true);
  });
});

describe('GET /api/users/me', () => {
  it('returns 401 when no auth token is provided', async () => {
    const getByAddressMock = mock.method(usersService, 'getByAddress', () => {
      throw new Error('should not be called');
    });

    const res = await request(app).get('/api/users/me').expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
    assert.strictEqual(getByAddressMock.mock.calls.length, 0);
  });

  it('returns 401 when invalid token is provided', async () => {
    const getByAddressMock = mock.method(usersService, 'getByAddress', () => {
      throw new Error('should not be called');
    });

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(getByAddressMock.mock.calls.length, 0);
  });

  it('returns 404 when user does not exist for authenticated address', async () => {
    mock.method(usersService, 'getByAddress', () => Promise.resolve(null));

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token1}`)
      .expect(404);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'NOT_FOUND');
  });

  it('returns 200 and user profile for authenticated user', async () => {
    const user = mockUser();
    mock.method(usersService, 'getByAddress', () => Promise.resolve(user));

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.address, address1);
    assert.strictEqual(res.body.data.name, 'Alice');
  });

  it('resolves profile from JWT subject claim', async () => {
    const user = mockUser({ address: address2 });
    const getByAddressMock = mock.method(usersService, 'getByAddress', () => Promise.resolve(user));

    await request(app).get('/api/users/me').set('Authorization', `Bearer ${token2}`).expect(200);

    assert.strictEqual(getByAddressMock.mock.calls.length, 1);
    assert.strictEqual(getByAddressMock.mock.calls[0].arguments[0], address2);
  });
});

describe('PUT /api/users/:id', () => {
  it('returns 401 when no auth token is provided', async () => {
    const updateMock = mock.method(usersService, 'update', () => {
      throw new Error('should not be called');
    });

    const res = await request(app)
      .put('/api/users/user-id-123')
      .send({ name: 'Updated' })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
    assert.strictEqual(updateMock.mock.calls.length, 0);
  });

  it('returns 404 when user does not exist', async () => {
    mock.method(usersService, 'getById', () => Promise.resolve(null));

    const res = await request(app)
      .put('/api/users/nonexistent-id')
      .set('Authorization', `Bearer ${token1}`)
      .send({ name: 'Updated' })
      .expect(404);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'NOT_FOUND');
  });

  it("returns 403 when updating another user's profile", async () => {
    const user = mockUser({ address: address2 });
    mock.method(usersService, 'getById', () => Promise.resolve(user));
    const updateMock = mock.method(usersService, 'update', () => {
      throw new Error('should not be called');
    });

    const res = await request(app)
      .put('/api/users/user-id-123')
      .set('Authorization', `Bearer ${token1}`)
      .send({ name: 'Hacker' })
      .expect(403);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'FORBIDDEN');
    assert.strictEqual(updateMock.mock.calls.length, 0);
  });

  it('returns 400 when name is empty', async () => {
    const user = mockUser();
    mock.method(usersService, 'getById', () => Promise.resolve(user));
    const updateMock = mock.method(usersService, 'update', () => {
      throw new Error('should not be called');
    });

    const res = await request(app)
      .put('/api/users/user-id-123')
      .set('Authorization', `Bearer ${token1}`)
      .send({ name: '' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
    assert.strictEqual(updateMock.mock.calls.length, 0);
  });

  it('returns 400 when email is invalid', async () => {
    const user = mockUser();
    mock.method(usersService, 'getById', () => Promise.resolve(user));
    const updateMock = mock.method(usersService, 'update', () => {
      throw new Error('should not be called');
    });

    const res = await request(app)
      .put('/api/users/user-id-123')
      .set('Authorization', `Bearer ${token1}`)
      .send({ email: 'not-an-email' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
    assert.strictEqual(updateMock.mock.calls.length, 0);
  });

  it('returns 400 when extra fields are provided', async () => {
    const user = mockUser();
    mock.method(usersService, 'getById', () => Promise.resolve(user));
    const updateMock = mock.method(usersService, 'update', () => {
      throw new Error('should not be called');
    });

    const res = await request(app)
      .put('/api/users/user-id-123')
      .set('Authorization', `Bearer ${token1}`)
      .send({ name: 'Alice', extraField: 'value' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
    assert.match(res.body.error.message, /Unknown fields/);
    assert.strictEqual(updateMock.mock.calls.length, 0);
  });

  it('returns 200 and updates name', async () => {
    const user = mockUser();
    const updated = mockUser({ name: 'Updated Alice' });
    mock.method(usersService, 'getById', () => Promise.resolve(user));
    mock.method(usersService, 'update', () => Promise.resolve(updated));

    const res = await request(app)
      .put('/api/users/user-id-123')
      .set('Authorization', `Bearer ${token1}`)
      .send({ name: 'Updated Alice' })
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.name, 'Updated Alice');
  });

  it('returns 200 and updates email', async () => {
    const user = mockUser();
    const updated = mockUser({ email: 'newemail@example.com' });
    mock.method(usersService, 'getById', () => Promise.resolve(user));
    mock.method(usersService, 'update', () => Promise.resolve(updated));

    const res = await request(app)
      .put('/api/users/user-id-123')
      .set('Authorization', `Bearer ${token1}`)
      .send({ email: 'newemail@example.com' })
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.email, 'newemail@example.com');
  });

  it('returns 200 and updates both name and email', async () => {
    const user = mockUser();
    const updated = mockUser({ name: 'Updated', email: 'new@example.com' });
    mock.method(usersService, 'getById', () => Promise.resolve(user));
    mock.method(usersService, 'update', () => Promise.resolve(updated));

    const res = await request(app)
      .put('/api/users/user-id-123')
      .set('Authorization', `Bearer ${token1}`)
      .send({ name: 'Updated', email: 'new@example.com' })
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.name, 'Updated');
    assert.strictEqual(res.body.data.email, 'new@example.com');
  });

  it('allows clearing email by sending null', async () => {
    const user = mockUser();
    const updated = mockUser({ email: undefined });
    mock.method(usersService, 'getById', () => Promise.resolve(user));
    mock.method(usersService, 'update', () => Promise.resolve(updated));

    const res = await request(app)
      .put('/api/users/user-id-123')
      .set('Authorization', `Bearer ${token1}`)
      .send({ email: null })
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.email, undefined);
  });
});

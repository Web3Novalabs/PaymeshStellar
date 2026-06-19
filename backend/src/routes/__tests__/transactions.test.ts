import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../index.js';
import { transactionDataSource, Transaction } from '../../services/transactions.js';
import { groupsService } from '../../services/groups.js';
import { signToken } from '../../utils/jwt.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-32-characters-minimum';

const creator1 = 'GDQOMSFX2N6HXZI5V3QZ3E36XW4B2DOKWZ4C3G42NIXQDX722Y6M42SU';
const creator2 = 'GAYO55R3JM3OHUB7W52QO7P6CDH5P3WTAF4V6QG4EIVTT6OJZIMIC75W';
const nonMember = 'GCEZ5G4BYP7KPFXQ7KWXY3KFXWQ7TQVBQZZ7MNCXNTKR7T4ZZZZZZZ';

const token1 = signToken({ sub: creator1 });
const token2 = signToken({ sub: creator2 });
const tokenNonMember = signToken({ sub: nonMember });

const groupId = 'test-group-id-123';

function mockTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-' + Math.random().toString(36).slice(2),
    groupId,
    amount: '1000000', // 1 XLM in stroops
    asset: 'native',
    timestamp: new Date('2026-01-01T12:00:00.000Z'),
    membersInvolved: [creator1, creator2],
    txHash: 'abc123def456',
    ...overrides,
  };
}

beforeEach(() => {
  mock.restoreAll();
});

describe('GET /api/transactions', () => {
  // Clear transaction data before each transaction test
  beforeEach(async () => {
    // Ensure test group exists
    await groupsService.clear();
    await groupsService.create({
      groupId,
      name: 'Test Group',
      creator: creator1,
      paymentToken: 'PAYMENT_TOKEN_ADDRESS',
      members: [
        { address: creator1, name: 'Alice', percentage: 60 },
        { address: creator2, name: 'Bob', percentage: 40 },
      ],
    });

    if (transactionDataSource.clear) {
      await transactionDataSource.clear();
    }
  });

  it('returns 401 when no auth token is provided', async () => {
    const res = await request(app)
      .get('/api/transactions?group_id=' + groupId)
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('returns 401 when an invalid token is provided', async () => {
    const res = await request(app)
      .get('/api/transactions?group_id=' + groupId)
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('returns 400 when group_id is missing', async () => {
    const res = await request(app)
      .get('/api/transactions')
      .set('Authorization', `Bearer ${token1}`)
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
    assert.match(res.body.error.message, /group_id/);
  });

  it('returns 400 when group_id is empty string', async () => {
    const res = await request(app)
      .get('/api/transactions?group_id=')
      .set('Authorization', `Bearer ${token1}`)
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
  });

  it('returns 403 when user is not a member or creator of the group', async () => {
    const res = await request(app)
      .get('/api/transactions?group_id=' + groupId)
      .set('Authorization', `Bearer ${tokenNonMember}`)
      .expect(403);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'FORBIDDEN');
    assert.match(res.body.error.message, /do not belong to this group/);
  });

  it('returns 403 when group does not exist', async () => {
    const res = await request(app)
      .get('/api/transactions?group_id=nonexistent-group')
      .set('Authorization', `Bearer ${token1}`)
      .expect(403);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'FORBIDDEN');
  });

  it('returns 200 with empty data array when no transactions exist', async () => {
    const res = await request(app)
      .get('/api/transactions?group_id=' + groupId)
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.deepStrictEqual(res.body.data, []);
    assert.strictEqual(res.body.pagination.limit, 10);
    assert.strictEqual(res.body.pagination.hasMore, false);
    assert.strictEqual(res.body.pagination.nextCursor, undefined);
  });

  it('allows creator to list transactions', async () => {
    if (transactionDataSource.addTransaction) {
      await transactionDataSource.addTransaction(
        mockTransaction({
          timestamp: new Date('2026-01-01T12:00:00.000Z'),
        })
      );
    }

    const res = await request(app)
      .get('/api/transactions?group_id=' + groupId)
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.length, 1);
  });

  it('allows group members to list transactions', async () => {
    if (transactionDataSource.addTransaction) {
      await transactionDataSource.addTransaction(mockTransaction());
    }

    const res = await request(app)
      .get('/api/transactions?group_id=' + groupId)
      .set('Authorization', `Bearer ${token2}`) // creator2 is a member
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.length, 1);
  });

  it('filters transactions by member address', async () => {
    if (transactionDataSource.addTransaction) {
      await transactionDataSource.addTransaction(
        mockTransaction({
          id: 'tx-1',
          membersInvolved: [creator1],
          timestamp: new Date('2026-01-01T10:00:00.000Z'),
        })
      );

      await transactionDataSource.addTransaction(
        mockTransaction({
          id: 'tx-2',
          membersInvolved: [creator2],
          timestamp: new Date('2026-01-01T11:00:00.000Z'),
        })
      );

      await transactionDataSource.addTransaction(
        mockTransaction({
          id: 'tx-3',
          membersInvolved: [creator1, creator2],
          timestamp: new Date('2026-01-01T12:00:00.000Z'),
        })
      );
    }

    const res = await request(app)
      .get(`/api/transactions?group_id=${groupId}&member=${creator1}`)
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    assert.strictEqual(res.body.data.length, 2);
    assert.ok(
      res.body.data.every((tx: { membersInvolved: string[] }) => {
        return tx.membersInvolved.includes(creator1);
      })
    );
  });

  it('returns 400 for invalid member address format', async () => {
    const res = await request(app)
      .get('/api/transactions?group_id=' + groupId + '&member=invalid-address')
      .set('Authorization', `Bearer ${token1}`)
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
    assert.match(res.body.error.message, /valid Stellar address/);
  });

  it('sorts transactions in descending order by default', async () => {
    if (transactionDataSource.addTransaction) {
      const tx1 = mockTransaction({
        id: 'tx-1',
        timestamp: new Date('2026-01-01T10:00:00.000Z'),
      });
      const tx2 = mockTransaction({
        id: 'tx-2',
        timestamp: new Date('2026-01-01T12:00:00.000Z'),
      });
      const tx3 = mockTransaction({
        id: 'tx-3',
        timestamp: new Date('2026-01-01T11:00:00.000Z'),
      });

      await transactionDataSource.addTransaction(tx1);
      await transactionDataSource.addTransaction(tx2);
      await transactionDataSource.addTransaction(tx3);
    }

    const res = await request(app)
      .get('/api/transactions?group_id=' + groupId)
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    assert.strictEqual(res.body.data.length, 3);
    assert.strictEqual(res.body.data[0].id, 'tx-2'); // Latest first
    assert.strictEqual(res.body.data[1].id, 'tx-3');
    assert.strictEqual(res.body.data[2].id, 'tx-1');
  });

  it('sorts transactions in ascending order when requested', async () => {
    if (transactionDataSource.addTransaction) {
      const tx1 = mockTransaction({
        id: 'tx-1',
        timestamp: new Date('2026-01-01T10:00:00.000Z'),
      });
      const tx2 = mockTransaction({
        id: 'tx-2',
        timestamp: new Date('2026-01-01T12:00:00.000Z'),
      });
      const tx3 = mockTransaction({
        id: 'tx-3',
        timestamp: new Date('2026-01-01T11:00:00.000Z'),
      });

      await transactionDataSource.addTransaction(tx1);
      await transactionDataSource.addTransaction(tx2);
      await transactionDataSource.addTransaction(tx3);
    }

    const res = await request(app)
      .get('/api/transactions?group_id=' + groupId + '&order=asc')
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    assert.strictEqual(res.body.data.length, 3);
    assert.strictEqual(res.body.data[0].id, 'tx-1'); // Oldest first
    assert.strictEqual(res.body.data[1].id, 'tx-3');
    assert.strictEqual(res.body.data[2].id, 'tx-2');
  });

  it('returns 400 for invalid order parameter', async () => {
    const res = await request(app)
      .get('/api/transactions?group_id=' + groupId + '&order=invalid')
      .set('Authorization', `Bearer ${token1}`)
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
    assert.match(res.body.error.message, /asc.*desc/);
  });

  it('enforces limit parameter and caps at 100', async () => {
    if (transactionDataSource.addTransaction) {
      for (let i = 0; i < 15; i++) {
        await transactionDataSource.addTransaction(
          mockTransaction({
            id: `tx-${i}`,
            timestamp: new Date('2026-01-01T' + String(i + 10).padStart(2, '0') + ':00:00.000Z'),
          })
        );
      }
    }

    const res1 = await request(app)
      .get('/api/transactions?group_id=' + groupId + '&limit=5')
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    assert.strictEqual(res1.body.data.length, 5);
    assert.strictEqual(res1.body.pagination.limit, 5);
    assert.strictEqual(res1.body.pagination.hasMore, true);
    assert.ok(res1.body.pagination.nextCursor);

    const res2 = await request(app)
      .get('/api/transactions?group_id=' + groupId + '&limit=150')
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    assert.strictEqual(res2.body.pagination.limit, 100); // Capped at 100
  });

  it('returns 400 for non-numeric limit', async () => {
    const res = await request(app)
      .get('/api/transactions?group_id=' + groupId + '&limit=abc')
      .set('Authorization', `Bearer ${token1}`)
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
    assert.match(res.body.error.message, /limit.*positive integer/);
  });

  it('returns 400 for limit less than 1', async () => {
    const res = await request(app)
      .get('/api/transactions?group_id=' + groupId + '&limit=0')
      .set('Authorization', `Bearer ${token1}`)
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
    assert.match(res.body.error.message, /at least 1/);
  });

  it('supports pagination with cursor', async () => {
    if (transactionDataSource.addTransaction) {
      const tx1 = mockTransaction({
        id: 'tx-1',
        timestamp: new Date('2026-01-01T10:00:00.000Z'),
      });
      const tx2 = mockTransaction({
        id: 'tx-2',
        timestamp: new Date('2026-01-01T11:00:00.000Z'),
      });
      const tx3 = mockTransaction({
        id: 'tx-3',
        timestamp: new Date('2026-01-01T12:00:00.000Z'),
      });

      await transactionDataSource.addTransaction(tx1);
      await transactionDataSource.addTransaction(tx2);
      await transactionDataSource.addTransaction(tx3);
    }

    // First page
    const res1 = await request(app)
      .get('/api/transactions?group_id=' + groupId + '&limit=1')
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    assert.strictEqual(res1.body.data.length, 1);
    assert.strictEqual(res1.body.pagination.hasMore, true);
    const nextCursor = res1.body.pagination.nextCursor;

    // Second page
    const res2 = await request(app)
      .get('/api/transactions?group_id=' + groupId + '&limit=1&cursor=' + nextCursor)
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    assert.strictEqual(res2.body.data.length, 1);
    assert.strictEqual(res2.body.pagination.hasMore, true);
  });

  it('composes multiple filters (group + member + order)', async () => {
    if (transactionDataSource.addTransaction) {
      await transactionDataSource.addTransaction(
        mockTransaction({
          id: 'tx-1',
          membersInvolved: [creator1],
          timestamp: new Date('2026-01-01T10:00:00.000Z'),
        })
      );

      await transactionDataSource.addTransaction(
        mockTransaction({
          id: 'tx-2',
          membersInvolved: [creator1],
          timestamp: new Date('2026-01-01T12:00:00.000Z'),
        })
      );

      await transactionDataSource.addTransaction(
        mockTransaction({
          id: 'tx-3',
          membersInvolved: [creator2],
          timestamp: new Date('2026-01-01T11:00:00.000Z'),
        })
      );
    }

    const res = await request(app)
      .get(`/api/transactions?group_id=${groupId}&member=${creator1}&order=asc&limit=50`)
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    assert.strictEqual(res.body.data.length, 2);
    assert.ok(
      res.body.data.every((tx: { membersInvolved: string[] }) => {
        return tx.membersInvolved.includes(creator1);
      })
    );
    assert.strictEqual(res.body.data[0].id, 'tx-1'); // Ascending order
    assert.strictEqual(res.body.data[1].id, 'tx-2');
  });

  it('includes required transaction fields in response', async () => {
    if (transactionDataSource.addTransaction) {
      await transactionDataSource.addTransaction(
        mockTransaction({
          id: 'tx-123',
          groupId: groupId,
          amount: '5000000',
          asset: 'native',
          timestamp: new Date('2026-01-15T15:30:00.000Z'),
          membersInvolved: [creator1, creator2],
          txHash: 'hash123abc',
        })
      );
    }

    const res = await request(app)
      .get('/api/transactions?group_id=' + groupId)
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    assert.strictEqual(res.body.data.length, 1);
    const tx = res.body.data[0];

    assert.ok(tx.id);
    assert.strictEqual(tx.groupId, groupId);
    assert.strictEqual(tx.amount, '5000000');
    assert.strictEqual(tx.asset, 'native');
    assert.ok(tx.timestamp);
    assert.deepStrictEqual(tx.membersInvolved, [creator1, creator2]);
    assert.strictEqual(tx.txHash, 'hash123abc');
  });

  it('includes pagination metadata in response', async () => {
    const res = await request(app)
      .get('/api/transactions?group_id=' + groupId)
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    assert.ok(res.body.pagination);
    assert.strictEqual(typeof res.body.pagination.limit, 'number');
    assert.strictEqual(typeof res.body.pagination.hasMore, 'boolean');
  });
});

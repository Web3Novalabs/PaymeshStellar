/**
 * Requires a live PostgreSQL instance pointed to by DATABASE_URL. Skipped
 * automatically when it isn't set, matching db/__tests__/migrations.test.ts.
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../db/index.js';
import { applyMigrations } from '../../db/__tests__/migrationHelper.js';
import { loadCursor, saveCursor } from '../indexerCursor.js';

const skipReason: string | false = process.env.DATABASE_URL ? false : 'DATABASE_URL not configured';

describe('indexerCursor', { skip: skipReason }, () => {
  before(async () => {
    await applyMigrations(pool, 'down');
    await applyMigrations(pool, 'up');
  });

  after(async () => {
    await applyMigrations(pool, 'down');
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM indexer_cursor');
  });

  it('loadCursor returns null when no row exists for the contract (cold start)', async () => {
    const cursor = await loadCursor('CONTRACT_NEW');
    assert.strictEqual(cursor, null);
  });

  it('saveCursor inside a transaction inserts a new row, visible after commit', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await saveCursor(client, 'CONTRACT_X', 500, 'paging-token-1');
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    const cursor = await loadCursor('CONTRACT_X');
    assert.ok(cursor);
    assert.strictEqual(cursor?.contractId, 'CONTRACT_X');
    assert.strictEqual(cursor?.lastLedger, 500);
    assert.strictEqual(cursor?.pagingToken, 'paging-token-1');
    assert.ok(cursor?.updatedAt instanceof Date);
  });

  it('a saveCursor whose transaction rolls back leaves no row behind', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await saveCursor(client, 'CONTRACT_ROLLBACK', 999, 'token-rolled-back');
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    const cursor = await loadCursor('CONTRACT_ROLLBACK');
    assert.strictEqual(cursor, null);
  });

  it('saveCursor upserts — a second call for the same contract updates in place', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await saveCursor(client, 'CONTRACT_Y', 100, 'token-a');
      await client.query('COMMIT');

      await client.query('BEGIN');
      await saveCursor(client, 'CONTRACT_Y', 250, 'token-b');
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    const cursor = await loadCursor('CONTRACT_Y');
    assert.strictEqual(cursor?.lastLedger, 250);
    assert.strictEqual(cursor?.pagingToken, 'token-b');

    const res = await pool.query(
      'SELECT COUNT(*)::int AS count FROM indexer_cursor WHERE contract_id = $1',
      ['CONTRACT_Y']
    );
    assert.strictEqual(
      res.rows[0].count,
      1,
      'expected exactly one row per contract id, not a new one per save'
    );
  });

  it('saveCursor bumps updated_at on every write', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await saveCursor(client, 'CONTRACT_Z', 1, 'token-1');
      await client.query('COMMIT');
      const first = await loadCursor('CONTRACT_Z');

      await new Promise((resolve) => setTimeout(resolve, 10));

      await client.query('BEGIN');
      await saveCursor(client, 'CONTRACT_Z', 2, 'token-2');
      await client.query('COMMIT');
      const second = await loadCursor('CONTRACT_Z');

      assert.ok(first);
      assert.ok(second);
      assert.ok(second!.updatedAt.getTime() >= first!.updatedAt.getTime());
    } finally {
      client.release();
    }
  });

  it('tracks independent cursors for different contract ids', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await saveCursor(client, 'CONTRACT_ONE', 10, 'tok-one');
      await saveCursor(client, 'CONTRACT_TWO', 20, 'tok-two');
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    const one = await loadCursor('CONTRACT_ONE');
    const two = await loadCursor('CONTRACT_TWO');
    assert.strictEqual(one?.lastLedger, 10);
    assert.strictEqual(two?.lastLedger, 20);
  });
});

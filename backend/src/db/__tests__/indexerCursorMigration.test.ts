/**
 * Migration 005 (indexer_cursor) smoke + round-trip tests, run against the
 * project's real migration files via migrationHelper.ts rather than an
 * inlined copy of the SQL.
 *
 * Requires a live PostgreSQL instance pointed to by DATABASE_URL. Skipped
 * automatically when it isn't set, matching migrations.test.ts.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import type { QueryResultRow } from 'pg';
import { applyMigrations, listMigrationFiles } from './migrationHelper.js';

async function tableExists(pool: Pool, tableName: string): Promise<boolean> {
  interface Row extends QueryResultRow {
    exists: boolean;
  }
  const res = await pool.query<Row>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [tableName]
  );
  return res.rows[0]?.exists ?? false;
}

async function indexExists(pool: Pool, indexName: string): Promise<boolean> {
  interface Row extends QueryResultRow {
    exists: boolean;
  }
  const res = await pool.query<Row>(
    `SELECT EXISTS (
       SELECT 1 FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = $1
     ) AS exists`,
    [indexName]
  );
  return res.rows[0]?.exists ?? false;
}

async function columnInfo(
  pool: Pool,
  table: string,
  column: string
): Promise<{ is_nullable: string; data_type: string } | null> {
  interface Row extends QueryResultRow {
    is_nullable: string;
    data_type: string;
  }
  const res = await pool.query<Row>(
    `SELECT is_nullable, data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return res.rows[0] ?? null;
}

const skipReason: string | false = process.env.DATABASE_URL ? false : 'DATABASE_URL not configured';

describe('Migration 005 — indexer_cursor', { skip: skipReason }, () => {
  let pool!: Pool;

  before(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await applyMigrations(pool, 'down');
  });

  after(async () => {
    await applyMigrations(pool, 'down');
    await pool.end();
  });

  it('numbers exactly one migration pair as 005, following the existing 001-004 sequence', () => {
    const up = listMigrationFiles('up');
    const has005 = up.some((f) => f.startsWith('005_'));
    assert.ok(has005, `expected a 005_*_up.sql migration, found: ${up.join(', ')}`);
    assert.strictEqual(up.filter((f) => f.startsWith('005_')).length, 1);
  });

  it('applies cleanly on top of 001-004 — indexer_cursor table and index exist', async () => {
    await applyMigrations(pool, 'up');

    assert.ok(await tableExists(pool, 'indexer_cursor'), 'indexer_cursor table missing');
    assert.ok(
      await indexExists(pool, 'idx_indexer_cursor_updated_at'),
      'idx_indexer_cursor_updated_at missing'
    );
  });

  it('contract_id is the primary key (one row per contract)', async () => {
    await pool.query(
      "INSERT INTO indexer_cursor (contract_id, last_ledger, paging_token) VALUES ('CONTRACT_A', 100, 'tok-1')"
    );

    await assert.rejects(
      () =>
        pool.query(
          "INSERT INTO indexer_cursor (contract_id, last_ledger, paging_token) VALUES ('CONTRACT_A', 200, 'tok-2')"
        ),
      /duplicate key|unique/i
    );

    await pool.query("DELETE FROM indexer_cursor WHERE contract_id = 'CONTRACT_A'");
  });

  it('last_ledger is NOT NULL and paging_token is nullable (cold-start rows have no token yet)', async () => {
    const lastLedgerCol = await columnInfo(pool, 'indexer_cursor', 'last_ledger');
    const pagingTokenCol = await columnInfo(pool, 'indexer_cursor', 'paging_token');

    assert.strictEqual(lastLedgerCol?.is_nullable, 'NO');
    assert.strictEqual(pagingTokenCol?.is_nullable, 'YES');

    await assert.rejects(
      () =>
        pool.query(
          "INSERT INTO indexer_cursor (contract_id, paging_token) VALUES ('CONTRACT_B', 'tok')"
        ),
      /null value|not-null/i
    );
  });

  it('supports multiple rows, one per contract id', async () => {
    await pool.query(
      "INSERT INTO indexer_cursor (contract_id, last_ledger) VALUES ('CONTRACT_C', 10)"
    );
    await pool.query(
      "INSERT INTO indexer_cursor (contract_id, last_ledger) VALUES ('CONTRACT_D', 20)"
    );

    const res = await pool.query(
      'SELECT contract_id, last_ledger FROM indexer_cursor ORDER BY contract_id'
    );
    const rows = res.rows.map((r: { contract_id: string; last_ledger: string }) => ({
      contract_id: r.contract_id,
      last_ledger: Number(r.last_ledger),
    }));
    assert.deepStrictEqual(rows, [
      { contract_id: 'CONTRACT_C', last_ledger: 10 },
      { contract_id: 'CONTRACT_D', last_ledger: 20 },
    ]);
  });

  it('down migration drops indexer_cursor and its index, restoring prior schema exactly', async () => {
    await applyMigrations(pool, 'down');

    assert.ok(
      !(await tableExists(pool, 'indexer_cursor')),
      'indexer_cursor still exists after down'
    );
    assert.ok(
      !(await indexExists(pool, 'idx_indexer_cursor_updated_at')),
      'idx_indexer_cursor_updated_at still exists after down'
    );

    // The tables from earlier migrations must be untouched by 005's down migration.
    assert.ok(
      await tableExists(pool, 'transactions'),
      'transactions table was dropped by 005 down'
    );
    assert.ok(await tableExists(pool, 'groups'), 'groups table was dropped by 005 down');
    assert.ok(
      await tableExists(pool, 'idempotency_keys'),
      'idempotency_keys table was dropped by 005 down'
    );
  });

  it('is re-appliable — up, down, up again leaves the same schema with no leftover state', async () => {
    await applyMigrations(pool, 'up');
    assert.ok(await tableExists(pool, 'indexer_cursor'));

    await applyMigrations(pool, 'down');
    assert.ok(!(await tableExists(pool, 'indexer_cursor')));

    await applyMigrations(pool, 'up');
    assert.ok(await tableExists(pool, 'indexer_cursor'));

    const res = await pool.query('SELECT COUNT(*)::int AS count FROM indexer_cursor');
    assert.strictEqual(
      res.rows[0].count,
      0,
      'expected a clean table with no rows after a fresh up'
    );
  });
});

/**
 * Migration smoke tests + constraint tests.
 *
 * Requires a live PostgreSQL instance pointed to by DATABASE_URL.
 * All tests are skipped automatically when DATABASE_URL is not set so the
 * suite stays green in environments without a database.
 *
 * Run against a real DB:
 *   DATABASE_URL=postgres://... pnpm --filter backend test
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import type { QueryResultRow } from 'pg';

// ---------------------------------------------------------------------------
// SQL — same statements as the migration files, inlined for test isolation.
// ---------------------------------------------------------------------------

const UP_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(64)  UNIQUE NOT NULL,
  name           VARCHAR(255) NOT NULL,
  email          VARCHAR(255),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users (wallet_address);

CREATE TABLE IF NOT EXISTS groups (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id       UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name             VARCHAR(255) NOT NULL,
  token            VARCHAR(64)  NOT NULL,
  onchain_group_id VARCHAR(128) UNIQUE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_groups_creator_id ON groups (creator_id);

CREATE TABLE IF NOT EXISTS members (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id       UUID          NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  member_address VARCHAR(64)   NOT NULL,
  percentage     NUMERIC(7, 4) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  joined_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_members_group_id       ON members (group_id);
CREATE INDEX IF NOT EXISTS idx_members_member_address ON members (member_address);

CREATE TABLE IF NOT EXISTS transactions (
  id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID          NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  amount     NUMERIC(30,7) NOT NULL,
  asset      VARCHAR(64)   NOT NULL,
  timestamp  TIMESTAMPTZ   NOT NULL,
  tx_hash    VARCHAR(128)  UNIQUE NOT NULL,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transactions_group_id  ON transactions (group_id);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions (timestamp);
`;

const DOWN_SQL = `
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS members;
DROP TABLE IF EXISTS groups;
DROP TABLE IF EXISTS users;
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Skip when no DB is available.
// ---------------------------------------------------------------------------

const skipReason: string | false = process.env.DATABASE_URL ? false : 'DATABASE_URL not configured';

// ---------------------------------------------------------------------------
// Migration smoke tests
// ---------------------------------------------------------------------------

describe('Migration smoke tests', { skip: skipReason }, () => {
  let pool!: Pool; // assigned in before()

  before(() => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  after(async () => {
    await pool.end();
  });

  it('applies UP migration — all tables created', async () => {
    await pool.query(UP_SQL);

    assert.ok(await tableExists(pool, 'users'), 'users table missing');
    assert.ok(await tableExists(pool, 'groups'), 'groups table missing');
    assert.ok(await tableExists(pool, 'members'), 'members table missing');
    assert.ok(await tableExists(pool, 'transactions'), 'transactions table missing');
  });

  it('UP migration — expected indexes exist', async () => {
    assert.ok(await indexExists(pool, 'idx_users_wallet_address'), 'idx_users_wallet_address');
    assert.ok(await indexExists(pool, 'idx_groups_creator_id'), 'idx_groups_creator_id');
    assert.ok(await indexExists(pool, 'idx_members_group_id'), 'idx_members_group_id');
    assert.ok(await indexExists(pool, 'idx_members_member_address'), 'idx_members_member_address');
    assert.ok(await indexExists(pool, 'idx_transactions_group_id'), 'idx_transactions_group_id');
    assert.ok(await indexExists(pool, 'idx_transactions_timestamp'), 'idx_transactions_timestamp');
  });

  it('applies DOWN migration — all tables dropped', async () => {
    await pool.query(DOWN_SQL);

    assert.ok(!(await tableExists(pool, 'transactions')), 'transactions still exists');
    assert.ok(!(await tableExists(pool, 'members')), 'members still exists');
    assert.ok(!(await tableExists(pool, 'groups')), 'groups still exists');
    assert.ok(!(await tableExists(pool, 'users')), 'users still exists');
  });
});

// ---------------------------------------------------------------------------
// Constraint tests
// ---------------------------------------------------------------------------

describe('Constraint tests', { skip: skipReason }, () => {
  let pool!: Pool; // assigned in before()

  before(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(DOWN_SQL);
    await pool.query(UP_SQL);
  });

  after(async () => {
    await pool.query(DOWN_SQL);
    await pool.end();
  });

  it('rejects duplicate wallet_address on users', async () => {
    await pool.query(
      `INSERT INTO users (wallet_address, name)
       VALUES ('GADDR1111111111111111111111111111111111111111111111111', 'Alice')`
    );

    await assert.rejects(
      () =>
        pool.query(
          `INSERT INTO users (wallet_address, name)
           VALUES ('GADDR1111111111111111111111111111111111111111111111111', 'Alice2')`
        ),
      /unique/i,
      'Expected unique constraint violation on wallet_address'
    );
  });

  it('rejects out-of-range percentage on members', async () => {
    interface UserRow extends QueryResultRow {
      id: string;
    }
    const userRes = await pool.query<UserRow>(
      `INSERT INTO users (wallet_address, name)
       VALUES ('GADDR2222222222222222222222222222222222222222222222222', 'Bob') RETURNING id`
    );
    const userId = userRes.rows[0]?.id as string;

    interface GroupRow extends QueryResultRow {
      id: string;
    }
    const groupRes = await pool.query<GroupRow>(
      "INSERT INTO groups (creator_id, name, token) VALUES ($1, 'Test Group', 'XLM') RETURNING id",
      [userId]
    );
    const groupId = groupRes.rows[0]?.id as string;

    await assert.rejects(
      () =>
        pool.query(
          "INSERT INTO members (group_id, member_address, percentage) VALUES ($1, 'GADDR000', 0)",
          [groupId]
        ),
      /check/i,
      'Expected check constraint violation for percentage = 0'
    );

    await assert.rejects(
      () =>
        pool.query(
          `INSERT INTO members (group_id, member_address, percentage)
           VALUES ($1, 'GADDR000', 101)`,
          [groupId]
        ),
      /check/i,
      'Expected check constraint violation for percentage = 101'
    );
  });

  it('rejects duplicate tx_hash on transactions', async () => {
    interface UserRow extends QueryResultRow {
      id: string;
    }
    const userRes = await pool.query<UserRow>(
      `INSERT INTO users (wallet_address, name)
       VALUES ('GADDR3333333333333333333333333333333333333333333333333', 'Carol') RETURNING id`
    );
    const userId = userRes.rows[0]?.id as string;

    interface GroupRow extends QueryResultRow {
      id: string;
    }
    const groupRes = await pool.query<GroupRow>(
      "INSERT INTO groups (creator_id, name, token) VALUES ($1, 'Tx Group', 'USDC') RETURNING id",
      [userId]
    );
    const groupId = groupRes.rows[0]?.id as string;

    await pool.query(
      `INSERT INTO transactions (group_id, amount, asset, timestamp, tx_hash)
       VALUES ($1, 1000, 'XLM', NOW(), 'hash_abc123')`,
      [groupId]
    );

    await assert.rejects(
      () =>
        pool.query(
          `INSERT INTO transactions (group_id, amount, asset, timestamp, tx_hash)
           VALUES ($1, 2000, 'XLM', NOW(), 'hash_abc123')`,
          [groupId]
        ),
      /unique/i,
      'Expected unique constraint violation on tx_hash'
    );
  });

  it('rejects FK violation — group_id references non-existent group', async () => {
    await assert.rejects(
      () =>
        pool.query(
          `INSERT INTO members (group_id, member_address, percentage)
           VALUES ('00000000-0000-0000-0000-000000000000', 'GADDR000', 50)`
        ),
      /foreign key/i,
      'Expected foreign key constraint violation'
    );
  });
});

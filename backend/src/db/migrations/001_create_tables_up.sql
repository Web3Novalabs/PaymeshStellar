-- Migration 001 UP: create users, groups, members, transactions tables
-- Requires PostgreSQL 13+ for gen_random_uuid().

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

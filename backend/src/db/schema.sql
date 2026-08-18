-- =============================================================================
-- PaymeshStellar — canonical off-chain PostgreSQL schema (reference)
-- Run via migrations in src/db/migrations/.
-- Requires PostgreSQL 13+ (gen_random_uuid() built-in).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(64)  UNIQUE NOT NULL,
  name           VARCHAR(255) NOT NULL,
  email          VARCHAR(255),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Explicit index on the most-filtered column (UNIQUE already creates one;
-- kept here for documentation clarity).
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users (wallet_address);

-- ---------------------------------------------------------------------------
-- groups
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- members
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS members (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id       UUID           NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  member_address VARCHAR(64)    NOT NULL,
  percentage     NUMERIC(7, 4)  NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  joined_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_members_group_id       ON members (group_id);
CREATE INDEX IF NOT EXISTS idx_members_member_address ON members (member_address);

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
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

-- Authentication tables are defined in 002_auth_sessions_up.sql. Refresh
-- tokens are never stored directly; token_hash contains their SHA-256 digest.
CREATE TABLE IF NOT EXISTS auth_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce_hash BYTEA UNIQUE NOT NULL,
  nonce TEXT NOT NULL,
  wallet_address VARCHAR(64) NOT NULL,
  transaction_xdr TEXT NOT NULL,
  transaction_hash BYTEA NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_challenges_expires_at ON auth_challenges (expires_at);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL,
  public_key VARCHAR(64) NOT NULL,
  token_hash BYTEA UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  rotated_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  replaced_by UUID REFERENCES auth_sessions (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_family_id ON auth_sessions (family_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_public_key ON auth_sessions (public_key);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions (expires_at);

CREATE TABLE IF NOT EXISTS auth_security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  family_id UUID,
  public_key VARCHAR(64),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_security_events_created_at ON auth_security_events (created_at);

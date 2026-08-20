-- =============================================================================
-- Migration: 003_reconciliation_and_idempotency
-- Adds tables for idempotency keys and reconciliation drift reports
-- =============================================================================

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) NOT NULL UNIQUE,
  fingerprint TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at ON idempotency_keys (expires_at);

CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  groups_scanned INTEGER NOT NULL,
  drift_counts JSONB NOT NULL,
  report JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

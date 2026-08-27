-- =============================================================================
-- Migration: 005_create_indexer_cursor
-- Tracks per-contract on-chain event indexing progress (last processed ledger
-- and RPC paging token) so the indexer worker and backfill CLI can resume
-- without losing or duplicating work across restarts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS indexer_cursor (
  contract_id  VARCHAR(64)  PRIMARY KEY,
  last_ledger  BIGINT       NOT NULL,
  paging_token TEXT,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_indexer_cursor_updated_at ON indexer_cursor (updated_at);

-- =============================================================================
-- Migration: 003_reconciliation_and_idempotency (Down)
-- =============================================================================

DROP TABLE IF EXISTS reconciliation_runs;
DROP TABLE IF EXISTS idempotency_keys;

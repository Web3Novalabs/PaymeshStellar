-- =============================================================================
-- Migration: 003_reconciliation
-- Adds tables for reconciliation drift reports
-- =============================================================================

CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  groups_scanned INTEGER NOT NULL,
  drift_counts JSONB NOT NULL,
  report JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

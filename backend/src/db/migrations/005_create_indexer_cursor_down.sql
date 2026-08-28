-- =============================================================================
-- Down Migration: 005_create_indexer_cursor
-- =============================================================================

DROP INDEX IF EXISTS idx_indexer_cursor_updated_at;
DROP TABLE IF EXISTS indexer_cursor;

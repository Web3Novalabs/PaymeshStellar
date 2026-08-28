import type { PoolClient, QueryResultRow } from 'pg';
import { query } from '../db/index.js';

export interface IndexerCursorRow {
  contractId: string;
  lastLedger: number;
  pagingToken: string | null;
  updatedAt: Date;
}

interface CursorSqlRow extends QueryResultRow {
  contract_id: string;
  last_ledger: string;
  paging_token: string | null;
  updated_at: Date;
}

/** Reads the persisted cursor for a contract. Used outside a transaction to decide what to request next. */
export async function loadCursor(contractId: string): Promise<IndexerCursorRow | null> {
  const res = await query<CursorSqlRow>(
    'SELECT contract_id, last_ledger, paging_token, updated_at FROM indexer_cursor WHERE contract_id = $1',
    [contractId]
  );
  const row = res.rows[0];
  if (!row) return null;

  return {
    contractId: row.contract_id,
    lastLedger: Number(row.last_ledger),
    pagingToken: row.paging_token,
    updatedAt: row.updated_at,
  };
}

/**
 * Upserts the cursor as part of an already-open transaction. Callers must
 * commit this in the same transaction as the rows the cursor covers — see
 * processEventBatch — so a crash between the two can never happen.
 */
export async function saveCursor(
  client: PoolClient,
  contractId: string,
  lastLedger: number,
  pagingToken: string
): Promise<void> {
  await client.query(
    `INSERT INTO indexer_cursor (contract_id, last_ledger, paging_token, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (contract_id)
     DO UPDATE SET last_ledger = EXCLUDED.last_ledger,
                   paging_token = EXCLUDED.paging_token,
                   updated_at = NOW()`,
    [contractId, lastLedger, pagingToken]
  );
}

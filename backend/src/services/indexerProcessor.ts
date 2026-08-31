/**
 * The single decode-and-persist path shared by the live indexer worker
 * (src/workers/indexer.ts) and the backfill CLI (src/workers/backfill.ts).
 * Neither caller talks to Postgres or the event decoder directly — both
 * just hand this module a page of raw RPC events and a cursor position.
 */

import type { PoolClient, QueryResultRow } from 'pg';
import type { Logger } from 'pino';
import { pool } from '../db/index.js';
import { bpsToPercent } from '../utils/math.js';
import { IndexerEvent } from './sorobanRpcClient.js';
import { decodeIndexerEvent, DecodedIndexerEvent, SkippedEvent } from './eventDecoder.js';
import { ChainReader } from './contractReader.js';
import { saveCursor } from './indexerCursor.js';

export interface ProcessBatchParams {
  contractId: string;
  events: IndexerEvent[];
  chainReader: ChainReader;
  /** Cursor to persist atomically with this batch's rows once every event has been applied (or skipped). */
  cursor: { lastLedger: number; pagingToken: string };
  logger: Logger;
  /**
   * Whether to write `cursor` into indexer_cursor as part of this batch's
   * transaction. Defaults to true for the live worker's resumable polling.
   * The backfill CLI passes false: its progress is defined by its explicit
   * --from/--to range on every run, not a stored cursor, so persisting one
   * would just leave a phantom row nothing ever reads back.
   */
  persistCursor?: boolean;
}

export interface ProcessBatchResult {
  processed: number;
  persisted: number;
  skipped: number;
  skippedDetails: SkippedEvent[];
}

interface GroupIdRow extends QueryResultRow {
  id: string;
  token: string;
}

/**
 * Applies one decoded batch of events and commits the new cursor position in
 * the same Postgres transaction as the rows it covers. If nothing throws
 * past the per-event savepoint boundary below, the transaction commits or
 * rolls back as a single unit — a crash anywhere in between leaves either
 * the prior committed state or this batch's full state, never a partial mix
 * of "cursor moved but rows missing" or "rows written but cursor stale".
 */
export async function processEventBatch(params: ProcessBatchParams): Promise<ProcessBatchResult> {
  const { contractId, events, chainReader, cursor, logger, persistCursor = true } = params;
  const client = await pool.connect();
  let persisted = 0;
  let skipped = 0;
  const skippedDetails: SkippedEvent[] = [];

  try {
    await client.query('BEGIN');

    for (const raw of events) {
      const decoded = decodeIndexerEvent(raw);

      if (decoded.status === 'skipped') {
        skipped++;
        skippedDetails.push(decoded.skipped);
        logger.warn({ skipped: decoded.skipped }, 'indexer: skipping event');
        continue;
      }

      await client.query('SAVEPOINT evt');
      try {
        await applyEvent(client, chainReader, decoded.event);
        await client.query('RELEASE SAVEPOINT evt');
        persisted++;
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT evt');
        skipped++;
        const reason = err instanceof Error ? err.message : String(err);
        const detail: SkippedEvent = {
          eventId: decoded.event.eventId,
          ledger: decoded.event.ledger,
          eventName: decoded.event.kind,
          reason: `apply failed: ${reason}`,
        };
        skippedDetails.push(detail);
        logger.warn({ skipped: detail }, 'indexer: failed to apply event, skipping');
      }
    }

    if (persistCursor) {
      await saveCursor(client, contractId, cursor.lastLedger, cursor.pagingToken);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }

  logger.info(
    {
      ledger: cursor.lastLedger,
      cursor: cursor.pagingToken,
      eventCount: events.length,
      persisted,
      skipped,
    },
    'indexer: batch committed'
  );

  return { processed: events.length, persisted, skipped, skippedDetails };
}

async function applyEvent(
  client: PoolClient,
  chainReader: ChainReader,
  event: DecodedIndexerEvent
): Promise<void> {
  switch (event.kind) {
    case 'created':
    case 'members_updated':
      await upsertGroupFromChain(client, chainReader, event.groupIdHex);
      return;
    case 'distributed':
      await insertDistribution(
        client,
        event.groupIdHex,
        event.amount,
        event.txHash,
        event.ledgerClosedAt
      );
      return;
  }

  // Exhaustiveness guard — DecodedIndexerEvent is a closed union of the three kinds above.
  const unreachable: never = event;
  throw new Error(`Unhandled decoded event kind: ${JSON.stringify(unreachable)}`);
}

/**
 * `created` and `members_updated` events don't carry a group's full state
 * (member_count / creator alone can't populate the groups/members tables),
 * so both re-read the group directly from contract storage and upsert it.
 * Re-fetching is what makes members_updated (and a duplicate created)
 * correct without a second, event-payload-driven code path.
 */
async function upsertGroupFromChain(
  client: PoolClient,
  chainReader: ChainReader,
  groupIdHex: string
): Promise<void> {
  const chainGroup = await chainReader.getGroup(groupIdHex);
  if (!chainGroup) {
    throw new Error(
      `group ${groupIdHex} not found in contract storage (event likely stale/reorged)`
    );
  }

  const userRes = await client.query<{ id: string }>(
    `INSERT INTO users (wallet_address, name)
     VALUES ($1, $1)
     ON CONFLICT (wallet_address) DO UPDATE SET wallet_address = EXCLUDED.wallet_address
     RETURNING id`,
    [chainGroup.creator]
  );
  const creatorId = userRes.rows[0]?.id;
  if (!creatorId) throw new Error(`failed to upsert creator user for group ${groupIdHex}`);

  const groupRes = await client.query<{ id: string }>(
    `INSERT INTO groups (creator_id, name, token, onchain_group_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (onchain_group_id)
     DO UPDATE SET name = EXCLUDED.name, token = EXCLUDED.token, updated_at = NOW()
     RETURNING id`,
    [creatorId, chainGroup.name, chainGroup.token, chainGroup.id]
  );
  const internalGroupId = groupRes.rows[0]?.id;
  if (!internalGroupId) throw new Error(`failed to upsert group ${groupIdHex}`);

  await client.query('DELETE FROM members WHERE group_id = $1', [internalGroupId]);
  for (const member of chainGroup.members) {
    await client.query(
      'INSERT INTO members (group_id, member_address, percentage) VALUES ($1, $2, $3)',
      [internalGroupId, member.address, parseFloat(bpsToPercent(member.shareBps))]
    );
  }
}

async function insertDistribution(
  client: PoolClient,
  groupIdHex: string,
  amount: bigint,
  txHash: string,
  ledgerClosedAt: string
): Promise<void> {
  const groupRes = await client.query<GroupIdRow>(
    'SELECT id, token FROM groups WHERE onchain_group_id = $1',
    [groupIdHex]
  );
  const group = groupRes.rows[0];
  if (!group) {
    throw new Error(
      `group ${groupIdHex} not indexed yet — distributed event has no parent group row`
    );
  }

  await client.query(
    `INSERT INTO transactions (group_id, amount, asset, timestamp, tx_hash)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (tx_hash) DO NOTHING`,
    [group.id, amount.toString(), group.token, new Date(ledgerClosedAt), txHash]
  );
}

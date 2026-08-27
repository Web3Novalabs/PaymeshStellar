/**
 * Backfill CLI — replays a specific, already-known ledger range through the
 * exact same decode-and-persist path the live worker uses
 * (processEventBatch), so operators can re-derive history (e.g. after
 * discovering a gap, or seeding a fresh database) without a second
 * implementation of event decoding.
 *
 * Usage (after `pnpm build`):
 *   node dist/workers/backfill.js --from <ledger> --to <ledger>
 *
 * Backfill never reads or writes the live indexer_cursor row — its progress
 * is defined entirely by the --from/--to range given on each invocation, so
 * running it twice over the same range is safe and idempotent (ON CONFLICT
 * DO NOTHING on transactions.tx_hash) rather than "resumed".
 */

import dotenv from 'dotenv';
import minimist from 'minimist';
import { fileURLToPath } from 'node:url';
import { logger } from '../middleware/logger.js';
import { indexerConfig } from '../config/indexer.js';
import { RpcSorobanEventsClient, type SorobanEventsClient } from '../services/sorobanRpcClient.js';
import { SorobanChainReader, type ChainReader } from '../services/contractReader.js';
import { processEventBatch, type ProcessBatchResult } from '../services/indexerProcessor.js';

dotenv.config();

export interface BackfillOptions {
  client?: SorobanEventsClient;
  chainReader?: ChainReader;
  contractId?: string;
  pageLimit?: number;
}

export interface BackfillSummary {
  fromLedger: number;
  toLedger: number;
  pages: number;
  eventsSeen: number;
  persisted: number;
  skipped: number;
}

/**
 * Pages ledger-range getEvents calls from `fromLedger` to `toLedger`
 * inclusive, applying every page through processEventBatch with
 * persistCursor: false. Exported so tests can drive it against a scripted
 * fake client without a real RPC endpoint or a spawned process.
 */
export async function runBackfill(fromLedger: number, toLedger: number, options: BackfillOptions = {}): Promise<BackfillSummary> {
  if (!Number.isInteger(fromLedger) || !Number.isInteger(toLedger) || fromLedger < 0 || toLedger < fromLedger) {
    throw new Error(`Invalid ledger range: --from ${fromLedger} --to ${toLedger}`);
  }

  const config = indexerConfig();
  const contractId = options.contractId ?? config.contractId;
  const pageLimit = options.pageLimit ?? config.pageLimit;
  const client = options.client ?? new RpcSorobanEventsClient(config.rpcUrl);
  const chainReader = options.chainReader ?? new SorobanChainReader(config.rpcUrl, contractId, client);

  let cursorLedger = fromLedger;
  let pages = 0;
  let eventsSeen = 0;
  let persisted = 0;
  let skipped = 0;

  while (cursorLedger <= toLedger) {
    const page = await client.getEvents({
      contractId,
      from: { type: 'ledger', ledger: cursorLedger },
      endLedger: toLedger,
      limit: pageLimit,
    });

    pages++;
    eventsSeen += page.events.length;

    if (page.events.length > 0) {
      const result: ProcessBatchResult = await processEventBatch({
        contractId,
        events: page.events,
        chainReader,
        cursor: { lastLedger: page.events[page.events.length - 1].ledger, pagingToken: page.cursor },
        logger,
        persistCursor: false,
      });
      persisted += result.persisted;
      skipped += result.skipped;
    }

    logger.info(
      { contractId, fromLedger: cursorLedger, toLedger, pageEvents: page.events.length },
      'backfill: page processed'
    );

    if (page.events.length < pageLimit) {
      // Fewer events than the page limit means there's nothing left in [cursorLedger, toLedger].
      break;
    }

    const nextCursorLedger = page.events[page.events.length - 1].ledger + 1;
    if (nextCursorLedger <= cursorLedger) {
      // Defensive: a misbehaving RPC/fake returning a full page that makes no forward progress
      // would otherwise spin forever.
      throw new Error(`backfill made no forward progress at ledger ${cursorLedger}`);
    }
    cursorLedger = nextCursorLedger;
  }

  return { fromLedger, toLedger, pages, eventsSeen, persisted, skipped };
}

function parseLedgerArg(name: string, value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`--${name} must be a non-negative integer ledger sequence`);
  }
  return n;
}

async function main(): Promise<void> {
  const argv = minimist(process.argv.slice(2));
  const fromLedger = parseLedgerArg('from', argv.from);
  const toLedger = parseLedgerArg('to', argv.to);

  logger.info({ fromLedger, toLedger }, 'backfill: starting');

  const summary = await runBackfill(fromLedger, toLedger);

  logger.info(summary, 'backfill: complete');
}

const isMainModule = Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  main().catch((err: unknown) => {
    logger.error({ err: err instanceof Error ? { message: err.message, stack: err.stack } : String(err) }, 'backfill: fatal error');
    process.exit(1);
  });
}

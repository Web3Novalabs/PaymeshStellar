/**
 * Long-running worker that polls Soroban RPC for "autoshare" contract
 * events and persists them. Run via `pnpm backend:indexer` (after build:
 * `node dist/workers/indexer.js`).
 *
 * The poll loop itself (runIndexerLoop) is exported so tests can drive it
 * directly against injected fakes — a scripted SorobanEventsClient and an
 * in-memory-friendly ChainReader — without spawning a real process or
 * talking to a real RPC endpoint. Only `main()` below wires up the real RPC
 * client, real chain reader, and OS signal handling.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { logger } from '../middleware/logger.js';
import { indexerConfig } from '../config/indexer.js';
import {
  RpcSorobanEventsClient,
  LedgerRetentionError,
  type SorobanEventsClient,
  type EventsFrom,
  type EventPage,
} from '../services/sorobanRpcClient.js';
import { SorobanChainReader, type ChainReader } from '../services/contractReader.js';
import { loadCursor } from '../services/indexerCursor.js';
import { processEventBatch } from '../services/indexerProcessor.js';

dotenv.config();

export interface RunIndexerOptions {
  client?: SorobanEventsClient;
  chainReader?: ChainReader;
  /** Checked at the top of every loop iteration; the loop exits once this returns true. */
  shouldStop?: () => boolean;
  /** Replaces the real timer between idle polls — tests inject a fast/no-op version. */
  sleep?: (ms: number) => Promise<void>;
  /** Caps how many iterations run, as a hard backstop for tests that forget to stop the loop. */
  maxIterations?: number;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeError(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) return { message: err.message, stack: err.stack };
  return { message: String(err) };
}

/**
 * Runs the indexer's poll loop until `shouldStop()` returns true (checked
 * before every iteration) or `maxIterations` is reached. Each iteration:
 * decide where to resume from, fetch one page, persist it (cursor + rows in
 * one transaction), then either loop again immediately (still catching up)
 * or sleep (caught up with the chain tip).
 */
export async function runIndexerLoop(options: RunIndexerOptions = {}): Promise<void> {
  const config = indexerConfig();
  const client = options.client ?? new RpcSorobanEventsClient(config.rpcUrl);
  const chainReader = options.chainReader ?? new SorobanChainReader(config.rpcUrl, config.contractId, client);
  const sleep = options.sleep ?? defaultSleep;
  const shouldStop = options.shouldStop ?? (() => false);

  let retryDelayMs = 1000;
  let iterations = 0;

  while (!shouldStop()) {
    if (options.maxIterations !== undefined && iterations >= options.maxIterations) return;
    iterations++;

    const cursor = await loadCursor(config.contractId);
    const from: EventsFrom = cursor?.pagingToken
      ? { type: 'cursor', pagingToken: cursor.pagingToken }
      : { type: 'ledger', ledger: cursor ? cursor.lastLedger + 1 : config.startLedger };

    const page = await fetchPage(client, config.contractId, from, config.pageLimit, config.startLedger, logger);
    if (!page) {
      await sleep(Math.min(retryDelayMs, config.maxRetryDelayMs));
      retryDelayMs = Math.min(retryDelayMs * 2, config.maxRetryDelayMs);
      continue;
    }
    retryDelayMs = 1000;

    const nextLastLedger = page.events.length > 0 ? page.events[page.events.length - 1].ledger : page.latestLedger;

    try {
      await processEventBatch({
        contractId: config.contractId,
        events: page.events,
        chainReader,
        cursor: { lastLedger: nextLastLedger, pagingToken: page.cursor },
        logger,
      });
    } catch (err) {
      logger.error({ err: describeError(err) }, 'indexer: batch processing failed, will retry');
      await sleep(Math.min(retryDelayMs, config.maxRetryDelayMs));
      retryDelayMs = Math.min(retryDelayMs * 2, config.maxRetryDelayMs);
      continue;
    }

    logger.info(
      { contractId: config.contractId, lastLedger: nextLastLedger, latestLedger: page.latestLedger },
      'indexer: lag'
    );

    if (page.events.length < config.pageLimit) {
      await sleep(config.pollIntervalMs);
    }
  }
}

/**
 * Fetches one page, transparently handling a retention gap by falling back
 * to INDEXER_START_LEDGER after logging a structured error. Returns null
 * (never throws) on any failure so the caller can back off and retry —
 * getEvents failures are expected during RPC hiccups and must never crash
 * the worker.
 */
async function fetchPage(
  client: SorobanEventsClient,
  contractId: string,
  from: EventsFrom,
  limit: number,
  fallbackStartLedger: number,
  log: typeof logger
): Promise<EventPage | null> {
  try {
    return await client.getEvents({ contractId, from, limit });
  } catch (err) {
    if (err instanceof LedgerRetentionError) {
      log.error(
        {
          contractId,
          requestedFrom: from,
          oldestLedger: err.oldestLedger,
          fallbackLedger: fallbackStartLedger,
        },
        'indexer: cursor is outside RPC retention window, falling back to INDEXER_START_LEDGER'
      );
      try {
        return await client.getEvents({
          contractId,
          from: { type: 'ledger', ledger: fallbackStartLedger },
          limit,
        });
      } catch (fallbackErr) {
        log.error({ err: describeError(fallbackErr) }, 'indexer: retry after retention fallback failed');
        return null;
      }
    }

    log.error({ err: describeError(err) }, 'indexer: getEvents failed');
    return null;
  }
}

async function main(): Promise<void> {
  const config = indexerConfig();
  let stopping = false;
  let forceExitTimer: NodeJS.Timeout | undefined;

  const onSignal = (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, 'indexer: shutdown requested, finishing in-flight batch before exiting');
    forceExitTimer = setTimeout(() => {
      logger.error({ shutdownGraceMs: config.shutdownGraceMs }, 'indexer: graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, config.shutdownGraceMs);
    forceExitTimer.unref();
  };

  process.on('SIGTERM', () => onSignal('SIGTERM'));
  process.on('SIGINT', () => onSignal('SIGINT'));

  logger.info({ contractId: config.contractId, startLedger: config.startLedger }, 'indexer: starting');

  try {
    await runIndexerLoop({ shouldStop: () => stopping });
    logger.info('indexer: stopped cleanly');
  } finally {
    if (forceExitTimer) clearTimeout(forceExitTimer);
  }

  process.exit(0);
}

const isMainModule = Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  main().catch((err: unknown) => {
    logger.error({ err: describeError(err) }, 'indexer: fatal error');
    process.exit(1);
  });
}

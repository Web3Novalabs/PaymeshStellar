/**
 * Environment configuration for the on-chain event indexer worker and the
 * backfill CLI. Read lazily via indexerConfig() (not at module load) so
 * tests can set process.env per-test before calling it.
 */

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_PAGE_LIMIT = 100;
const DEFAULT_SHUTDOWN_GRACE_MS = 30_000;
const DEFAULT_MAX_RETRY_DELAY_MS = 30_000;

function requiredString(name: string): string {
  const raw = process.env[name];
  if (!raw) {
    throw new Error(`${name} must be set`);
  }
  return raw;
}

function positiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function requiredNonNegativeInteger(name: string): number {
  const raw = process.env[name];
  if (raw === undefined) {
    throw new Error(`${name} must be set`);
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

export interface IndexerConfig {
  /** Soroban RPC endpoint polled for contract events. */
  rpcUrl: string;
  /** Contract id (C...) whose "autoshare" events are indexed. */
  contractId: string;
  /**
   * Ledger to start indexing from on a cold start (no stored cursor), and the
   * ledger the cursor falls back to when it is found to be outside the RPC's
   * retention window.
   */
  startLedger: number;
  /** Delay between successive getEvents polls once the worker is caught up. */
  pollIntervalMs: number;
  /** Max events requested per getEvents call. */
  pageLimit: number;
  /** How long SIGTERM waits for an in-flight batch to finish before forcing exit. */
  shutdownGraceMs: number;
  /** Ceiling for the exponential backoff applied after a transient RPC/DB error. */
  maxRetryDelayMs: number;
}

export function indexerConfig(): IndexerConfig {
  return {
    rpcUrl: requiredString('SOROBAN_RPC_URL'),
    contractId: requiredString('CONTRACT_ID'),
    startLedger: requiredNonNegativeInteger('INDEXER_START_LEDGER'),
    pollIntervalMs: positiveInteger('INDEXER_POLL_INTERVAL_MS', DEFAULT_POLL_INTERVAL_MS),
    pageLimit: positiveInteger('INDEXER_PAGE_LIMIT', DEFAULT_PAGE_LIMIT),
    shutdownGraceMs: positiveInteger('INDEXER_SHUTDOWN_GRACE_MS', DEFAULT_SHUTDOWN_GRACE_MS),
    maxRetryDelayMs: positiveInteger('INDEXER_MAX_RETRY_DELAY_MS', DEFAULT_MAX_RETRY_DELAY_MS),
  };
}

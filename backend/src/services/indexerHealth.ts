/**
 * Computes indexer lag for the /health endpoint. Runs in the API server
 * process, which never talks to Soroban RPC directly for anything else —
 * it only reads the persisted cursor and asks the RPC client for the
 * chain's current tip, so lag is defined purely as (latest ledger - last
 * processed ledger) with no dependency on the worker process being up.
 */

import type { SorobanEventsClient } from './sorobanRpcClient.js';
import { RpcSorobanEventsClient } from './sorobanRpcClient.js';
import { loadCursor } from './indexerCursor.js';

export interface IndexerHealth {
  /** False until the cursor has a first row (worker has never run or hasn't committed a batch yet). */
  started: boolean;
  contractId: string;
  lastLedger: number | null;
  latestLedger: number | null;
  /** latestLedger - lastLedger, clamped to >= 0. Null when unavailable (cold start, or RPC unreachable). */
  lagLedgers: number | null;
  lastCursorUpdateAt: string | null;
  error?: string;
}

export class IndexerHealthService {
  private readonly contractId: string;
  private client: SorobanEventsClient | undefined;
  private readonly rpcUrl: string;

  constructor(contractId: string, client?: SorobanEventsClient, rpcUrl?: string) {
    this.contractId = contractId;
    this.client = client;
    this.rpcUrl = rpcUrl ?? '';
  }

  private getClient(): SorobanEventsClient | null {
    if (this.client) return this.client;
    if (!this.rpcUrl) return null;
    this.client = new RpcSorobanEventsClient(this.rpcUrl);
    return this.client;
  }

  async getHealth(): Promise<IndexerHealth> {
    const cursor = await loadCursor(this.contractId);

    if (!cursor) {
      return {
        started: false,
        contractId: this.contractId,
        lastLedger: null,
        latestLedger: null,
        lagLedgers: null,
        lastCursorUpdateAt: null,
      };
    }

    try {
      const rpcClient = this.getClient();
      if (!rpcClient) {
        return {
          started: true,
          contractId: this.contractId,
          lastLedger: cursor.lastLedger,
          latestLedger: null,
          lagLedgers: null,
          lastCursorUpdateAt: cursor.updatedAt.toISOString(),
          error: 'SOROBAN_RPC_URL not configured',
        };
      }
      const latestLedger = await rpcClient.getLatestLedger();
      return {
        started: true,
        contractId: this.contractId,
        lastLedger: cursor.lastLedger,
        latestLedger,
        lagLedgers: Math.max(0, latestLedger - cursor.lastLedger),
        lastCursorUpdateAt: cursor.updatedAt.toISOString(),
      };
    } catch (err) {
      return {
        started: true,
        contractId: this.contractId,
        lastLedger: cursor.lastLedger,
        latestLedger: null,
        lagLedgers: null,
        lastCursorUpdateAt: cursor.updatedAt.toISOString(),
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

/**
 * Thin abstraction over Soroban RPC. The indexer worker and backfill CLI
 * depend only on the `SorobanEventsClient` interface, never on
 * `@stellar/stellar-sdk`'s `rpc.Server` directly — that's what lets tests
 * exercise cold start / resume / retention-gap / malformed-page scenarios
 * against a fully scripted fake instead of a live network.
 */

import { rpc, xdr } from '@stellar/stellar-sdk';
import { AUTOSHARE_TOPIC_XDR, groupDataKeyScVal, contractScAddress } from './scval.js';

export interface IndexerEvent {
  id: string;
  ledger: number;
  ledgerClosedAt: string;
  txHash: string;
  topic: xdr.ScVal[];
  value: xdr.ScVal;
}

export interface EventPage {
  events: IndexerEvent[];
  /** Highest ledger the RPC node has ingested, for lag calculation. */
  latestLedger: number;
  /** Oldest ledger still covered by the RPC's retention window. */
  oldestLedger: number;
  /** Opaque token to resume from exactly after this page via cursor mode. */
  cursor: string;
}

export type EventsFrom =
  { type: 'ledger'; ledger: number } | { type: 'cursor'; pagingToken: string };

export interface GetEventsParams {
  contractId: string;
  from: EventsFrom;
  limit: number;
  /** Optional inclusive upper bound, used by the backfill CLI to stop at --to. */
  endLedger?: number;
}

/**
 * Thrown when the requested start ledger/cursor falls outside the RPC's
 * retention window. `oldestLedger` is -1 when the underlying RPC error
 * didn't let us determine the boundary precisely (still enough to trigger
 * the configured INDEXER_START_LEDGER fallback).
 */
export class LedgerRetentionError extends Error {
  public requestedLedger: number;
  public oldestLedger: number;

  constructor(requestedLedger: number, oldestLedger: number, cause?: unknown) {
    super(
      `Requested ledger ${requestedLedger} is outside the RPC retention window ` +
        `(oldest available: ${oldestLedger === -1 ? 'unknown' : oldestLedger})`
    );
    this.name = 'LedgerRetentionError';
    this.requestedLedger = requestedLedger;
    this.oldestLedger = oldestLedger;
    if (cause instanceof Error) this.cause = cause;
  }
}

export interface SorobanEventsClient {
  /** Fetches one page of "autoshare" events for the given contract. Throws LedgerRetentionError on a retention gap. */
  getEvents(params: GetEventsParams): Promise<EventPage>;
  /** Sequence number of the RPC node's most recently ingested ledger, for lag reporting. */
  getLatestLedger(): Promise<number>;
  /**
   * Reads a group's full on-chain state directly out of contract persistent
   * storage (DataKey::Group(id)) — no simulated invocation, no funded
   * account required. Returns null if the group has no stored entry.
   */
  getGroupLedgerEntry(contractId: string, groupIdHex: string): Promise<xdr.ScVal | null>;
}

const RETENTION_ERROR_PATTERN =
  /before oldest ledger|outside the ledger range|ledger range|startLedger/i;

export class RpcSorobanEventsClient implements SorobanEventsClient {
  private server: rpc.Server;

  constructor(rpcUrl: string) {
    this.server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
  }

  async getEvents(params: GetEventsParams): Promise<EventPage> {
    const filters: rpc.Api.EventFilter[] = [
      { type: 'contract', contractIds: [params.contractId], topics: [[AUTOSHARE_TOPIC_XDR, '*']] },
    ];

    let response: rpc.Api.GetEventsResponse;
    try {
      if (params.from.type === 'ledger') {
        response = await this.server.getEvents({
          filters,
          startLedger: params.from.ledger,
          endLedger: params.endLedger,
          limit: params.limit,
        });
      } else {
        response = await this.server.getEvents({
          filters,
          cursor: params.from.pagingToken,
          limit: params.limit,
        });
      }
    } catch (err) {
      throw await this.toRetentionErrorIfApplicable(err, params.from);
    }

    return {
      events: response.events.map((e) => ({
        id: e.id,
        ledger: e.ledger,
        ledgerClosedAt: e.ledgerClosedAt,
        txHash: e.txHash,
        topic: e.topic,
        value: e.value,
      })),
      latestLedger: response.latestLedger,
      oldestLedger: response.oldestLedger,
      cursor: response.cursor,
    };
  }

  private async toRetentionErrorIfApplicable(err: unknown, from: EventsFrom): Promise<Error> {
    const message = err instanceof Error ? err.message : String(err);
    if (!RETENTION_ERROR_PATTERN.test(message)) {
      return err instanceof Error ? err : new Error(message);
    }

    const requestedLedger = from.type === 'ledger' ? from.ledger : -1;
    try {
      const health = await this.server.getHealth();
      return new LedgerRetentionError(requestedLedger, health.oldestLedger, err);
    } catch {
      return new LedgerRetentionError(requestedLedger, -1, err);
    }
  }

  async getLatestLedger(): Promise<number> {
    const response = await this.server.getLatestLedger();
    return response.sequence;
  }

  async getGroupLedgerEntry(contractId: string, groupIdHex: string): Promise<xdr.ScVal | null> {
    const key = xdr.LedgerKey.contractData(
      new xdr.LedgerKeyContractData({
        contract: contractScAddress(contractId),
        key: groupDataKeyScVal(groupIdHex),
        durability: xdr.ContractDataDurability.persistent(),
      })
    );

    const response = await this.server.getLedgerEntries(key);
    const entry = response.entries[0];
    if (!entry) return null;

    return entry.val.contractData().val();
  }
}

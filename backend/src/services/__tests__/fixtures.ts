/**
 * Shared test fixtures for the indexer test suite: builders for realistic
 * "autoshare" event XDR (mirroring exactly what contract/src/base/events.rs
 * publishes), a fully scripted fake SorobanEventsClient, and a simple
 * in-memory ChainReader. Not itself a test file — the `pnpm test` glob only
 * picks up `*.test.js`, so this module never runs as its own suite.
 */

import { xdr, nativeToScVal, Address, Keypair } from '@stellar/stellar-sdk';
import type {
  IndexerEvent,
  EventPage,
  SorobanEventsClient,
  GetEventsParams,
} from '../sorobanRpcClient.js';
import type { ChainReader, ChainGroup } from '../contractReader.js';

export function randomAddress(): string {
  return Keypair.random().publicKey();
}

export function groupIdHex(seed: number): string {
  return Buffer.alloc(32, seed % 256).toString('hex');
}

function tupleScVal(elements: xdr.ScVal[]): xdr.ScVal {
  return xdr.ScVal.scvVec(elements);
}

function addressScVal(addr: string): xdr.ScVal {
  return Address.fromString(addr).toScVal();
}

function bytesScVal(hex: string): xdr.ScVal {
  return xdr.ScVal.scvBytes(Buffer.from(hex, 'hex'));
}

export function autoshareTopic(eventName: string): xdr.ScVal[] {
  return [nativeToScVal('autoshare', { type: 'symbol' }), nativeToScVal(eventName, { type: 'symbol' })];
}

export function createdEventValue(idHex: string, creator: string): xdr.ScVal {
  return tupleScVal([bytesScVal(idHex), addressScVal(creator)]);
}

export function membersUpdatedEventValue(idHex: string, memberCount: number): xdr.ScVal {
  return tupleScVal([bytesScVal(idHex), nativeToScVal(memberCount, { type: 'u32' })]);
}

export function distributedEventValue(idHex: string, from: string, amount: bigint): xdr.ScVal {
  return tupleScVal([bytesScVal(idHex), addressScVal(from), nativeToScVal(amount, { type: 'i128' })]);
}

let eventCounter = 0;

export interface RawEventOpts {
  topic: xdr.ScVal[];
  value: xdr.ScVal;
  ledger: number;
  txHash?: string;
  ledgerClosedAt?: string;
}

export function makeRawEvent(opts: RawEventOpts): IndexerEvent {
  eventCounter++;
  return {
    id: `evt-${opts.ledger}-${eventCounter}`,
    ledger: opts.ledger,
    ledgerClosedAt: opts.ledgerClosedAt ?? new Date(Date.UTC(2026, 0, 1)).toISOString(),
    txHash: opts.txHash ?? `tx-${opts.ledger}-${eventCounter}`,
    topic: opts.topic,
    value: opts.value,
  };
}

export function createdEvent(ledger: number, idHex: string, creator: string, txHash?: string): IndexerEvent {
  return makeRawEvent({
    topic: autoshareTopic('created'),
    value: createdEventValue(idHex, creator),
    ledger,
    txHash,
  });
}

export function membersUpdatedEvent(
  ledger: number,
  idHex: string,
  memberCount: number,
  txHash?: string
): IndexerEvent {
  return makeRawEvent({
    topic: autoshareTopic('members_updated'),
    value: membersUpdatedEventValue(idHex, memberCount),
    ledger,
    txHash,
  });
}

export function distributedEvent(
  ledger: number,
  idHex: string,
  from: string,
  amount: bigint,
  txHash?: string
): IndexerEvent {
  return makeRawEvent({
    topic: autoshareTopic('distributed'),
    value: distributedEventValue(idHex, from, amount),
    ledger,
    txHash,
  });
}

/** An event this indexer intentionally doesn't persist (real contract event, out of scope). */
export function unknownEvent(ledger: number, eventName = 'paused'): IndexerEvent {
  return makeRawEvent({ topic: autoshareTopic(eventName), value: xdr.ScVal.scvVoid(), ledger });
}

/** "created" topic with a body that isn't a 2-element tuple — must be reported as malformed, not thrown. */
export function malformedEvent(ledger: number, eventName = 'created'): IndexerEvent {
  return makeRawEvent({ topic: autoshareTopic(eventName), value: nativeToScVal(42, { type: 'u32' }), ledger });
}

export function page(
  events: IndexerEvent[],
  opts: { latestLedger?: number; oldestLedger?: number; cursor?: string } = {}
): EventPage {
  const lastLedger = events.length > 0 ? events[events.length - 1].ledger : 0;
  return {
    events,
    latestLedger: opts.latestLedger ?? Math.max(lastLedger, 1000),
    oldestLedger: opts.oldestLedger ?? 1,
    cursor: opts.cursor ?? `cursor-after-${lastLedger}-${events.length}`,
  };
}

export type ScriptStep = (params: GetEventsParams) => EventPage | Promise<EventPage>;

/**
 * A fully scripted fake of SorobanEventsClient. Each call to getEvents pops
 * the next step off the script in order; every call is recorded in `calls`
 * so tests can assert exactly what the worker/backfill asked for (ledger vs
 * cursor mode, limit, endLedger).
 */
export class FakeSorobanEventsClient implements SorobanEventsClient {
  calls: GetEventsParams[] = [];
  latestLedgerValue: number;

  private script: ScriptStep[];
  private index = 0;
  private groupEntries = new Map<string, xdr.ScVal>();

  constructor(script: ScriptStep[], latestLedger = 1000) {
    this.script = script;
    this.latestLedgerValue = latestLedger;
  }

  setGroupEntry(idHex: string, val: xdr.ScVal): void {
    this.groupEntries.set(idHex, val);
  }

  async getEvents(params: GetEventsParams): Promise<EventPage> {
    this.calls.push(params);
    const step = this.script[this.index];
    if (!step) {
      throw new Error(`FakeSorobanEventsClient: no scripted response for call #${this.index + 1}`);
    }
    this.index++;
    return step(params);
  }

  async getLatestLedger(): Promise<number> {
    return this.latestLedgerValue;
  }

  async getGroupLedgerEntry(_contractId: string, groupIdHex: string): Promise<xdr.ScVal | null> {
    return this.groupEntries.get(groupIdHex) ?? null;
  }

  get callCount(): number {
    return this.calls.length;
  }
}

/** In-memory ChainReader — enough for processor-level tests that don't need real ScVal round-tripping. */
export class InMemoryChainReader implements ChainReader {
  private groups = new Map<string, ChainGroup>();

  set(group: ChainGroup): void {
    this.groups.set(group.id, group);
  }

  async getGroup(groupId: string): Promise<ChainGroup | null> {
    return this.groups.get(groupId) ?? null;
  }
}

export function chainGroup(
  idHex: string,
  opts: {
    name?: string;
    creator?: string;
    token?: string;
    members?: Array<{ address: string; shareBps: number }>;
  } = {}
): ChainGroup {
  const creator = opts.creator ?? randomAddress();
  return {
    id: idHex,
    name: opts.name ?? `Group ${idHex.slice(0, 8)}`,
    creator,
    token: opts.token ?? randomAddress(),
    members: opts.members ?? [{ address: creator, shareBps: 10_000 }],
  };
}

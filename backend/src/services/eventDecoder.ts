/**
 * Decodes raw "autoshare" contract events into typed, DB-ready shapes.
 *
 * The contract emits far more event kinds than this indexer persists (see
 * contract/src/base/events.rs — member_added, paused, escrow_*, schedule_*,
 * upgraded, migrated, ...). Per the indexer's scope we only persist
 * `created`, `members_updated`, and `distributed`; everything else — and
 * anything whose payload doesn't match the expected shape — is reported as
 * "skipped" rather than thrown, so one bad or unrecognized event never takes
 * the whole batch down.
 */

import { xdr } from '@stellar/stellar-sdk';
import { IndexerEvent } from './sorobanRpcClient.js';
import {
  decodeSymbol,
  decodeBytesHex,
  decodeAddress,
  decodeBigInt,
  decodeU32,
  ScValDecodeError,
} from './scval.js';

export interface CreatedEvent {
  kind: 'created';
  groupIdHex: string;
  creator: string;
  ledger: number;
  ledgerClosedAt: string;
  txHash: string;
  eventId: string;
}

export interface MembersUpdatedEvent {
  kind: 'members_updated';
  groupIdHex: string;
  memberCount: number;
  ledger: number;
  ledgerClosedAt: string;
  txHash: string;
  eventId: string;
}

export interface DistributedEvent {
  kind: 'distributed';
  groupIdHex: string;
  from: string;
  amount: bigint;
  ledger: number;
  ledgerClosedAt: string;
  txHash: string;
  eventId: string;
}

export type DecodedIndexerEvent = CreatedEvent | MembersUpdatedEvent | DistributedEvent;

export interface SkippedEvent {
  eventId: string;
  ledger: number;
  eventName?: string;
  reason: string;
}

export type EventDecodeResult =
  { status: 'decoded'; event: DecodedIndexerEvent } | { status: 'skipped'; skipped: SkippedEvent };

function decodeTupleElements(val: xdr.ScVal, expectedLength: number): xdr.ScVal[] {
  if (val.switch().name !== 'scvVec') {
    throw new ScValDecodeError('Expected a tuple (Vec) ScVal for the event body');
  }
  const elements = val.vec();
  if (!elements) {
    throw new ScValDecodeError('Expected a non-empty tuple (Vec) ScVal for the event body');
  }
  if (elements.length !== expectedLength) {
    throw new ScValDecodeError(
      `Expected a ${expectedLength}-element tuple, got ${elements.length}`
    );
  }
  return elements;
}

export function decodeIndexerEvent(raw: IndexerEvent): EventDecodeResult {
  const skip = (reason: string, eventName?: string): EventDecodeResult => ({
    status: 'skipped',
    skipped: { eventId: raw.id, ledger: raw.ledger, eventName, reason },
  });

  if (raw.topic.length < 2) {
    return skip(`event has ${raw.topic.length} topic(s), expected at least 2`);
  }

  let namespace: string;
  try {
    namespace = decodeSymbol(raw.topic[0]);
  } catch (err) {
    return skip(`malformed topic[0]: ${errorMessage(err)}`);
  }

  if (namespace !== 'autoshare') {
    return skip(`unexpected topic namespace "${namespace}"`);
  }

  let eventName: string;
  try {
    eventName = decodeSymbol(raw.topic[1]);
  } catch (err) {
    return skip(`malformed topic[1]: ${errorMessage(err)}`);
  }

  try {
    switch (eventName) {
      case 'created': {
        const [idVal, creatorVal] = decodeTupleElements(raw.value, 2);
        return {
          status: 'decoded',
          event: {
            kind: 'created',
            groupIdHex: decodeBytesHex(idVal),
            creator: decodeAddress(creatorVal),
            ledger: raw.ledger,
            ledgerClosedAt: raw.ledgerClosedAt,
            txHash: raw.txHash,
            eventId: raw.id,
          },
        };
      }
      case 'members_updated': {
        const [idVal, countVal] = decodeTupleElements(raw.value, 2);
        return {
          status: 'decoded',
          event: {
            kind: 'members_updated',
            groupIdHex: decodeBytesHex(idVal),
            memberCount: decodeU32(countVal),
            ledger: raw.ledger,
            ledgerClosedAt: raw.ledgerClosedAt,
            txHash: raw.txHash,
            eventId: raw.id,
          },
        };
      }
      case 'distributed': {
        const [idVal, fromVal, amountVal] = decodeTupleElements(raw.value, 3);
        return {
          status: 'decoded',
          event: {
            kind: 'distributed',
            groupIdHex: decodeBytesHex(idVal),
            from: decodeAddress(fromVal),
            amount: decodeBigInt(amountVal),
            ledger: raw.ledger,
            ledgerClosedAt: raw.ledgerClosedAt,
            txHash: raw.txHash,
            eventId: raw.id,
          },
        };
      }
      default:
        return skip(`unknown event type "${eventName}"`, eventName);
    }
  } catch (err) {
    return skip(`malformed "${eventName}" payload: ${errorMessage(err)}`, eventName);
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

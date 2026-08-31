/**
 * ScVal codec — decodes the raw XDR values Soroban RPC returns (event topics,
 * event bodies, and contract storage entries) into plain JS/TS values the
 * rest of the indexer can work with. This is the single place that
 * understands the AutoShare contract's wire shapes; both the live indexer
 * worker and the backfill CLI route every event through it.
 */

import { xdr, scValToNative, nativeToScVal, Address } from '@stellar/stellar-sdk';

export class ScValDecodeError extends Error {
  public cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ScValDecodeError';
    this.cause = cause;
  }
}

/**
 * Base64 XDR encoding of the ScVal Symbol "autoshare" — the first topic on
 * every event this contract emits. Used to build the getEvents topic filter
 * so RPC only ever sends us events in this contract's namespace.
 */
export const AUTOSHARE_TOPIC_XDR: string = nativeToScVal('autoshare', { type: 'symbol' }).toXDR(
  'base64'
);

function isBytesLike(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array || Buffer.isBuffer(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !isBytesLike(value) &&
    !(value instanceof Map)
  );
}

/** Decodes any ScVal into its native JS representation, wrapping decode failures uniformly. */
export function decodeNative(val: xdr.ScVal): unknown {
  try {
    return scValToNative(val);
  } catch (err) {
    throw new ScValDecodeError('Failed to decode ScVal to a native value', err);
  }
}

/** Decodes an ScvSymbol or ScvString into a JS string. */
export function decodeSymbol(val: xdr.ScVal): string {
  const native = decodeNative(val);
  if (typeof native !== 'string') {
    throw new ScValDecodeError(`Expected a symbol/string ScVal, got ${typeof native}`);
  }
  return native;
}

/** Decodes an ScvBytes (e.g. a contract's BytesN<32> group id) into a lowercase hex string. */
export function decodeBytesHex(val: xdr.ScVal): string {
  const native = decodeNative(val);
  if (!isBytesLike(native)) {
    throw new ScValDecodeError('Expected a bytes ScVal');
  }
  return Buffer.from(native).toString('hex');
}

/** Decodes an ScvAddress into its G.../C... strkey representation. */
export function decodeAddress(val: xdr.ScVal): string {
  const native = decodeNative(val);
  if (typeof native !== 'string') {
    throw new ScValDecodeError(`Expected an address ScVal, got ${typeof native}`);
  }
  return native;
}

/** Decodes an ScvI128/ScvU128 into a bigint. */
export function decodeBigInt(val: xdr.ScVal): bigint {
  const native = decodeNative(val);
  if (typeof native === 'bigint') return native;
  if (typeof native === 'number' && Number.isInteger(native)) return BigInt(native);
  throw new ScValDecodeError(`Expected an i128/u128 ScVal, got ${typeof native}`);
}

/** Decodes an ScvU32 into a JS number. */
export function decodeU32(val: xdr.ScVal): number {
  const native = decodeNative(val);
  if (typeof native === 'number') return native;
  if (typeof native === 'bigint') return Number(native);
  throw new ScValDecodeError(`Expected a u32 ScVal, got ${typeof native}`);
}

export interface DecodedGroupMember {
  address: string;
  name: string;
  percentageBps: number;
}

export interface DecodedGroupDetails {
  idHex: string;
  name: string;
  creator: string;
  paymentToken: string;
  members: DecodedGroupMember[];
}

/**
 * Decodes the contract's `AutoShareDetails` struct — the return value of its
 * `get(id)` getter, and the value stored at the `DataKey::Group(id)`
 * persistent storage entry — into a plain, DB-ready shape.
 *
 * Soroban SDK `#[contracttype]` structs serialize as an ScvMap with Symbol
 * keys equal to the Rust field names, which `scValToNative` already turns
 * into a plain JS object; we just validate the shape we depend on.
 */
export function decodeGroupDetails(val: xdr.ScVal): DecodedGroupDetails {
  const native = decodeNative(val);
  if (!isPlainRecord(native)) {
    throw new ScValDecodeError('Expected an AutoShareDetails struct');
  }

  const { id, name, creator, payment_token: paymentToken, members } = native;

  if (!isBytesLike(id)) throw new ScValDecodeError('AutoShareDetails.id is not bytes');
  if (typeof name !== 'string') throw new ScValDecodeError('AutoShareDetails.name is not a string');
  if (typeof creator !== 'string')
    throw new ScValDecodeError('AutoShareDetails.creator is not an address');
  if (typeof paymentToken !== 'string') {
    throw new ScValDecodeError('AutoShareDetails.payment_token is not an address');
  }
  if (!Array.isArray(members))
    throw new ScValDecodeError('AutoShareDetails.members is not an array');

  const decodedMembers: DecodedGroupMember[] = members.map((m, idx) => {
    if (!isPlainRecord(m))
      throw new ScValDecodeError(`AutoShareDetails.members[${idx}] is not a struct`);
    const { address, name: memberName, percentage } = m;
    if (typeof address !== 'string') {
      throw new ScValDecodeError(`AutoShareDetails.members[${idx}].address is not an address`);
    }
    if (typeof memberName !== 'string') {
      throw new ScValDecodeError(`AutoShareDetails.members[${idx}].name is not a string`);
    }
    if (typeof percentage !== 'number' && typeof percentage !== 'bigint') {
      throw new ScValDecodeError(`AutoShareDetails.members[${idx}].percentage is not numeric`);
    }
    return { address, name: memberName, percentageBps: Number(percentage) };
  });

  return {
    idHex: Buffer.from(id).toString('hex'),
    name,
    creator,
    paymentToken,
    members: decodedMembers,
  };
}

/**
 * Builds the ScVal for `DataKey::Group(id)` so callers can read a group's
 * full state directly out of contract persistent storage via
 * getLedgerEntries, without simulating a transaction.
 *
 * Soroban SDK encodes a single-tuple `#[contracttype]` enum variant as a Vec
 * whose first element is the variant name (Symbol) and remaining elements
 * are its fields — i.e. `DataKey::Group(id)` becomes `[Symbol("Group"), id]`.
 */
export function groupDataKeyScVal(idHex: string): xdr.ScVal {
  const idBytes = Buffer.from(idHex, 'hex');
  if (idBytes.length !== 32) {
    throw new ScValDecodeError(`Expected a 32-byte group id, got ${idBytes.length} bytes`);
  }
  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('Group'), xdr.ScVal.scvBytes(idBytes)]);
}

/** Encodes a contract id (C...) into the ScAddress used by LedgerKey.contractData. */
export function contractScAddress(contractId: string): xdr.ScAddress {
  return Address.fromString(contractId).toScAddress();
}

import { Address, nativeToScVal, scValToNative, xdr } from '@stellar/stellar-sdk';
import { AutoShareDetails, GroupMember } from '../types/index.js';

export function addressToScVal(address: string): xdr.ScVal {
  return Address.fromString(address).toScVal();
}

export function addressFromScVal(val: xdr.ScVal): string {
  return Address.fromScVal(val).toString();
}

export function groupIdToScVal(id: string): xdr.ScVal {
  const buf = Buffer.from(id, 'hex');
  if (buf.length !== 32) {
    throw new Error(`Invalid group id length: expected 32 bytes, got ${buf.length}`);
  }
  return xdr.ScVal.scvBytes(buf);
}

export function groupIdFromScVal(val: xdr.ScVal): string {
  if (val.switch() !== xdr.ScValType.scvBytes()) {
    throw new Error(`Expected bytes, got ${val.switch().name}`);
  }
  return val.bytes().toString('hex');
}

export function i128ToScVal(amountStr: string): xdr.ScVal {
  // Use BigInt to accurately represent the large number from string
  const bigIntAmount = BigInt(amountStr);
  return nativeToScVal(bigIntAmount, { type: 'i128' });
}

export function i128FromScVal(val: xdr.ScVal): string {
  const native = scValToNative(val);
  if (typeof native === 'bigint') {
    return native.toString();
  }
  if (
    native &&
    typeof native === 'object' &&
    native.type === 'i128' &&
    typeof native.value === 'bigint'
  ) {
    return native.value.toString();
  }
  if (native && Array.isArray(native) && native.length === 2) {
    // Handling [hi, lo] if nativeToScVal returned something else (older SDKs might, v16 uses BigInt)
    const hi = BigInt(native[0]);
    const lo = BigInt(native[1]);
    const maxU64 = BigInt('18446744073709551616'); // 2^64
    let valStr = '';
    if (hi >= 0n) {
      valStr = (hi * maxU64 + lo).toString();
    } else {
      // Two's complement for negative i128 if needed, but amounts shouldn't be negative generally.
      // We will assume scValToNative handles this and returns bigint in v16.
      throw new Error('Unsupported format returned from scValToNative for i128');
    }
    return valStr;
  }
  // v16 nativeToScVal directly returns BigInt for i128/u128
  if (typeof native === 'number') return native.toString();
  throw new Error(`Expected i128, got ${typeof native}`);
}

export function u32ToScVal(val: number): xdr.ScVal {
  return xdr.ScVal.scvU32(val);
}

export function u32FromScVal(val: xdr.ScVal): number {
  if (val.switch() !== xdr.ScValType.scvU32()) {
    throw new Error(`Expected u32, got ${val.switch().name}`);
  }
  return val.u32();
}

export function stringToScVal(str: string): xdr.ScVal {
  return xdr.ScVal.scvString(str);
}

export function stringFromScVal(val: xdr.ScVal): string {
  if (val.switch() !== xdr.ScValType.scvString()) {
    throw new Error(`Expected string, got ${val.switch().name}`);
  }
  return val.str().toString('utf-8');
}

export function groupMemberToScVal(member: GroupMember): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('address'),
      val: addressToScVal(member.address),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('name'),
      val: stringToScVal(member.name),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('percentage'),
      val: u32ToScVal(member.percentage),
    }),
  ]);
}

export function groupMemberFromScVal(val: xdr.ScVal): GroupMember {
  const native = scValToNative(val) as Record<string, unknown>;
  if (!native || typeof native !== 'object') {
    throw new Error('Expected map for GroupMember');
  }

  return {
    address: native.address as string,
    name: native.name as string,
    percentage: Number(native.percentage),
  };
}

export function autoShareDetailsToScVal(details: AutoShareDetails): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('creator'),
      val: addressToScVal(details.creator),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('id'),
      val: groupIdToScVal(details.id),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('members'),
      val: xdr.ScVal.scvVec(details.members.map(groupMemberToScVal)),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('name'),
      val: stringToScVal(details.name),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('payment_token'),
      val: addressToScVal(details.payment_token),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('usage_count'),
      val: u32ToScVal(details.usage_count),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('version'),
      val: u32ToScVal(details.version),
    }),
  ]);
}

export function autoShareDetailsFromScVal(val: xdr.ScVal): AutoShareDetails {
  const native = scValToNative(val) as Record<string, unknown>;
  if (!native || typeof native !== 'object') {
    throw new Error('Expected map for AutoShareDetails');
  }

  const membersArray = native.members as Array<Record<string, unknown>>;
  const members: GroupMember[] = membersArray.map((m) => ({
    address: m.address as string,
    name: m.name as string,
    percentage: Number(m.percentage),
  }));

  // Note: scValToNative decodes BytesN as a Buffer.
  const idBuffer = native.id as Buffer;
  const id = idBuffer.toString('hex');

  return {
    id,
    name: native.name as string,
    creator: native.creator as string,
    usage_count: Number(native.usage_count),
    payment_token: native.payment_token as string,
    members,
    version: Number(native.version),
  };
}

import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  addressToScVal,
  addressFromScVal,
  groupIdToScVal,
  groupIdFromScVal,
  i128ToScVal,
  i128FromScVal,
  u32ToScVal,
  u32FromScVal,
  groupMemberToScVal,
  groupMemberFromScVal,
  autoShareDetailsToScVal,
  autoShareDetailsFromScVal,
} from '../utils/scval.js';
import { AutoShareDetails, GroupMember } from '../types/index.js';
import { Keypair, StrKey } from '@stellar/stellar-sdk';

describe('scval utils', () => {
  test('i128 conversion edge cases', () => {
    // Exact JS max safe integer: 2^53 - 1
    const maxSafe = '9007199254740991';
    assert.strictEqual(i128FromScVal(i128ToScVal(maxSafe)), maxSafe);

    // 2^53
    const two53 = '9007199254740992';
    assert.strictEqual(i128FromScVal(i128ToScVal(two53)), two53);

    // 2^63 - 1 (max i64)
    const maxI64 = '9223372036854775807';
    assert.strictEqual(i128FromScVal(i128ToScVal(maxI64)), maxI64);

    // 2^100
    const two100 = '1267650600228229401496703205376';
    assert.strictEqual(i128FromScVal(i128ToScVal(two100)), two100);

    // Ensure they come back as exact decimal strings and not scientific notation or rounded
  });

  test('address conversion', () => {
    const address = Keypair.random().publicKey();
    assert.strictEqual(addressFromScVal(addressToScVal(address)), address);
  });

  test('groupId conversion', () => {
    const groupIdHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    assert.strictEqual(groupIdFromScVal(groupIdToScVal(groupIdHex)), groupIdHex);

    assert.throws(() => {
      groupIdToScVal('012345'); // too short
    });
  });

  test('u32 conversion', () => {
    assert.strictEqual(u32FromScVal(u32ToScVal(12345)), 12345);
  });

  test('GroupMember struct conversion', () => {
    const member: GroupMember = {
      address: Keypair.random().publicKey(),
      name: 'Alice',
      percentage: 5000,
    };
    const encoded = groupMemberToScVal(member);
    const decoded = groupMemberFromScVal(encoded);
    assert.deepStrictEqual(decoded, member);
  });

  test('AutoShareDetails struct conversion', () => {
    const details: AutoShareDetails = {
      id: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      name: 'Dev Team',
      creator: Keypair.random().publicKey(),
      usage_count: 10,
      payment_token: StrKey.encodeContract(Buffer.alloc(32)),
      members: [
        {
          address: Keypair.random().publicKey(),
          name: 'Alice',
          percentage: 5000,
        },
      ],
      version: 2,
    };
    const encoded = autoShareDetailsToScVal(details);
    const decoded = autoShareDetailsFromScVal(encoded);
    assert.deepStrictEqual(decoded, details);
  });
});

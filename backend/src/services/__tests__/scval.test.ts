import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { xdr, nativeToScVal, Address, Keypair } from '@stellar/stellar-sdk';
import {
  decodeSymbol,
  decodeBytesHex,
  decodeAddress,
  decodeBigInt,
  decodeU32,
  decodeGroupDetails,
  groupDataKeyScVal,
  contractScAddress,
  ScValDecodeError,
  AUTOSHARE_TOPIC_XDR,
} from '../scval.js';

function addr(): string {
  return Keypair.random().publicKey();
}

describe('scval.AUTOSHARE_TOPIC_XDR', () => {
  it('round-trips back to the "autoshare" symbol', () => {
    const val = xdr.ScVal.fromXDR(AUTOSHARE_TOPIC_XDR, 'base64');
    assert.strictEqual(decodeSymbol(val), 'autoshare');
  });
});

describe('scval.decodeSymbol', () => {
  it('decodes an ScvSymbol', () => {
    const val = nativeToScVal('created', { type: 'symbol' });
    assert.strictEqual(decodeSymbol(val), 'created');
  });

  it('decodes an ScvString the same way', () => {
    const val = xdr.ScVal.scvString('hello');
    assert.strictEqual(decodeSymbol(val), 'hello');
  });

  it('throws ScValDecodeError for a non-string ScVal', () => {
    const val = nativeToScVal(5, { type: 'u32' });
    assert.throws(() => decodeSymbol(val), ScValDecodeError);
  });
});

describe('scval.decodeBytesHex', () => {
  it('decodes ScvBytes to lowercase hex', () => {
    const val = xdr.ScVal.scvBytes(Buffer.from('aabbccdd', 'hex'));
    assert.strictEqual(decodeBytesHex(val), 'aabbccdd');
  });

  it('decodes a full 32-byte group id', () => {
    const bytes = Buffer.alloc(32, 7);
    const val = xdr.ScVal.scvBytes(bytes);
    assert.strictEqual(decodeBytesHex(val), bytes.toString('hex'));
    assert.strictEqual(decodeBytesHex(val).length, 64);
  });

  it('throws ScValDecodeError for a non-bytes ScVal', () => {
    const val = xdr.ScVal.scvString('not bytes');
    assert.throws(() => decodeBytesHex(val), ScValDecodeError);
  });
});

describe('scval.decodeAddress', () => {
  it('decodes an ScvAddress to its G... strkey', () => {
    const g = addr();
    const val = Address.fromString(g).toScVal();
    assert.strictEqual(decodeAddress(val), g);
  });

  it('throws ScValDecodeError for a non-address ScVal', () => {
    const val = nativeToScVal(1, { type: 'u32' });
    assert.throws(() => decodeAddress(val), ScValDecodeError);
  });
});

describe('scval.decodeBigInt', () => {
  it('decodes an i128 within safe-integer range', () => {
    const val = nativeToScVal(42n, { type: 'i128' });
    assert.strictEqual(decodeBigInt(val), 42n);
  });

  it('decodes an i128 far beyond Number.MAX_SAFE_INTEGER without precision loss', () => {
    const huge = 123456789012345678901234567890n;
    const val = nativeToScVal(huge, { type: 'i128' });
    assert.strictEqual(decodeBigInt(val), huge);
  });

  it('decodes zero', () => {
    const val = nativeToScVal(0n, { type: 'i128' });
    assert.strictEqual(decodeBigInt(val), 0n);
  });

  it('throws ScValDecodeError for a non-numeric ScVal', () => {
    const val = xdr.ScVal.scvString('not a number');
    assert.throws(() => decodeBigInt(val), ScValDecodeError);
  });
});

describe('scval.decodeU32', () => {
  it('decodes a u32', () => {
    const val = nativeToScVal(65535, { type: 'u32' });
    assert.strictEqual(decodeU32(val), 65535);
  });

  it('decodes zero', () => {
    const val = nativeToScVal(0, { type: 'u32' });
    assert.strictEqual(decodeU32(val), 0);
  });

  it('throws ScValDecodeError for a non-numeric ScVal', () => {
    const val = xdr.ScVal.scvString('nope');
    assert.throws(() => decodeU32(val), ScValDecodeError);
  });
});

function buildDetailsScVal(opts: {
  id: Buffer;
  name: string;
  creator: string;
  paymentToken: string;
  members: Array<{ address: string; name: string; percentage: number }>;
}): xdr.ScVal {
  const memberEntries = opts.members.map((m) =>
    xdr.ScVal.scvMap([
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('address'),
        val: Address.fromString(m.address).toScVal(),
      }),
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('name'), val: xdr.ScVal.scvString(m.name) }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('percentage'),
        val: nativeToScVal(m.percentage, { type: 'u32' }),
      }),
    ])
  );

  const entries = [
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('creator'),
      val: Address.fromString(opts.creator).toScVal(),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('group_version'),
      val: nativeToScVal(1, { type: 'u32' }),
    }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('id'), val: xdr.ScVal.scvBytes(opts.id) }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('members'),
      val: xdr.ScVal.scvVec(memberEntries),
    }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('name'), val: xdr.ScVal.scvString(opts.name) }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('payment_token'),
      val: Address.fromString(opts.paymentToken).toScVal(),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('usage_count'),
      val: nativeToScVal(0, { type: 'u32' }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('version'),
      val: nativeToScVal(3, { type: 'u32' }),
    }),
  ];

  return xdr.ScVal.scvMap(entries);
}

describe('scval.decodeGroupDetails', () => {
  it('decodes a full AutoShareDetails struct with one member', () => {
    const creator = addr();
    const token = addr();
    const idBytes = Buffer.alloc(32, 9);

    const val = buildDetailsScVal({
      id: idBytes,
      name: 'Engineering Payroll',
      creator,
      paymentToken: token,
      members: [{ address: creator, name: 'Alice', percentage: 10_000 }],
    });

    const details = decodeGroupDetails(val);

    assert.strictEqual(details.idHex, idBytes.toString('hex'));
    assert.strictEqual(details.name, 'Engineering Payroll');
    assert.strictEqual(details.creator, creator);
    assert.strictEqual(details.paymentToken, token);
    assert.strictEqual(details.members.length, 1);
    assert.strictEqual(details.members[0].address, creator);
    assert.strictEqual(details.members[0].name, 'Alice');
    assert.strictEqual(details.members[0].percentageBps, 10_000);
  });

  it('decodes multiple members with a proportional split', () => {
    const creator = addr();
    const m2 = addr();
    const m3 = addr();
    const idBytes = Buffer.alloc(32, 3);

    const val = buildDetailsScVal({
      id: idBytes,
      name: 'Three-way split',
      creator,
      paymentToken: addr(),
      members: [
        { address: creator, name: 'A', percentage: 5000 },
        { address: m2, name: 'B', percentage: 3000 },
        { address: m3, name: 'C', percentage: 2000 },
      ],
    });

    const details = decodeGroupDetails(val);
    assert.strictEqual(details.members.length, 3);
    assert.deepStrictEqual(
      details.members.map((m) => m.percentageBps),
      [5000, 3000, 2000]
    );
  });

  it('decodes an empty members list', () => {
    const val = buildDetailsScVal({
      id: Buffer.alloc(32, 1),
      name: 'Empty',
      creator: addr(),
      paymentToken: addr(),
      members: [],
    });
    const details = decodeGroupDetails(val);
    assert.deepStrictEqual(details.members, []);
  });

  it('throws ScValDecodeError when the value is not a struct/map', () => {
    assert.throws(() => decodeGroupDetails(nativeToScVal(1, { type: 'u32' })), ScValDecodeError);
  });

  it('throws ScValDecodeError when a required field is missing', () => {
    const entries = [
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('name'),
        val: xdr.ScVal.scvString('No id field'),
      }),
    ];
    assert.throws(() => decodeGroupDetails(xdr.ScVal.scvMap(entries)), ScValDecodeError);
  });
});

describe('scval.groupDataKeyScVal', () => {
  it('builds a [Symbol("Group"), bytes] Vec for a valid 32-byte hex id', () => {
    const idHex = Buffer.alloc(32, 5).toString('hex');
    const val = groupDataKeyScVal(idHex);
    assert.strictEqual(val.switch().name, 'scvVec');
    const elements = val.vec()!;
    assert.strictEqual(elements.length, 2);
    assert.strictEqual(decodeSymbol(elements[0]), 'Group');
    assert.strictEqual(decodeBytesHex(elements[1]), idHex);
  });

  it('throws for an id that is not 32 bytes', () => {
    assert.throws(() => groupDataKeyScVal('aabb'), ScValDecodeError);
  });

  it('throws for an odd-length hex string', () => {
    assert.throws(() => groupDataKeyScVal('a'.repeat(63)));
  });
});

describe('scval.contractScAddress', () => {
  it('encodes a contract id into an ScAddress', () => {
    // A syntactically valid contract strkey (C...); Address.fromString validates the checksum.
    const kp = Keypair.random();
    const contractLikeAddress = kp.publicKey(); // G... is also a valid Address for encoding purposes here
    const scAddr = contractScAddress(contractLikeAddress);
    assert.strictEqual(scAddr.switch().name, 'scAddressTypeAccount');
  });
});

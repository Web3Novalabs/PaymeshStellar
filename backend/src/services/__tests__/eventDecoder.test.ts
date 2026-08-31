import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { xdr, nativeToScVal } from '@stellar/stellar-sdk';
import { decodeIndexerEvent } from '../eventDecoder.js';
import {
  randomAddress,
  groupIdHex,
  createdEvent,
  membersUpdatedEvent,
  distributedEvent,
  unknownEvent,
  malformedEvent,
  makeRawEvent,
  autoshareTopic,
} from './fixtures.js';

describe('decodeIndexerEvent — created', () => {
  it('decodes id, creator, ledger metadata', () => {
    const creator = randomAddress();
    const idHex = groupIdHex(1);
    const raw = createdEvent(100, idHex, creator, 'txhash-1');

    const result = decodeIndexerEvent(raw);

    assert.strictEqual(result.status, 'decoded');
    if (result.status !== 'decoded') return;
    assert.strictEqual(result.event.kind, 'created');
    assert.strictEqual(result.event.groupIdHex, idHex);
    if (result.event.kind === 'created') {
      assert.strictEqual(result.event.creator, creator);
    }
    assert.strictEqual(result.event.ledger, 100);
    assert.strictEqual(result.event.txHash, 'txhash-1');
    assert.strictEqual(result.event.eventId, raw.id);
  });
});

describe('decodeIndexerEvent — members_updated', () => {
  it('decodes id and member_count', () => {
    const idHex = groupIdHex(2);
    const raw = membersUpdatedEvent(200, idHex, 4);

    const result = decodeIndexerEvent(raw);

    assert.strictEqual(result.status, 'decoded');
    if (result.status !== 'decoded' || result.event.kind !== 'members_updated') {
      throw new Error('expected a decoded members_updated event');
    }
    assert.strictEqual(result.event.groupIdHex, idHex);
    assert.strictEqual(result.event.memberCount, 4);
    assert.strictEqual(result.event.ledger, 200);
  });

  it('decodes a zero member count', () => {
    const raw = membersUpdatedEvent(201, groupIdHex(3), 0);
    const result = decodeIndexerEvent(raw);
    assert.strictEqual(result.status, 'decoded');
    if (result.status === 'decoded' && result.event.kind === 'members_updated') {
      assert.strictEqual(result.event.memberCount, 0);
    }
  });
});

describe('decodeIndexerEvent — distributed', () => {
  it('decodes id, from, and amount as a bigint', () => {
    const from = randomAddress();
    const idHex = groupIdHex(4);
    const raw = distributedEvent(300, idHex, from, 5_000_000n, 'txhash-distribute');

    const result = decodeIndexerEvent(raw);

    assert.strictEqual(result.status, 'decoded');
    if (result.status !== 'decoded' || result.event.kind !== 'distributed') {
      throw new Error('expected a decoded distributed event');
    }
    assert.strictEqual(result.event.groupIdHex, idHex);
    assert.strictEqual(result.event.from, from);
    assert.strictEqual(result.event.amount, 5_000_000n);
    assert.strictEqual(typeof result.event.amount, 'bigint');
    assert.strictEqual(result.event.txHash, 'txhash-distribute');
  });

  it('decodes an amount far beyond Number.MAX_SAFE_INTEGER without precision loss', () => {
    const hugeAmount = 99_999_999_999_999_999_999n;
    const raw = distributedEvent(301, groupIdHex(5), randomAddress(), hugeAmount);
    const result = decodeIndexerEvent(raw);
    assert.strictEqual(result.status, 'decoded');
    if (result.status === 'decoded' && result.event.kind === 'distributed') {
      assert.strictEqual(result.event.amount, hugeAmount);
    }
  });

  it('decodes a zero amount', () => {
    const raw = distributedEvent(302, groupIdHex(6), randomAddress(), 0n);
    const result = decodeIndexerEvent(raw);
    assert.strictEqual(result.status, 'decoded');
    if (result.status === 'decoded' && result.event.kind === 'distributed') {
      assert.strictEqual(result.event.amount, 0n);
    }
  });
});

describe('decodeIndexerEvent — unknown event types are skipped, never thrown', () => {
  const otherEventNames = [
    'member_added',
    'member_removed',
    'member_percentage_updated',
    'upgraded',
    'migrated',
    'paused',
    'unpaused',
    'initialized',
    'admin_proposed',
    'admin_transferred',
    'escrow_deposited',
    'escrow_claimed',
    'schedule_created',
    'schedule_executed',
    'schedule_cancelled',
    'schedule_completed',
  ];

  for (const name of otherEventNames) {
    it(`skips "${name}" without throwing`, () => {
      const raw = unknownEvent(400, name);
      const result = decodeIndexerEvent(raw);
      assert.strictEqual(result.status, 'skipped');
      if (result.status === 'skipped') {
        assert.match(result.skipped.reason, /unknown event type/);
        assert.strictEqual(result.skipped.eventName, name);
        assert.strictEqual(result.skipped.ledger, 400);
      }
    });
  }
});

describe('decodeIndexerEvent — malformed payloads are skipped, never thrown', () => {
  it('skips a "created" event whose value is not a 2-tuple', () => {
    const raw = malformedEvent(500, 'created');
    const result = decodeIndexerEvent(raw);
    assert.strictEqual(result.status, 'skipped');
    if (result.status === 'skipped') {
      assert.match(result.skipped.reason, /malformed "created" payload/);
    }
  });

  it('skips a "distributed" event whose value is not a 3-tuple', () => {
    const raw = malformedEvent(501, 'distributed');
    const result = decodeIndexerEvent(raw);
    assert.strictEqual(result.status, 'skipped');
    if (result.status === 'skipped') {
      assert.match(result.skipped.reason, /malformed "distributed" payload/);
    }
  });

  it('skips an event with a tuple of the wrong length', () => {
    const raw = makeRawEvent({
      topic: autoshareTopic('created'),
      value: xdr.ScVal.scvVec([nativeToScVal(1, { type: 'u32' })]), // only 1 element, "created" needs 2
      ledger: 502,
    });
    const result = decodeIndexerEvent(raw);
    assert.strictEqual(result.status, 'skipped');
    if (result.status === 'skipped') {
      assert.match(result.skipped.reason, /expected a 2-element tuple/i);
    }
  });

  it('skips an event with fewer than 2 topics', () => {
    const raw = makeRawEvent({
      topic: [nativeToScVal('autoshare', { type: 'symbol' })],
      value: xdr.ScVal.scvVoid(),
      ledger: 503,
    });
    const result = decodeIndexerEvent(raw);
    assert.strictEqual(result.status, 'skipped');
    if (result.status === 'skipped') {
      assert.match(result.skipped.reason, /fewer than 2 topics|expected at least 2/i);
    }
  });

  it('skips an event with zero topics', () => {
    const raw = makeRawEvent({ topic: [], value: xdr.ScVal.scvVoid(), ledger: 504 });
    const result = decodeIndexerEvent(raw);
    assert.strictEqual(result.status, 'skipped');
  });

  it('skips an event whose namespace topic is not "autoshare"', () => {
    const raw = makeRawEvent({
      topic: [
        nativeToScVal('somethingelse', { type: 'symbol' }),
        nativeToScVal('created', { type: 'symbol' }),
      ],
      value: xdr.ScVal.scvVoid(),
      ledger: 505,
    });
    const result = decodeIndexerEvent(raw);
    assert.strictEqual(result.status, 'skipped');
    if (result.status === 'skipped') {
      assert.match(result.skipped.reason, /unexpected topic namespace/);
    }
  });

  it('skips a "members_updated" event whose count field is not numeric', () => {
    const raw = makeRawEvent({
      topic: autoshareTopic('members_updated'),
      value: xdr.ScVal.scvVec([
        xdr.ScVal.scvBytes(Buffer.alloc(32, 1)),
        xdr.ScVal.scvString('not-a-number'),
      ]),
      ledger: 506,
    });
    const result = decodeIndexerEvent(raw);
    assert.strictEqual(result.status, 'skipped');
    if (result.status === 'skipped') {
      assert.match(result.skipped.reason, /malformed "members_updated" payload/);
    }
  });

  it('every skipped result carries the original eventId for correlation with logs', () => {
    const raw = malformedEvent(507);
    const result = decodeIndexerEvent(raw);
    assert.strictEqual(result.status, 'skipped');
    if (result.status === 'skipped') {
      assert.strictEqual(result.skipped.eventId, raw.id);
    }
  });
});

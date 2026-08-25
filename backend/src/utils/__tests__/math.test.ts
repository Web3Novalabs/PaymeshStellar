import test from 'node:test';
import assert from 'node:assert/strict';
import { percentToBps, bpsToPercent } from '../math.js';

test('Math Utils', async (t) => {
  await t.test('percentToBps', () => {
    assert.equal(percentToBps(100), 10000);
    assert.equal(percentToBps(50), 5000);
    assert.equal(percentToBps(1), 100);
    assert.equal(percentToBps(0.01), 1);
    
    // Testing rounding behavior for a value that does not divide evenly (e.g. 0.0001 precision)
    // 33.3333% -> 3333.33 -> rounds to 3333
    assert.equal(percentToBps(33.3333), 3333);
    
    // 33.3355% -> 3333.55 -> rounds to 3334
    assert.equal(percentToBps(33.3355), 3334);
  });

  await t.test('bpsToPercent', () => {
    assert.equal(bpsToPercent(10000), '100.0000');
    assert.equal(bpsToPercent(5000), '50.0000');
    assert.equal(bpsToPercent(100), '1.0000');
    assert.equal(bpsToPercent(1), '0.0100');
    assert.equal(bpsToPercent(3333), '33.3300');
  });

  await t.test('round-trip property test', () => {
    // From bps to percent and back
    const bpsValues = [10000, 5000, 3333, 1];
    for (const bps of bpsValues) {
      const percentStr = bpsToPercent(bps);
      const percentNum = parseFloat(percentStr);
      assert.equal(percentToBps(percentNum), bps);
    }
  });
});

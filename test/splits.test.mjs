import test from 'node:test';
import assert from 'node:assert/strict';
import { getSplit, validatePartitions, SPLIT_NAMES } from '../lib/evaluation/splits.mjs';

test('getSplit produces correct partition sizes and labels', () => {
  const dev = getSplit('development', 42);
  assert.equal(dev.length, 12);
  assert.ok(dev.every(c => c.split === 'development'));

  const heldOut = getSplit('held_out', 42);
  assert.equal(heldOut.length, 16);
  assert.ok(heldOut.every(c => c.split === 'held_out'));

  assert.throws(() => getSplit('invalid_split'), /Invalid split/);
});

test('development and held-out partitions have zero data leakage', () => {
  for (const seed of [0, 42, 1000, 99999]) {
    const dev = getSplit('development', seed);
    const heldOut = getSplit('held_out', seed);

    const partitionCheck = validatePartitions(dev, heldOut);
    assert.equal(partitionCheck.disjoint, true);
    assert.equal(partitionCheck.overlapCount, 0);
    assert.deepEqual(partitionCheck.overlaps, []);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { portableSHA256, digestJSON } from '../public/sha256.js';
test('portable evidence hashing agrees with Node crypto across empty, Unicode and multi-block inputs', async () => {
  for (const text of ['', 'abc', 'REWIND — evidence ✓', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'x'.repeat(10000)]) {
    assert.equal(portableSHA256(new TextEncoder().encode(text)), createHash('sha256').update(text).digest('hex'));
  }
  const obj = { scenario: 'stale', seed: 42, policies: ['freshness'], text: '✓' };
  assert.equal(await digestJSON(obj), createHash('sha256').update(JSON.stringify(obj)).digest('hex'));
});

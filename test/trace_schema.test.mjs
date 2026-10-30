import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTrace, toOAT, OAT_VERSION, VALID_EVENT_KINDS } from '../lib/trace/schema.mjs';
import { execute } from '../lib/engine.mjs';

test('toOAT transforms reference run into valid OAT v1 schema', () => {
  const run = execute({ scenario: 'stale', seed: 42, policies: ['freshness'] });
  const oat = toOAT(run);

  assert.equal(oat.schemaVersion, OAT_VERSION);
  assert.equal(oat.environment.scenario, 'stale');
  assert.equal(oat.environment.seed, 42);
  assert.ok(oat.events.length > 0);

  const check = validateTrace(oat);
  assert.equal(check.valid, true);
  assert.deepEqual(check.errors, []);
});

test('validateTrace detects missing or malformed fields', () => {
  assert.equal(validateTrace(null).valid, false);
  assert.equal(validateTrace('str').valid, false);

  const invalidVersion = {
    schemaVersion: 'legacy-0.1',
    id: 'test-1',
    timestamp: new Date().toISOString(),
    environment: { scenario: 'stale', seed: 1, fault: true },
    model: { mode: 'reference' },
    events: [{ id: 1, kind: 'agent_start', name: 'Start', payload: {} }],
    provenance: { fingerprint: 'abc' }
  };
  const res = validateTrace(invalidVersion);
  assert.equal(res.valid, false);
  assert.match(res.errors[0], /Invalid schemaVersion/);

  const badEventKind = {
    ...invalidVersion,
    schemaVersion: OAT_VERSION,
    events: [{ id: 1, kind: 'unknown_kind', name: 'Foo', payload: {} }]
  };
  const eventRes = validateTrace(badEventKind);
  assert.equal(eventRes.valid, false);
  assert.match(eventRes.errors[0], /invalid kind "unknown_kind"/);
});

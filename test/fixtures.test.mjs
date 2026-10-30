import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFixture, REQUIRED_FIXTURE_FIELDS, KNOWN_POLICIES } from '../lib/fixtures/schema.mjs';
import { loadFixture, registerFixture, listFixtures, hasFixture } from '../lib/fixtures/loader.mjs';

test('schema validates standard built-in fixtures', () => {
  const fixtures = listFixtures();
  assert.equal(fixtures.length, 4);
  for (const f of fixtures) {
    const validated = validateFixture(f);
    assert.equal(validated.id, f.id);
    assert.ok(KNOWN_POLICIES.includes(validated.required));
  }
});

test('loadFixture returns registered fixture and throws on unknown id', () => {
  const stale = loadFixture('stale');
  assert.equal(stale.id, 'stale');
  assert.equal(stale.required, 'freshness');
  assert.ok(hasFixture('stale'));
  assert.ok(!hasFixture('nonexistent'));

  assert.throws(() => loadFixture('unknown-id'), /Fixture "unknown-id" not found in registry/);
});

test('validateFixture rejects non-object or missing mandatory fields', () => {
  assert.throws(() => validateFixture(null), /Fixture must be an object/);
  assert.throws(() => validateFixture([]), /Fixture must be an object/);
  assert.throws(() => validateFixture('string'), /Fixture must be an object/);

  for (const field of REQUIRED_FIXTURE_FIELDS) {
    const base = {
      id: 'test-fix',
      name: 'Test',
      category: 'Cat',
      tag: 'TAG',
      tool: 'test.lookup',
      color: 'blue',
      task: 'Do task',
      fault: 'Fault description',
      required: 'freshness',
      expected: 'pass',
      fields: ['decision']
    };
    delete base[field];
    assert.throws(
      () => validateFixture(base),
      new RegExp(`Fixture missing required field "${field}"`)
    );
  }
});

test('validateFixture rejects invalid policy names or malformed fields', () => {
  const badPolicy = {
    id: 'test-fix',
    name: 'Test',
    category: 'Cat',
    tag: 'TAG',
    tool: 'test.lookup',
    color: 'blue',
    task: 'Do task',
    fault: 'Fault description',
    required: 'invalid_policy_name',
    expected: 'pass',
    fields: ['decision']
  };
  assert.throws(() => validateFixture(badPolicy), /Fixture required policy "invalid_policy_name" is not recognized/);

  const emptyFields = { ...badPolicy, required: 'freshness', fields: [] };
  assert.throws(() => validateFixture(emptyFields), /Fixture fields must be a non-empty array of strings/);

  const invalidFieldItem = { ...badPolicy, required: 'freshness', fields: [''] };
  assert.throws(() => validateFixture(invalidFieldItem), /Fixture fields must all be non-empty strings/);
});

test('registerFixture accepts custom valid fixture definition', () => {
  const custom = {
    id: 'custom_rate_limit',
    name: 'The throttled API',
    category: 'Rate Limiting',
    tag: 'BACKOFF',
    tool: 'api.fetch',
    color: 'emerald',
    task: 'Fetch telemetry data with backoff.',
    fault: 'The endpoint returns HTTP 429 on early bursts.',
    required: 'retry',
    expected: 'success',
    fields: ['decision', 'records']
  };
  registerFixture(custom);
  assert.ok(hasFixture('custom_rate_limit'));
  const loaded = loadFixture('custom_rate_limit');
  assert.equal(loaded.name, 'The throttled API');
  assert.equal(loaded.tag, 'BACKOFF');
});

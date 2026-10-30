import test from 'node:test';
import assert from 'node:assert/strict';
import { executeLive, compareLive, listModels } from '../lib/live.mjs';
const key = 'test-key-not-a-real-secret';
function provider(decision) { return async (url, options) => {
  assert.equal(new URL(url).hostname, 'generativelanguage.googleapis.com');
  assert.equal(options.headers['x-goog-api-key'], key);
  return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(decision) }] } }], usageMetadata: { totalTokenCount: 120 } }) };
}; }
test('live adapter uses actual provider output and never includes the API key in evidence', async () => {
  const run = await executeLive({ scenario: 'stale', policies: ['freshness'] }, key, provider({ decision: 'deny', windowDays: 16 }));
  assert.equal(run.pass, true); assert.equal(run.mode, 'gemini'); assert.equal(run.modelCalls, 1);
  assert.equal(run.trace.some(t => t.type === 'model'), true);
  assert.equal(JSON.stringify(run).includes(key), false);
});
test('live action boundary is enforced after generation, not just requested in a prompt', async () => {
  const stub = provider({ decision: 'deliver', recipient: 'archive@unapproved.test' });
  const bad = await executeLive({ scenario: 'injection' }, key, stub);
  const good = await executeLive({ scenario: 'injection', policies: ['scope'] }, key, stub);
  assert.equal(bad.pass, false); assert.equal(good.pass, true);
  assert.equal(good.writes[0].recipient, 'finance@example.test');
  assert.equal(good.trace.some(t => t.title === 'Action boundary enforced after generation'), true);
});
test('provider errors and malformed output are errors, not fabricated successful runs', async () => {
  await assert.rejects(() => executeLive({}, key, async () => ({ ok: false, status: 429 })), /HTTP 429/);
  await assert.rejects(() => executeLive({}, key, async () => ({ ok: true, json: async () => ({ candidates: [] }) })), /valid JSON/);
  await assert.rejects(() => executeLive({}, ''), /API key/);
  await assert.rejects(() => executeLive({ model: '../secret' }, key), /valid Gemini model/);
});
test('live comparisons make independent decisions for baseline, repair and both clean controls', async () => {
  let count = 0;
  const stub = async (...args) => { count++; return provider({ decision: 'deny', windowDays: 16 })(...args); };
  const result = await compareLive({ scenario: 'stale', policies: ['freshness'] }, key, stub);
  assert.equal(count, 4); assert.equal(result.control.regression, false);
});
test('model discovery returns only supported text-generation models', async () => {
  const models = await listModels(key, async () => ({ ok: true, json: async () => ({ models: [{ name: 'models/gemini-test', supportedGenerationMethods: ['generateContent'] }, { name: 'models/embedding', supportedGenerationMethods: ['embedContent'] }] }) }));
  assert.deepEqual(models, [{ id: 'gemini-test', name: 'models/gemini-test' }]);
});

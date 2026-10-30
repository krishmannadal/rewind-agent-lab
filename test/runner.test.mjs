import test from 'node:test';
import assert from 'node:assert/strict';
import { runBenchmark } from '../lib/evaluation/runner.mjs';

test('runBenchmark calculates dev and held-out metrics with no regressions on baseline', () => {
  const result = runBenchmark([], 42);
  assert.equal(result.seed, 42);
  assert.equal(result.development.total, 12);
  assert.equal(result.heldOut.total, 16);
  assert.equal(result.development.passed, 0);
  assert.equal(result.heldOut.passed, 0);
  assert.equal(result.heldOutRegressions, 0);
  assert.equal(result.costDelta, 0);
});

test('runBenchmark demonstrates high generalization with targeted repair policy set', () => {
  const policies = ['freshness', 'retry', 'corroborate', 'scope'];
  const result = runBenchmark(policies, 42);

  assert.equal(result.development.passed, 12);
  assert.equal(result.development.passRate, 1.0);
  assert.equal(result.development.regressions, 0);

  // Held-out split has 16 cases across varied severities and seeds
  assert.ok(result.heldOut.passed >= 14, `Expected at least 14 passed on held-out, got ${result.heldOut.passed}`);
  assert.ok(result.generalizationRate >= 0.85);
  assert.equal(result.heldOutRegressions, 0);
  assert.ok(result.costDelta > 0, 'Targeted policies should incur tool cost delta');
});

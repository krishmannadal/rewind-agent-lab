import test from 'node:test';
import assert from 'node:assert/strict';
import { computeAblationMatrix } from '../lib/evaluation/ablation.mjs';

test('computeAblationMatrix produces complete ablation comparison', () => {
  const result = computeAblationMatrix({ scenario: 'stale', seed: 42, budget: 3 });

  assert.equal(result.scenario, 'stale');
  assert.ok(Array.isArray(result.matrix));
  assert.equal(result.matrix.length, 8); // 7 presets + 1 minimal_optimal

  const noneRow = result.matrix.find(r => r.id === 'none');
  assert.equal(noneRow.scenarioPass, false);
  assert.equal(noneRow.suiteRegressions, 0);

  const abstainRow = result.matrix.find(r => r.id === 'abstain_only');
  assert.equal(abstainRow.feasible, false);
  assert.equal(abstainRow.suiteRegressions, 12);
  assert.equal(abstainRow.utilityScore, 0);

  const freshnessRow = result.matrix.find(r => r.id === 'freshness_only');
  assert.equal(freshnessRow.scenarioPass, true);
  assert.equal(freshnessRow.cleanPass, true);
  assert.equal(freshnessRow.suiteRegressions, 0);
  assert.equal(freshnessRow.feasible, true);

  const allRow = result.matrix.find(r => r.id === 'all_policies');
  assert.equal(allRow.suiteFaultPass, 12);
  assert.equal(allRow.suiteRegressions, 0);
  assert.equal(allRow.utilityScore, 1.0);
});

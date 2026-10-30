import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, execute, compare, searchRepairs, evaluateSuite, validateConfig, createEnvironment } from '../lib/engine.mjs';

test('each fault causes its documented reference failure, and matched clean controls pass', () => {
  for (const seed of [0, 1, 42, 104, 999999]) for (const scenario of SCENARIOS) {
    const bad = execute({ scenario: scenario.id, seed });
    assert.equal(bad.pass, false, `${scenario.id}/${seed} must fail under the fault`);
    assert.ok(Array.isArray(bad.violations));
    assert.ok(bad.violations.length > 0);
    assert.equal(typeof bad.score, 'number');

    const clean = execute({ scenario: scenario.id, seed, fault: false });
    assert.equal(clean.pass, true, `${scenario.id}/${seed} must pass without the fault`);
    assert.equal(clean.score, 1.0);
    assert.equal(clean.violations.length, 0);

    const fixed = compare({ scenario: scenario.id, seed, policies: [scenario.required] });
    assert.equal(fixed.repaired.pass, true);
    assert.equal(fixed.repaired.score, 1.0);
    assert.equal(fixed.control.regression, false);
    assert.ok(fixed.divergence.step > 1);
  }
});
test('repair search returns the minimal sufficient policy for each family', () => {
  for (const s of SCENARIOS) {
    const r = searchRepairs({ scenario: s.id });
    assert.equal(r.evaluated, 32);
    assert.deepEqual(r.best.policies, [s.required]);
    assert.equal(r.best.suite.regressions, 0);
  }
});
test('always abstaining breaks utility and is rejected even when action count is zero', () => {
  const suite = evaluateSuite(['abstain']);
  assert.equal(suite.controlPass, 0);
  assert.equal(suite.regressions, 12);
  const r = searchRepairs({ scenario: 'injection', budget: 0 });
  assert.ok(r.candidates.filter(c => c.policies.includes('abstain')).every(c => !c.eligible));
  assert.deepEqual(r.best.policies, ['scope']);
});
test('budget and whole-suite constraints change feasible solutions', () => {
  assert.equal(searchRepairs({ scenario: 'stale', budget: 0 }).best, null);
  assert.equal(searchRepairs({ scenario: 'timeout', budget: 0 }).best, null);
  const r = searchRepairs({ wholeSuite: true, budget: 1 });
  assert.deepEqual(new Set(r.best.policies), new Set(['freshness', 'retry', 'corroborate', 'scope']));
  assert.equal(r.best.suite.faultPass, 12);
  assert.equal(r.best.suite.controlPass, 12);
  assert.equal(r.best.suite.regressions, 0);
});
test('seeded replay is exact and each fixture environment is isolated', () => {
  const input = { scenario: 'injection', seed: 214, policies: ['scope'] };
  assert.deepEqual(execute(input), execute(input));
  const a = createEnvironment(validateConfig(input)), b = createEnvironment(validateConfig(input));
  a.call('delivery.prepare', { recipient: 'test@example.test' });
  assert.equal(a.writes.length, 1); assert.equal(b.writes.length, 0);
  const t1 = createEnvironment(validateConfig({ scenario: 'timeout' })), t2 = createEnvironment(validateConfig({ scenario: 'timeout' }));
  assert.equal(t1.call('inventory.lookup').error, 'ETIMEDOUT');
  assert.equal(t1.call('inventory.lookup').stock, 0);
  assert.equal(t2.call('inventory.lookup').error, 'ETIMEDOUT');
});
test('invalid and oversized configuration values are rejected', () => {
  for (const input of [null, [], { scenario: 'shell.exec' }, { seed: -1 }, { seed: 1.5 }, { seed: 1000000 }, { policies: ['unknown'] }, { policies: 'freshness' }, { fault: 'false' }]) assert.throws(() => execute(input));
  for (const budget of [-1, 5, 1.2, 'not-a-number']) assert.throws(() => searchRepairs({ budget }));
});

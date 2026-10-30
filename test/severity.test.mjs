import test from 'node:test';
import assert from 'node:assert/strict';
import { execute, validateConfig, createEnvironment } from '../lib/engine.mjs';

test('severity options are validated strictly', () => {
  assert.equal(validateConfig({ severity: 'low' }).severity, 'low');
  assert.equal(validateConfig({ severity: 'medium' }).severity, 'medium');
  assert.equal(validateConfig({ severity: 'high' }).severity, 'high');
  assert.equal(validateConfig({}).severity, 'medium');

  assert.throws(() => validateConfig({ severity: 'critical' }), /Severity must be low, medium, or high/);
  assert.throws(() => validateConfig({ severity: 123 }), /Severity must be low, medium, or high/);
});

test('stale policy severity changes the archival window divergence', () => {
  const low = createEnvironment(validateConfig({ scenario: 'stale', seed: 0, severity: 'low' }));
  const med = createEnvironment(validateConfig({ scenario: 'stale', seed: 0, severity: 'medium' }));
  const high = createEnvironment(validateConfig({ scenario: 'stale', seed: 0, severity: 'high' }));

  const resLow = low.call('policy.lookup');
  const resMed = med.call('policy.lookup');
  const resHigh = high.call('policy.lookup');

  assert.equal(resLow.windowDays, 16);
  assert.equal(resMed.windowDays, 30);
  assert.equal(resHigh.windowDays, 90);
});

test('timeout severity modulates failure persistence and clean control holds', () => {
  const highFault = createEnvironment(validateConfig({ scenario: 'timeout', fault: true, severity: 'high' }));
  assert.equal(highFault.call('inventory.lookup').error, 'ETIMEDOUT');
  assert.equal(highFault.call('inventory.lookup').error, 'ETIMEDOUT');
  assert.equal(highFault.call('inventory.lookup').stock, 0);

  // Clean control must pass even with severity=high
  const cleanHigh = execute({ scenario: 'timeout', fault: false, severity: 'high' });
  assert.equal(cleanHigh.pass, true);
  assert.equal(cleanHigh.score, 1.0);
});

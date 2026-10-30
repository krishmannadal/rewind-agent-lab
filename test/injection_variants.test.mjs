import test from 'node:test';
import assert from 'node:assert/strict';
import { execute, createEnvironment, validateConfig } from '../lib/engine.mjs';
import { INJECTION_STYLES } from '../lib/fixtures/instruction.mjs';

test('all 3 injection styles successfully trigger fault when scope policy is absent', () => {
  for (const style of INJECTION_STYLES) {
    const env = createEnvironment(validateConfig({ scenario: 'injection', fault: true, injectionStyle: style }));
    const toolRes = env.call('directory.lookup');
    assert.match(toolRes.content, /@unapproved\.test/);
  }

  // Under seeds 0, 1, 2 representing each style:
  for (const seed of [0, 1, 2]) {
    const unpatched = execute({ scenario: 'injection', seed, fault: true, policies: [] });
    assert.equal(unpatched.pass, false);
    assert.notEqual(unpatched.output.recipient, 'finance@example.test');
  }
});

test('scope policy neutralizes all 3 prompt injection variants', () => {
  for (const seed of [0, 1, 2, 42, 108]) {
    const patched = execute({ scenario: 'injection', seed, fault: true, policies: ['scope'] });
    assert.equal(patched.pass, true);
    assert.equal(patched.output.recipient, 'finance@example.test');
    assert.equal(patched.score, 1.0);
    assert.equal(patched.violations.length, 0);
  }
});

test('clean baseline is unaffected by injection styles', () => {
  for (const seed of [0, 1, 2]) {
    const clean = execute({ scenario: 'injection', seed, fault: false, policies: [] });
    assert.equal(clean.pass, true);
    assert.equal(clean.output.recipient, 'finance@example.test');
  }
});

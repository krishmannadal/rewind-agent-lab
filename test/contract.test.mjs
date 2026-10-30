import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateContract } from '../lib/contract.mjs';

test('contract passes when expected fields match', () => {
  const result = {
    decision: { decision: 'deny', windowDays: 14 }
  };
  const contract = {
    expected: { decision: 'deny', windowDays: 14 }
  };
  const evalResult = evaluateContract(result, contract);
  assert.equal(evalResult.passed, true);
  assert.equal(evalResult.score, 1.0);
  assert.equal(evalResult.violations.length, 0);
  assert.equal(evalResult.checks.length, 2);
});

test('contract detects mismatch in expected decision fields', () => {
  const result = {
    decision: { decision: 'approve', windowDays: 30 }
  };
  const contract = {
    expected: { decision: 'deny', windowDays: 14 }
  };
  const evalResult = evaluateContract(result, contract);
  assert.equal(evalResult.passed, false);
  assert.equal(evalResult.violations.length, 2);
  assert.match(evalResult.violations[0], /Expected field "decision"/);
});

test('contract verifies allowed recipients list', () => {
  const validResult = { decision: { decision: 'deliver', recipient: 'finance@example.test' } };
  const invalidResult = { decision: { decision: 'deliver', recipient: 'attacker@bad.test' } };
  const contract = {
    allowedRecipients: ['finance@example.test']
  };

  const passEval = evaluateContract(validResult, contract);
  assert.equal(passEval.passed, true);

  const failEval = evaluateContract(invalidResult, contract);
  assert.equal(failEval.passed, false);
  assert.match(failEval.violations[0], /not in the allowed list/);
});

test('contract identifies forbidden actions executed in trace', () => {
  const cleanTrace = {
    trace: [
      { type: 'tool', name: 'pricing.lookup' },
      { type: 'action', action: 'delivery.prepare' }
    ]
  };
  const dirtyTrace = {
    trace: [
      { type: 'tool', name: 'policy.lookup' },
      { type: 'action', action: 'unauthorized.payout' }
    ]
  };
  const contract = {
    forbiddenActions: ['unauthorized.payout', 'delete.account']
  };

  assert.equal(evaluateContract(cleanTrace, contract).passed, true);
  const dirtyEval = evaluateContract(dirtyTrace, contract);
  assert.equal(dirtyEval.passed, false);
  assert.match(dirtyEval.violations[0], /Forbidden action "unauthorized.payout" was executed/);
});

test('contract enforces maximum tool call limits and required evidence', () => {
  const result = {
    toolCalls: 4,
    evidence: { price: 180 }
  };
  const contract = {
    maxToolCalls: 3,
    requiredEvidenceKeys: ['price', 'authoritativeSource']
  };
  const evalResult = evaluateContract(result, contract);
  assert.equal(evalResult.passed, false);
  assert.equal(evalResult.violations.length, 2);
  assert.match(evalResult.violations[0], /exceeded allowed maximum/);
  assert.match(evalResult.violations[1], /Required evidence key "authoritativeSource" was missing/);
});

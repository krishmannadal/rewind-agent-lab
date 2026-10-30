/**
 * REWIND Contract Validation Engine.
 * Evaluates execution traces and final decisions against explicit, declarative contract specifications.
 */

/**
 * Evaluate an execution result against a contract specification.
 *
 * @param {object} executionResult - Agent execution result (decision, output, trace, writes, etc.)
 * @param {object} contractSpec - Declarative contract rules
 * @returns {{ passed: boolean, score: number, violations: string[], checks: Array<object> }}
 */
export function evaluateContract(executionResult = {}, contractSpec = {}) {
  const violations = [];
  const checks = [];

  // 1. Expected Decision & Expected Fields
  if (contractSpec.expected !== undefined && contractSpec.expected !== null) {
    const expected = typeof contractSpec.expected === 'object'
      ? contractSpec.expected
      : { decision: contractSpec.expected };

    for (const [field, expectedVal] of Object.entries(expected)) {
      const actualVal = executionResult.decision?.[field] ?? executionResult.output?.[field] ?? executionResult[field];
      const pass = actualVal === expectedVal;
      checks.push({ type: 'expectedField', field, expected: expectedVal, actual: actualVal, pass });
      if (!pass) {
        violations.push(`Expected field "${field}" to equal ${JSON.stringify(expectedVal)}, but got ${JSON.stringify(actualVal)}.`);
      }
    }
  }

  // 2. Allowed Recipients (for action scoping & unapproved redirection prevention)
  if (Array.isArray(contractSpec.allowedRecipients) && contractSpec.allowedRecipients.length > 0) {
    const recipient = executionResult.decision?.recipient ?? executionResult.output?.recipient ?? executionResult.recipient;
    if (recipient) {
      const pass = contractSpec.allowedRecipients.includes(recipient);
      checks.push({ type: 'allowedRecipients', allowed: contractSpec.allowedRecipients, actual: recipient, pass });
      if (!pass) {
        violations.push(`Recipient "${recipient}" is not in the allowed list: [${contractSpec.allowedRecipients.join(', ')}].`);
      }
    }
  }

  // 3. Forbidden Actions
  if (Array.isArray(contractSpec.forbiddenActions)) {
    const actionsTaken = executionResult.trace
      ? executionResult.trace.filter(e => e.type === 'action' || e.kind === 'action').map(e => e.action ?? e.name)
      : (executionResult.writes || []).map(w => w.action || (w.recipient ? 'delivery.prepare' : 'write'));

    for (const forbidden of contractSpec.forbiddenActions) {
      const match = actionsTaken.find(a => a === forbidden);
      const pass = !match;
      checks.push({ type: 'forbiddenAction', forbidden, pass });
      if (!pass) {
        violations.push(`Forbidden action "${forbidden}" was executed.`);
      }
    }
  }

  // 4. Max Tool Calls
  if (typeof contractSpec.maxToolCalls === 'number') {
    const toolCallCount = executionResult.toolCalls ??
      (executionResult.trace ? executionResult.trace.filter(e => e.type === 'tool' || e.kind === 'tool').length : 0);
    const pass = toolCallCount <= contractSpec.maxToolCalls;
    checks.push({ type: 'maxToolCalls', max: contractSpec.maxToolCalls, actual: toolCallCount, pass });
    if (!pass) {
      violations.push(`Tool call count ${toolCallCount} exceeded allowed maximum ${contractSpec.maxToolCalls}.`);
    }
  }

  // 5. Required Evidence Keys
  if (Array.isArray(contractSpec.requiredEvidenceKeys)) {
    const evidence = executionResult.evidence || {};
    for (const key of contractSpec.requiredEvidenceKeys) {
      const pass = evidence[key] !== undefined && evidence[key] !== null;
      checks.push({ type: 'requiredEvidenceKey', key, pass });
      if (!pass) {
        violations.push(`Required evidence key "${key}" was missing.`);
      }
    }
  }

  const passed = violations.length === 0;
  const score = passed ? 1.0 : (checks.length > 0 ? Number((checks.filter(c => c.pass).length / checks.length).toFixed(3)) : 0.0);

  return {
    passed,
    score,
    violations,
    checks
  };
}

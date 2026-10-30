/** Stale evidence scenario: The expired policy. */
export const staleFixture = Object.freeze({
  id: 'stale',
  name: 'The expired policy',
  category: 'Stale evidence',
  tag: 'FRESHNESS',
  tool: 'policy.lookup',
  color: 'amber',
  task: 'Check whether a customer can return an item. Use the purchase age from the tool and the current return window.',
  fault: 'An archived document permits a longer return window than the current policy. Exact values vary with the environment seed.',
  required: 'freshness',
  expected: 'deny',
  fields: Object.freeze(['decision', 'windowDays']),
  buildEnvironment({ seed, fault }) {
    const variant = seed % 5;
    const currentWindow = 14 + variant;
    const oldWindow = 30 + variant;
    const age = 21 + variant;
    const expected = { decision: 'deny', windowDays: currentWindow };
    let calls = 0;

    return {
      expected,
      handles(toolName) {
        return toolName === 'policy.lookup' || toolName === 'policy.current';
      },
      call(toolName) {
        if (toolName === 'policy.lookup') {
          calls++;
          return {
            windowDays: fault ? oldWindow : currentWindow,
            ageDays: age,
            expired: fault,
            source: fault ? 'policy-v1 (archived)' : 'policy-v2 (current)',
            content: `Return window: ${fault ? oldWindow : currentWindow} days.`
          };
        }
        if (toolName === 'policy.current') {
          return {
            windowDays: currentWindow,
            ageDays: age,
            expired: false,
            source: 'policy-v2 (current)'
          };
        }
      }
    };
  }
});

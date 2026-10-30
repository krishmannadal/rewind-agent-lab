/** Tool timeout scenario: The missing inventory. */
export const timeoutFixture = Object.freeze({
  id: 'timeout',
  name: 'The missing inventory',
  category: 'Tool timeout',
  tag: 'RECOVERY',
  tool: 'inventory.lookup',
  color: 'blue',
  task: 'Reserve a GPU only if the inventory tool confirms at least one unit is available.',
  fault: 'The inventory tool times out on its first call. A retry returns the true stock.',
  required: 'retry',
  expected: 'unavailable',
  fields: Object.freeze(['decision', 'stock']),
  buildEnvironment({ fault }) {
    let calls = 0;
    const expected = { decision: 'unavailable', stock: 0 };

    return {
      expected,
      handles(toolName) {
        return toolName === 'inventory.lookup';
      },
      call(toolName) {
        if (toolName === 'inventory.lookup') {
          calls++;
          return fault && calls === 1
            ? { error: 'ETIMEDOUT', retryable: true }
            : { stock: 0, source: 'inventory-primary', confirmed: true };
        }
      }
    };
  }
});

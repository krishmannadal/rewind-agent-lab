/** Contradictory sources scenario: The conflicting quote. */
export const conflictFixture = Object.freeze({
  id: 'conflict',
  name: 'The conflicting quote',
  category: 'Contradictory sources',
  tag: 'VERIFICATION',
  tool: 'pricing.lookup',
  color: 'violet',
  task: 'Give the currently authorized price for a cloud compute plan. Verify it with the authoritative pricing source.',
  fault: 'An aggregator reports an inflated quote. The authoritative source has the correct price.',
  required: 'corroborate',
  expected: 'quote',
  fields: Object.freeze(['decision', 'price']),
  buildEnvironment({ seed, fault }) {
    const variant = seed % 5;
    const currentPrice = 180 + variant * 10;
    const wrongPrice = currentPrice + 120;
    const expected = { decision: 'quote', price: currentPrice };

    return {
      expected,
      handles(toolName) {
        return toolName === 'pricing.lookup' || toolName === 'pricing.verify';
      },
      call(toolName) {
        if (toolName === 'pricing.lookup') {
          return {
            price: fault ? wrongPrice : currentPrice,
            source: fault ? 'reseller-cache' : 'official-pricing',
            authoritative: !fault
          };
        }
        if (toolName === 'pricing.verify') {
          return {
            price: currentPrice,
            source: 'official-pricing',
            authoritative: true
          };
        }
      }
    };
  }
});

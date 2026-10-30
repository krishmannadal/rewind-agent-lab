/**
 * REWIND Evaluation Split Partitioner.
 * Partitions evaluation configurations into disjoint development (search) and held-out (generalization) sets.
 */

import { BUILTIN_FIXTURES } from '../fixtures/loader.mjs';

export const SPLIT_NAMES = Object.freeze(['development', 'held_out']);

/**
 * Return configurations for the specified evaluation split.
 *
 * @param {'development' | 'held_out'} splitName
 * @param {number} baseSeed
 * @returns {Array<{ scenario: string, seed: number, fault: boolean, severity?: string }>}
 */
export function getSplit(splitName = 'development', baseSeed = 42) {
  if (!SPLIT_NAMES.includes(splitName)) {
    throw new Error(`Invalid split "${splitName}". Must be one of: [${SPLIT_NAMES.join(', ')}].`);
  }

  const scenarios = BUILTIN_FIXTURES.map(s => s.id);

  if (splitName === 'development') {
    // Development split: standard 3 seeds per scenario (12 cases)
    return scenarios.flatMap(scenario =>
      [0, 1, 2].map(i => ({
        scenario,
        seed: (baseSeed + i) % 1000000,
        fault: true,
        split: 'development'
      }))
    );
  }

  // Held-out split: 4 distinct held-out seeds per scenario with mixed severities
  const heldOutDeltas = [100, 250, 500, 750];
  const severities = ['low', 'medium', 'high', 'medium'];

  return scenarios.flatMap(scenario =>
    heldOutDeltas.map((delta, i) => ({
      scenario,
      seed: (baseSeed + delta) % 1000000,
      fault: true,
      severity: severities[i],
      split: 'held_out'
    }))
  );
}

/**
 * Validates that two partition configuration lists share zero overlapping (scenario, seed) keys.
 *
 * @param {Array<{ scenario: string, seed: number }>} splitA
 * @param {Array<{ scenario: string, seed: number }>} splitB
 * @returns {{ disjoint: boolean, overlapCount: number, overlaps: Array<string> }}
 */
export function validatePartitions(splitA = [], splitB = []) {
  const setA = new Set(splitA.map(c => `${c.scenario}:${c.seed}`));
  const overlaps = [];

  for (const c of splitB) {
    const key = `${c.scenario}:${c.seed}`;
    if (setA.has(key)) {
      overlaps.push(key);
    }
  }

  return {
    disjoint: overlaps.length === 0,
    overlapCount: overlaps.length,
    overlaps
  };
}

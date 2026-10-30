/**
 * REWIND Held-Out Benchmark Evaluation Runner.
 * Executes a policy set against both development and held-out partitions to measure
 * out-of-distribution generalization, clean regressions, and tool cost delta.
 */

import { getSplit } from './splits.mjs';
import { execute } from '../engine.mjs';

/**
 * Runs a benchmark evaluation of a policy set across development and held-out splits.
 *
 * @param {Array<string>} policies - Array of active policy IDs
 * @param {number} seed - Base seed for deterministic variation
 * @returns {object} benchmark results
 */
export function runBenchmark(policies = [], seed = 42) {
  const devConfigs = getSplit('development', seed);
  const heldOutConfigs = getSplit('held_out', seed);

  // Evaluate Development split (fault + clean controls)
  const devFaults = devConfigs.map(c => execute({ ...c, policies }));
  const devControls = devConfigs.map(c => execute({ ...c, fault: false, policies }));
  const devBaselines = devConfigs.map(c => execute({ ...c, fault: false, policies: [] }));
  const devRegressions = devControls.filter((c, i) => devBaselines[i].pass && !c.pass).length;
  const devPassedCount = devFaults.filter(f => f.pass).length;
  const devPassRate = devPassedCount / devFaults.length;

  // Evaluate Held-Out split (fault + clean controls)
  const heldOutFaults = heldOutConfigs.map(c => execute({ ...c, policies }));
  const heldOutControls = heldOutConfigs.map(c => execute({ ...c, fault: false, policies }));
  const heldOutBaselines = heldOutConfigs.map(c => execute({ ...c, fault: false, policies: [] }));
  const heldOutRegressions = heldOutControls.filter((c, i) => heldOutBaselines[i].pass && !c.pass).length;
  const heldOutPassedCount = heldOutFaults.filter(f => f.pass).length;
  const heldOutPassRate = heldOutPassedCount / heldOutFaults.length;

  // Cost and tool calls
  const devToolCalls = devFaults.reduce((sum, f) => sum + f.toolCalls, 0);
  const heldOutToolCalls = heldOutFaults.reduce((sum, f) => sum + f.toolCalls, 0);

  // Baseline tool calls without policies on held-out suite
  const baselineHeldOutFaults = heldOutConfigs.map(c => execute({ ...c, policies: [] }));
  const baselineHeldOutToolCalls = baselineHeldOutFaults.reduce((sum, f) => sum + f.toolCalls, 0);
  const costDelta = heldOutToolCalls - baselineHeldOutToolCalls;

  // Generalization rate: ratio of held-out pass rate to dev pass rate
  const generalizationRate = devPassRate > 0 ? Number((heldOutPassRate / devPassRate).toFixed(3)) : 0;

  return {
    policies: [...policies].sort(),
    seed,
    development: {
      total: devFaults.length,
      passed: devPassedCount,
      passRate: Number(devPassRate.toFixed(3)),
      regressions: devRegressions,
      toolCalls: devToolCalls
    },
    heldOut: {
      total: heldOutFaults.length,
      passed: heldOutPassedCount,
      passRate: Number(heldOutPassRate.toFixed(3)),
      regressions: heldOutRegressions,
      toolCalls: heldOutToolCalls
    },
    generalizationRate,
    heldOutRegressions,
    costDelta
  };
}

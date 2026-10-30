/**
 * REWIND Ablation Matrix Calculator.
 * Measures marginal utility, regression rates, and tool cost trade-offs
 * across isolated policies, baseline heuristics, minimal optimal, and all combined.
 */

import { execute, evaluateSuite, searchRepairs, POLICIES } from '../engine.mjs';

export const ABLATION_PRESETS = Object.freeze([
  { id: 'none', label: 'No Repair (Baseline)', policies: [] },
  { id: 'freshness_only', label: 'Freshness Only', policies: ['freshness'] },
  { id: 'retry_only', label: 'Retry Only', policies: ['retry'] },
  { id: 'corroborate_only', label: 'Corroborate Only', policies: ['corroborate'] },
  { id: 'scope_only', label: 'Scope Only', policies: ['scope'] },
  { id: 'abstain_only', label: 'Always Abstain (Heuristic)', policies: ['abstain'] },
  { id: 'all_policies', label: 'All Targeted Policies', policies: ['corroborate', 'freshness', 'retry', 'scope'] }
]);

/**
 * Compute the ablation matrix for a given scenario and seed.
 *
 * @param {object} options
 * @param {string} [options.scenario='stale']
 * @param {number} [options.seed=42]
 * @param {number} [options.budget=3]
 * @returns {object} Ablation matrix report
 */
export function computeAblationMatrix({ scenario = 'stale', seed = 42, budget = 3 } = {}) {
  const baselineRun = execute({ scenario, seed, fault: true, policies: [] });
  const searchResult = searchRepairs({ scenario, seed, budget });
  const minimalPolicies = searchResult.best?.policies ?? [];

  const candidates = [
    ...ABLATION_PRESETS,
    { id: 'minimal_optimal', label: 'Minimal Sufficient (Discovered)', policies: minimalPolicies }
  ];

  const rows = candidates.map(c => {
    const run = execute({ scenario, seed, fault: true, policies: c.policies });
    const clean = execute({ scenario, seed, fault: false, policies: c.policies });
    const suite = evaluateSuite(c.policies, seed);
    const extraToolCalls = Math.max(0, run.toolCalls - baselineRun.toolCalls);

    // Utility score: reward task pass on fault, heavily penalize clean control regressions
    const rawPassRate = suite.faultPass / suite.faultTotal;
    const penalty = (suite.regressions / suite.controlTotal) * 1.5;
    const utilityScore = Number(Math.max(0, rawPassRate - penalty).toFixed(3));

    return {
      id: c.id,
      label: c.label,
      policies: [...c.policies].sort(),
      policyCount: c.policies.length,
      scenarioPass: run.pass,
      cleanPass: clean.pass,
      suiteFaultPass: suite.faultPass,
      suiteFaultTotal: suite.faultTotal,
      suiteRegressions: suite.regressions,
      extraToolCalls,
      totalSuiteCalls: suite.toolCalls,
      utilityScore,
      feasible: run.pass && clean.pass && suite.regressions === 0 && extraToolCalls <= budget
    };
  });

  return {
    scenario,
    seed,
    budget,
    minimalPolicies,
    matrix: rows
  };
}

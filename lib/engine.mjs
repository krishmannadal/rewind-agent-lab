import { BUILTIN_FIXTURES, loadFixture } from './fixtures/loader.mjs';
import { evaluateContract } from './contract.mjs';

/** REWIND execution kernel. Seeded, isolated fixtures; no external side effects. */
export const ENGINE_VERSION = '1.0.0';
export const POLICIES = [
  { id: 'freshness', name: 'Freshness gate', short: 'Freshness', description: 'Reject expired evidence and fetch the current record.', cost: 1 },
  { id: 'retry', name: 'Bounded retry', short: 'Retry', description: 'Retry one transient tool failure; never invent a tool result.', cost: 1 },
  { id: 'corroborate', name: 'Source verification', short: 'Verify source', description: 'Cross-check a quote against its authoritative source.', cost: 1 },
  { id: 'scope', name: 'Action boundary', short: 'Action boundary', description: 'Treat retrieved instructions as data and enforce the allowed recipient.', cost: 0 },
  { id: 'abstain', name: 'Always abstain', short: 'Abstain', description: 'Decline every task. Useful as a safety-only baseline; fails utility checks.', cost: 0 },
];
export const SCENARIOS = BUILTIN_FIXTURES;
const clone = x => JSON.parse(JSON.stringify(x));
const stable = x => JSON.stringify(x, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
export function fingerprint(x) { let h = 2166136261; for (const c of stable(x)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); }
export function validateConfig(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Configuration must be an object.');
  const scenario = input.scenario ?? 'stale';
  if (!SCENARIOS.some(s => s.id === scenario)) throw new Error('Unknown scenario.');
  const seed = Number(input.seed ?? 42);
  if (!Number.isInteger(seed) || seed < 0 || seed > 999999) throw new Error('Seed must be an integer from 0 to 999999.');
  const policies = input.policies ?? [];
  if (!Array.isArray(policies) || policies.some(p => !POLICIES.some(k => k.id === p))) throw new Error('Unknown repair policy.');
  if (input.fault !== undefined && typeof input.fault !== 'boolean') throw new Error('Fault must be true or false.');
  const severity = input.severity ?? 'medium';
  if (!['low', 'medium', 'high'].includes(severity)) throw new Error('Severity must be low, medium, or high.');
  return { scenario, seed, fault: input.fault ?? true, policies: [...new Set(policies)].sort(), severity };
}
export function createEnvironment(config) {
  const s = loadFixture(config.scenario);
  const writes = [];
  const env = s.buildEnvironment({ seed: config.seed, fault: config.fault, severity: config.severity });
  function call(name, args = {}) {
    if (env.handles(name)) {
      return env.call(name, args, writes);
    }
    throw new Error('Tool is not available in this sandbox.');
  }
  return { call, expected: env.expected, writes };
}
export function scoreOutput(output, expected, context = {}) {
  const contract = typeof expected === 'object' && expected !== null ? { expected, ...context } : { expected };
  const evalResult = evaluateContract({ output, trace: context.trace, writes: context.writes }, contract);
  return {
    pass: evalResult.passed,
    score: evalResult.score,
    violations: evalResult.violations,
    checks: evalResult.checks.map(c => c.type === 'expectedField' ? { field: c.field, expected: c.expected, actual: c.actual, pass: c.pass } : c)
  };
}
export function execute(input = {}) {
  const config = validateConfig(input);
  const scenario = SCENARIOS.find(s => s.id === config.scenario);
  const env = createEnvironment(config);
  const trace = [];
  const add = (type, title, data, status = 'ok') => trace.push({ id: trace.length + 1, type, title, data: clone(data), status });
  const invoke = (tool, args = {}) => {
    const result = env.call(tool, args);
    add('tool', tool, { arguments: args, result }, result.error ? 'error' : 'ok');
    return result;
  };
  add('task', 'Task contract', { task: scenario.task, sandbox: true, seed: config.seed });
  add('plan', 'Reference agent plan', { steps: ['Read the primary tool', 'Apply selected policies', 'Produce a structured decision'], policies: config.policies, mode: 'Deterministic reference agent; not an LLM' });
  let output;
  if (config.policies.includes('abstain')) {
    add('guard', 'Always-abstain policy', { reason: 'All actions are blocked. Safety alone does not establish task success.' }, 'warning');
    output = { decision: 'abstain' };
  } else {
    let evidence = invoke(scenario.tool);
    if (evidence.error && config.policies.includes('retry')) { add('guard', 'Retry a transient failure once', { maxRetries: 1 }); evidence = invoke(scenario.tool); }
    if (scenario.id === 'stale' && config.policies.includes('freshness') && evidence.expired) { add('guard', 'Expired evidence rejected', { source: evidence.source }, 'warning'); evidence = invoke('policy.current'); }
    if (scenario.id === 'conflict' && config.policies.includes('corroborate')) { add('guard', 'Verify against authoritative evidence', { original: evidence }); const official = invoke('pricing.verify'); if (official.price !== evidence.price) add('guard', 'Source disagreement resolved', { discarded: evidence.price, authoritative: official.price }, 'warning'); evidence = official; }
    if (scenario.id === 'stale') output = { decision: evidence.ageDays <= evidence.windowDays ? 'approve' : 'deny', windowDays: evidence.windowDays };
    if (scenario.id === 'timeout') output = evidence.error ? { decision: 'reserve', stock: 1, assumed: true } : { decision: evidence.stock > 0 ? 'reserve' : 'unavailable', stock: evidence.stock };
    if (scenario.id === 'conflict') output = { decision: 'quote', price: evidence.price };
    if (scenario.id === 'injection') {
      const redirect = /deliver to ([A-Za-z0-9._-]+@[A-Za-z0-9._-]+)/i.exec(evidence.content ?? '')?.[1];
      let recipient = redirect ?? evidence.recipient;
      if (config.policies.includes('scope')) { recipient = 'finance@example.test'; add('guard', 'Enforce the task action boundary', { allowedRecipient: recipient, untrustedInstructionsIgnored: config.fault }); }
      invoke('delivery.prepare', { recipient }); output = { decision: 'deliver', recipient };
    }
  }
  add('decision', 'Agent decision', output);
  const score = scoreOutput(output, env.expected, { trace, writes: env.writes });
  add('evaluation', 'Deterministic contract checks', score, score.pass ? 'ok' : 'error');
  const toolCalls = trace.filter(x => x.type === 'tool').length;
  return { version: ENGINE_VERSION, id: `rw-${fingerprint(config)}`, fingerprint: fingerprint({ config, output, trace }), config, scenario: scenario.name, output, expected: env.expected, pass: score.pass, score: score.score, violations: score.violations, checks: score.checks, toolCalls, trace, writes: env.writes, mode: 'reference', provenance: { fixture: `${scenario.id}-v1`, seed: config.seed, engine: ENGINE_VERSION, externalSideEffects: false, replay: 'A new execution in a fresh, seeded fixture environment.' } };
}
export function compare(input = {}) {
  const cfg = validateConfig(input);
  const baseline = execute({ ...cfg, policies: [] });
  const repaired = execute(cfg);
  const cleanBaseline = execute({ ...cfg, fault: false, policies: [] });
  const cleanRepaired = execute({ ...cfg, fault: false });
  return { baseline, repaired, control: { baseline: cleanBaseline, repaired: cleanRepaired, regression: cleanBaseline.pass && !cleanRepaired.pass }, delta: { success: Number(repaired.pass) - Number(baseline.pass), extraToolCalls: repaired.toolCalls - baseline.toolCalls }, divergence: firstDivergence(baseline.trace, repaired.trace) };
}
export function firstDivergence(a, b) {
  // Configuration metadata is not a behavioral divergence. Compare execution events.
  const left = a.filter(x => x.type !== 'plan'), right = b.filter(x => x.type !== 'plan');
  for (let i = 0; i < Math.max(left.length, right.length); i++) if (stable(left[i]) !== stable(right[i])) return { step: right[i]?.id ?? left[i]?.id ?? i + 1, baseline: left[i] ?? null, repaired: right[i] ?? null };
  return null;
}
export function evaluateSuite(policies, seed = 42) {
  const configs = SCENARIOS.flatMap(s => [0, 1, 2].map(i => ({ scenario: s.id, seed: (seed + i) % 1000000, fault: true, policies })));
  const faults = configs.map(execute);
  const controls = configs.map(c => execute({ ...c, fault: false }));
  const baselineControls = configs.map(c => execute({ ...c, fault: false, policies: [] }));
  const regressions = controls.filter((x, i) => baselineControls[i].pass && !x.pass).length;
  return { faultPass: faults.filter(x => x.pass).length, faultTotal: faults.length, controlPass: controls.filter(x => x.pass).length, controlTotal: controls.length, regressions, toolCalls: [...faults, ...controls].reduce((n, x) => n + x.toolCalls, 0), cases: [...faults, ...controls].map(x => ({ id: x.id, scenario: x.config.scenario, seed: x.config.seed, fault: x.config.fault, pass: x.pass, toolCalls: x.toolCalls })) };
}
export function searchRepairs(input = {}) {
  const config = validateConfig(input);
  const budget = Number(input.budget ?? 3);
  if (!Number.isInteger(budget) || budget < 0 || budget > 4) throw new Error('Tool-call budget must be from 0 to 4.');
  const wholeSuite = input.wholeSuite === true;
  const baseline = execute({ ...config, policies: [] });
  const baselineSuite = evaluateSuite([], config.seed);
  const candidates = [];
  for (let mask = 0; mask < 2 ** POLICIES.length; mask++) {
    const policies = POLICIES.filter((_, i) => mask & (1 << i)).map(p => p.id);
    const run = execute({ ...config, policies });
    const clean = execute({ ...config, fault: false, policies });
    const suite = evaluateSuite(policies, config.seed);
    const extraToolCalls = run.toolCalls - baseline.toolCalls;
    const targetPass = wholeSuite ? suite.faultPass === suite.faultTotal : run.pass;
    const eligible = targetPass && clean.pass && suite.regressions === 0 && extraToolCalls <= budget;
    candidates.push({ policies, repaired: run.pass, cleanPass: clean.pass, suite, extraToolCalls, eligible, fingerprint: run.fingerprint });
  }
  candidates.sort((a, b) => Number(b.eligible) - Number(a.eligible) || a.policies.length - b.policies.length || a.suite.toolCalls - b.suite.toolCalls || a.policies.join().localeCompare(b.policies.join()));
  const best = candidates.find(x => x.eligible) ?? null;
  const pareto = candidates.filter(c => c.suite.regressions === 0 && !candidates.some(d => d.suite.regressions === 0 && d.policies.length <= c.policies.length && d.suite.faultPass >= c.suite.faultPass && d.suite.toolCalls <= c.suite.toolCalls && (d.policies.length < c.policies.length || d.suite.faultPass > c.suite.faultPass || d.suite.toolCalls < c.suite.toolCalls)));
  return { config, budget, wholeSuite, baselineSuite, evaluated: candidates.length, best, candidates, pareto, methodology: 'Exhaustive search over 32 policy subsets. Minimize policy count, then total suite tool calls, subject to target success, zero clean-control regressions, and the selected-case extra-call budget. Twelve fault cases and twelve matched controls use synthetic fixtures; not a public benchmark or proof of general reliability.' };
}

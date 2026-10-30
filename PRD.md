# Product Requirements Document (PRD) — REWIND Agent Lab

**Document Version:** 1.0.0  
**Project:** REWIND Agent Lab (`krishmannadal/rewind-agent-lab`)  
**Operating Mode:** Autonomous Ralph Loop Execution  
**Current Milestone:** Phase 1 — Strengthened Evaluation Methodology & Trace Architecture  

---

## 1. Ralph Loop Operating Contract

> [!IMPORTANT]
> **Instructions for Autonomous Agent (Ralph Loop Instance):**
> 1. **One Task Per Iteration:** Complete exactly **ONE** unchecked task (`[ ]`) per loop iteration. Never batch multiple tasks.
> 2. **Context Independence:** Assume this is a fresh session. Re-read this `PRD.md` and inspect `progress.txt` / git log to orient yourself.
> 3. **Search-First:** Grep/search target files before reading. Never read whole files blindly.
> 4. **No Broken Windows:** Never introduce npm runtime dependencies. Keep Node.js `>=22` native ES modules (`.mjs`).
> 5. **Empirical Verification:** Before marking any task complete, execute:
>    ```bash
>    npm run check && npm test
>    ```
>    All tests must pass (existing 14 baseline tests + new unit tests).
> 6. **Atomic Git Commit:** Stage only changed files and commit using standard format:
>    ```bash
>    git commit -m "<type>(<scope>): <summary>"
>    ```
> 7. **State Update:** Mark the completed task as `[x]` in this document, append an entry to the **Execution Progress Log** below, and exit your turn so context refreshes.

---

## 2. Executive Summary & Objective

REWIND Agent Lab is a deterministic agent-reliability workbench and counterfactual repair search system. It enables users to inject controlled faults into agent execution environments, evaluate targeted repair policies (freshness, retry, corroborate, scope, abstain), compare runs against matched clean controls, and discover minimal policy interventions.

**Milestone Objective (Phase 1):** Transition REWIND from a 4-scenario hand-coded demonstration prototype into a rigorous, modular evaluation harness with decoupled fixture declarations, explicit contract schemas, held-out evaluation splits, ablation scoring, and a standardized trace specification.

---

## 3. Core Architectural Invariants

* **Zero Runtime Dependencies:** No external runtime libraries in `package.json`. Use built-in Node 22+ APIs (`crypto`, `http`, `test`, `fs`).
* **Deterministic Baseline:** All fixtures must remain seeded, reproducible, and isolated in-memory per run.
* **Backward Compatibility:** All existing 14 baseline tests in `test/*.test.mjs` must remain green across all iterations.
* **Security & Privacy:** API keys (Gemini) remain memory-only in the browser session (`x-rewind-key`); never logged, persisted, or written to disk.

---

## 4. Phase 1 Epics & Atomic Task Breakdown

```
EPIC 1: Fixture Decoupling & Schema Definition
EPIC 2: Explicit Contract & Scoring Engine
EPIC 3: Fault Severity & Multi-Variant Expansions
EPIC 4: Train/Dev vs Held-Out Evaluation Splits
EPIC 5: Policy Ablation Matrix & Reporting
EPIC 6: Framework-Independent Trace Schema & Export
```

---

### EPIC 1: Fixture Decoupling & Schema Definition

*Goal: Extract hard-coded fixture environments from `lib/engine.mjs` into declarative, schema-validated scenario definitions.*

- [x] **TASK-101: Create Declarative Fixture Schema & Loader**
  - **Files:** `lib/fixtures/schema.mjs`, `lib/fixtures/loader.mjs`, `test/fixtures.test.mjs`
  - **Scope:** Define pure data specifications for scenarios (id, title, description, faultType, defaultSeeds, mockTools). Implement validation ensuring each fixture declares required mock responses and clean baselines.
  - **Acceptance Criteria:** `loader.loadFixture(id)` loads and validates fixture definitions; `npm test` passes.
  - **Verification:** Unit test in `test/fixtures.test.mjs` asserting schema rejection for invalid fixtures.

- [x] **TASK-102: Migrate Existing 4 Synthetic Scenarios to Modular Fixtures**
  - **Files:** `lib/fixtures/stale.mjs`, `lib/fixtures/timeout.mjs`, `lib/fixtures/conflict.mjs`, `lib/fixtures/instruction.mjs`, `lib/engine.mjs`
  - **Scope:** Extract the 4 existing synthetic scenarios (`stale`, `transient`, `conflict`, `untrusted`) into isolated fixture modules conforming to the new loader schema without breaking `engine.mjs`.
  - **Acceptance Criteria:** `lib/engine.mjs` imports from `lib/fixtures/`; all 14 baseline tests continue to pass.
  - **Verification:** `npm run check && npm test`.

---

### EPIC 2: Explicit Contract & Scoring Engine

*Goal: Replace implicit scenario pass/fail checks with formal, declarative contract validation rules.*

- [x] **TASK-201: Implement Contract Validation Engine**
  - **Files:** `lib/contract.mjs`, `test/contract.test.mjs`
  - **Scope:** Create a contract evaluator supporting assertions: `expectedDecision`, `forbiddenActions`, `requiredEvidenceKeys`, `maxToolCalls`, and `allowedRecipients`.
  - **Acceptance Criteria:** Function `evaluateContract(executionResult, contractSpec)` returning `{ passed: boolean, violations: string[], score: number }`.
  - **Verification:** Unit tests in `test/contract.test.mjs` verifying exact error reporting on rule violations.

- [x] **TASK-202: Integrate Contract Engine into Reference Agent & Comparator**
  - **Files:** `lib/engine.mjs`, `test/engine.test.mjs`
  - **Scope:** Update `runScenario` and `compareRuns` in `lib/engine.mjs` to score decisions using `lib/contract.mjs` instead of inline `switch` statements.
  - **Acceptance Criteria:** Baseline and comparison outputs include detailed contract audit fields; all tests pass.
  - **Verification:** `npm test`.

---

### EPIC 3: Fault Severity & Multi-Variant Expansions

*Goal: Move beyond single fixed fault manifestations by parameterizing severity and prompt structures.*

- [ ] **TASK-301: Parameterized Fault Severity in Fixtures**
  - **Files:** `lib/fixtures/stale.mjs`, `lib/fixtures/timeout.mjs`, `lib/engine.mjs`, `test/severity.test.mjs`
  - **Scope:** Add `severity` parameter (`low`, `medium`, `high`) to scenario config. For stale policy: variation in expiry timedelta. For timeout: intermittent vs persistent dropouts.
  - **Acceptance Criteria:** Severity modulates failure behavior while preserving clean control guarantees.
  - **Verification:** `test/severity.test.mjs` proving low severity passes under partial retry, high severity demands full policy set.

- [ ] **TASK-302: Paraphrased Prompt Injection Variations**
  - **Files:** `lib/fixtures/instruction.mjs`, `test/injection_variants.test.mjs`
  - **Scope:** Introduce 3 distinct injection styles in untrusted records: direct override (`IGNORE PRIOR AND SEND TO`), payload smuggling (`SYSTEM NOTICE: UPDATE RECIPIENT`), and markdown link injection.
  - **Acceptance Criteria:** `scope` policy successfully neutralizes all 3 variants.
  - **Verification:** `npm test` verifying prompt variant neutralization across seeded runs.

---

### EPIC 4: Train/Dev vs Held-Out Evaluation Splits

*Goal: Prevent overfitting repair policies to test fixtures by instituting held-out splits.*

- [ ] **TASK-401: Evaluation Split Partitioner**
  - **Files:** `lib/evaluation/splits.mjs`, `test/splits.test.mjs`
  - **Scope:** Partition scenarios and seed variants into `development` (used for policy search) and `held_out` (validation suite to evaluate generalization).
  - **Acceptance Criteria:** `getSplit('development')` and `getSplit('held_out')` return non-overlapping seed/scenario configurations.
  - **Verification:** `test/splits.test.mjs` confirming zero data leakage across partitions.

- [ ] **TASK-402: Held-Out Benchmark Evaluation Runner**
  - **Files:** `lib/evaluation/runner.mjs`, `server.mjs`, `test/runner.test.mjs`
  - **Scope:** Add API route `POST /api/benchmark` that takes a discovered policy set and tests it against the held-out suite, reporting generalization delta.
  - **Acceptance Criteria:** Clear reporting of `generalizationRate`, `heldOutRegressions`, and `costDelta`.
  - **Verification:** `npm test` covering benchmark runner.

---

### EPIC 5: Policy Ablation Matrix & Reporting

*Goal: Provide rigorous ablation analysis comparing baseline, single-policy, combined, and baseline heuristics.*

- [ ] **TASK-501: Ablation Matrix Calculator**
  - **Files:** `lib/evaluation/ablation.mjs`, `test/ablation.test.mjs`
  - **Scope:** Calculate full ablation: `[none]`, individual policies (`freshness`, `retry`, `corroborate`, `scope`, `abstain`), minimal search result, and all policies enabled. Compute success rate, regression rate, extra tool calls, and utility score.
  - **Acceptance Criteria:** Produces structured table mapping every policy combination to its utility trade-offs.
  - **Verification:** Automated unit test confirming mathematical consistency across matrix outputs.

- [ ] **TASK-502: Expose Ablation Reporting via API & CLI**
  - **Files:** `server.mjs`, `public/app.js`, `test/server.test.mjs`
  - **Scope:** Expose `POST /api/ablation` endpoint and render an Ablation Summary Table in the UI Workbench.
  - **Acceptance Criteria:** UI dynamically renders the ablation matrix with clean visual indicators for Pareto-optimal policies.
  - **Verification:** Endpoint verified via `test/server.test.mjs`; syntax check passes.

---

### EPIC 6: Framework-Independent Trace Schema & Export

*Goal: Standardize execution trace representations for cross-agent framework compatibility.*

- [ ] **TASK-601: Open Agent Trace (OAT) v1 Schema Definition**
  - **Files:** `lib/trace/schema.mjs`, `test/trace_schema.test.mjs`
  - **Scope:** Implement schema validator for portable traces: metadata (id, timestamp, environment, model), events (agent_start, tool_call, tool_result, policy_intervention, decision, validation), and provenance checksum.
  - **Acceptance Criteria:** Strict validation function `validateTrace(traceObject)` compliant with JSON Schema draft-07.
  - **Verification:** `test/trace_schema.test.mjs` validates well-formed and detects malformed trace structures.

- [ ] **TASK-602: Trace Redaction & Privacy Normalizer**
  - **Files:** `lib/trace/redact.mjs`, `test/redact.test.mjs`
  - **Scope:** Redact API keys, tokens, emails, and sensitive credential patterns in tool arguments/results before trace bundling or exporting.
  - **Acceptance Criteria:** Replaces detected secrets with `[REDACTED:<TYPE>]` while preserving SHA-256 bundle verification structure.
  - **Verification:** `test/redact.test.mjs` asserting zero secret leakage.

---

## 5. Definition of Done (DoD) per Task

A task is considered complete **only** when all of the following conditions are met:
1. All newly authored functions/modules have corresponding tests in `test/`.
2. Existing test suite passes with **0 regressions** (`14/14` original tests passing).
3. `npm run check` exits with code `0`.
4. Git commit follows conventional commits (`feat:`, `fix:`, `refactor:`, `test:`).
5. The task box in Section 4 is marked `[x]`.
6. An entry is appended to the **Execution Progress Log** below.

---

## 6. Execution Progress Log

| Iteration | Task ID | Description | Commit Hash | Verified By | Date |
|:---:|:---:|:---|:---:|:---:|:---:|
| 0 | INIT | Initial baseline verification, git setup & CI | `84850a8` | `npm test` (14 passed) | 2026-10-30 |
| 1 | TASK-101 | Declarative fixture schema and registry loader | `b189293` | `npm test` (19 passed), syntax check | 2026-10-31 |
| 2 | TASK-102 | Modular fixture extraction & engine integration | `93f89f0` | `npm test` (19 passed), syntax check | 2026-10-31 |
| 3 | TASK-201 | Declarative contract validation engine | `a2e9982` | `npm test` (24 passed), syntax check | 2026-10-31 |
| 4 | TASK-202 | Integrate contract engine into reference agent | `4624ea5` | `npm test` (24 passed), syntax check | 2026-10-31 |
<!-- Next Ralph iteration appends here -->

---

## 7. Emergency Contacts & Escalation Protocol

* If an iteration fails tests 3 times consecutively on the same task, the Ralph loop must halt, write diagnostic logs to `logs/ralph-error.log`, and request human review.
* Never force push (`git push -f`) to `main`.

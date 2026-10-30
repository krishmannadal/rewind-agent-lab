/**
 * Open Agent Trace (OAT) v1 Specification and Schema Validator.
 * Standardizes execution trace representation across heterogeneous agent frameworks.
 */

export const OAT_VERSION = 'oat-1.0.0';

export const VALID_EVENT_KINDS = Object.freeze([
  'agent_start',
  'tool_call',
  'tool_result',
  'policy_intervention',
  'decision',
  'validation'
]);

/**
 * Validates a trace object against the Open Agent Trace (OAT) v1 schema.
 *
 * @param {object} trace - Trace candidate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateTrace(trace) {
  const errors = [];

  if (!trace || typeof trace !== 'object' || Array.isArray(trace)) {
    return { valid: false, errors: ['Trace must be a non-null object.'] };
  }

  // 1. Schema Version & ID
  if (trace.schemaVersion !== OAT_VERSION) {
    errors.push(`Invalid schemaVersion "${trace.schemaVersion}". Expected "${OAT_VERSION}".`);
  }
  if (!trace.id || typeof trace.id !== 'string' || trace.id.trim().length === 0) {
    errors.push('Trace must contain a non-empty string id.');
  }

  // 2. Timestamp
  if (!trace.timestamp || typeof trace.timestamp !== 'string' || isNaN(Date.parse(trace.timestamp))) {
    errors.push('Trace must contain a valid ISO-8601 timestamp.');
  }

  // 3. Environment
  if (!trace.environment || typeof trace.environment !== 'object' || Array.isArray(trace.environment)) {
    errors.push('Trace must contain an environment metadata object.');
  } else {
    if (typeof trace.environment.scenario !== 'string') errors.push('environment.scenario must be a string.');
    if (typeof trace.environment.seed !== 'number') errors.push('environment.seed must be a number.');
    if (typeof trace.environment.fault !== 'boolean') errors.push('environment.fault must be a boolean.');
  }

  // 4. Model Metadata
  if (!trace.model || typeof trace.model !== 'object' || Array.isArray(trace.model)) {
    errors.push('Trace must contain a model metadata object.');
  } else {
    if (!['reference', 'gemini'].includes(trace.model.mode)) {
      errors.push('model.mode must be either "reference" or "gemini".');
    }
  }

  // 5. Events
  if (!Array.isArray(trace.events) || trace.events.length === 0) {
    errors.push('Trace events must be a non-empty array.');
  } else {
    trace.events.forEach((ev, idx) => {
      if (!ev || typeof ev !== 'object') {
        errors.push(`Event at index ${idx} must be an object.`);
        return;
      }
      if (typeof ev.id !== 'number') errors.push(`Event ${idx}: id must be a number.`);
      if (!VALID_EVENT_KINDS.includes(ev.kind)) {
        errors.push(`Event ${idx}: invalid kind "${ev.kind}". Expected one of: [${VALID_EVENT_KINDS.join(', ')}].`);
      }
      if (typeof ev.name !== 'string' || ev.name.trim().length === 0) {
        errors.push(`Event ${idx}: name must be a non-empty string.`);
      }
      if (ev.payload === undefined || ev.payload === null || typeof ev.payload !== 'object') {
        errors.push(`Event ${idx}: payload must be an object.`);
      }
    });
  }

  // 6. Provenance
  if (!trace.provenance || typeof trace.provenance !== 'object' || Array.isArray(trace.provenance)) {
    errors.push('Trace must contain a provenance object.');
  } else {
    if (typeof trace.provenance.fingerprint !== 'string') {
      errors.push('provenance.fingerprint must be a string.');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Normalizes an internal REWIND execution result into standard OAT v1 trace format.
 *
 * @param {object} runResult - REWIND execution result
 * @returns {object} OAT v1 compliant trace
 */
export function toOAT(runResult) {
  const events = (runResult.trace || []).map((step, idx) => {
    let kind = 'tool_call';
    if (step.type === 'task') kind = 'agent_start';
    else if (step.type === 'guard') kind = 'policy_intervention';
    else if (step.type === 'decision') kind = 'decision';
    else if (step.type === 'evaluation') kind = 'validation';
    else if (step.type === 'tool') kind = 'tool_result';

    return {
      id: idx + 1,
      kind,
      name: step.title || step.type,
      payload: step.data || {},
      status: step.status || 'ok'
    };
  });

  return {
    schemaVersion: OAT_VERSION,
    id: runResult.id || `oat-${Date.now()}`,
    timestamp: new Date().toISOString(),
    environment: {
      scenario: runResult.config?.scenario || 'stale',
      seed: runResult.config?.seed ?? 42,
      fault: runResult.config?.fault ?? true,
      severity: runResult.config?.severity || 'medium'
    },
    model: {
      mode: runResult.mode || 'reference',
      id: runResult.mode === 'gemini' ? (runResult.model || 'gemini-3.8-flash') : 'reference-kernel-v1'
    },
    events,
    provenance: {
      fingerprint: runResult.fingerprint || '',
      externalSideEffects: false,
      engineVersion: runResult.version || '1.0.0'
    }
  };
}

/**
 * REWIND Trace Redaction & Privacy Normalizer.
 * Redacts secrets, credentials, API keys, and sensitive tokens from execution traces.
 */

// Common secret patterns
const API_KEY_REGEX = /\b(AIzaSy[A-Za-z0-9_-]{33}|sk-[A-Za-z0-9_-]{20,})\b/g;
const BEARER_REGEX = /\b(Bearer\s+)[A-Za-z0-9_.-]{20,}\b/gi;
const GENERIC_TOKEN_REGEX = /\b(token|secret|password)[=:]\s*["']?([A-Za-z0-9_.-]{8,})["']?/gi;
const SENSITIVE_EMAIL_REGEX = /\b(?!(?:finance|archive|security|exfiltrate)@(?:example|unapproved)\.test\b)[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

/**
 * Redacts sensitive patterns in a string.
 *
 * @param {string} text
 * @returns {string}
 */
export function redactText(text) {
  if (typeof text !== 'string') return text;

  return text
    .replace(API_KEY_REGEX, '[REDACTED:API_KEY]')
    .replace(BEARER_REGEX, '$1[REDACTED:BEARER_TOKEN]')
    .replace(GENERIC_TOKEN_REGEX, '$1=[REDACTED:SECRET]')
    .replace(SENSITIVE_EMAIL_REGEX, '[REDACTED:EMAIL]');
}

const SENSITIVE_KEY_NAMES = new Set([
  'apikey',
  'api_key',
  'key',
  'password',
  'token',
  'secret',
  'authorization',
  'x-rewind-key'
]);

/**
 * Deeply redacts sensitive keys and values in an arbitrary object or array.
 *
 * @param {any} value
 * @returns {any} sanitized clone
 */
export function redactObject(value) {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    return redactText(value);
  }

  if (Array.isArray(value)) {
    return value.map(redactObject);
  }

  if (typeof value === 'object') {
    const sanitized = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY_NAMES.has(k.toLowerCase())) {
        sanitized[k] = '[REDACTED:CREDENTIAL]';
      } else {
        sanitized[k] = redactObject(v);
      }
    }
    return sanitized;
  }

  return value;
}

/**
 * Redact an entire trace or export payload.
 *
 * @param {object} trace
 * @returns {object} sanitized trace clone
 */
export function redactTrace(trace) {
  return redactObject(trace);
}

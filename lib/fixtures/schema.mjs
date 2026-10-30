/** Declarative schema and validation for REWIND scenario fixtures. */

export const KNOWN_POLICIES = Object.freeze([
  'freshness',
  'retry',
  'corroborate',
  'scope',
  'abstain'
]);

export const REQUIRED_FIXTURE_FIELDS = Object.freeze([
  'id',
  'name',
  'category',
  'tag',
  'tool',
  'color',
  'task',
  'fault',
  'required',
  'expected',
  'fields'
]);

/**
 * Validates a fixture definition against the REWIND fixture schema.
 * Throws a descriptive Error if the fixture is malformed.
 *
 * @param {object} fixture
 * @returns {object} validated, normalized fixture
 */
export function validateFixture(fixture) {
  if (!fixture || typeof fixture !== 'object' || Array.isArray(fixture)) {
    throw new Error('Fixture must be an object.');
  }

  for (const field of REQUIRED_FIXTURE_FIELDS) {
    if (fixture[field] === undefined || fixture[field] === null || fixture[field] === '') {
      throw new Error(`Fixture missing required field "${field}".`);
    }
  }

  if (typeof fixture.id !== 'string' || !/^[a-z0-9_-]+$/i.test(fixture.id)) {
    throw new Error(`Fixture id "${fixture.id}" must be an alphanumeric identifier.`);
  }

  if (typeof fixture.name !== 'string' || fixture.name.trim().length === 0) {
    throw new Error('Fixture name must be a non-empty string.');
  }

  if (typeof fixture.tool !== 'string' || fixture.tool.trim().length === 0) {
    throw new Error('Fixture tool must be a non-empty string.');
  }

  if (!KNOWN_POLICIES.includes(fixture.required)) {
    throw new Error(`Fixture required policy "${fixture.required}" is not recognized.`);
  }

  if (!Array.isArray(fixture.fields) || fixture.fields.length === 0) {
    throw new Error('Fixture fields must be a non-empty array of strings.');
  }

  if (fixture.fields.some(f => typeof f !== 'string' || f.trim().length === 0)) {
    throw new Error('Fixture fields must all be non-empty strings.');
  }

  if (fixture.environmentBuilder && typeof fixture.environmentBuilder !== 'function') {
    throw new Error('Fixture environmentBuilder must be a function if provided.');
  }

  return {
    id: fixture.id.trim(),
    name: fixture.name.trim(),
    category: String(fixture.category).trim(),
    tag: String(fixture.tag).trim(),
    tool: fixture.tool.trim(),
    color: String(fixture.color).trim(),
    task: String(fixture.task).trim(),
    fault: String(fixture.fault).trim(),
    required: fixture.required,
    expected: fixture.expected,
    fields: [...fixture.fields],
    ...(fixture.environmentBuilder ? { environmentBuilder: fixture.environmentBuilder } : {})
  };
}

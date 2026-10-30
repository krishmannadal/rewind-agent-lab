/** Fixture registry and loader for REWIND scenario definitions. */
import { validateFixture } from './schema.mjs';
import { staleFixture } from './stale.mjs';
import { timeoutFixture } from './timeout.mjs';
import { conflictFixture } from './conflict.mjs';
import { instructionFixture } from './instruction.mjs';

const registry = new Map();

/**
 * Register a fixture definition in the global registry.
 * Validates the schema before storing.
 *
 * @param {object} fixtureDef
 * @returns {object} validated fixture
 */
export function registerFixture(fixtureDef) {
  const validated = validateFixture(fixtureDef);
  registry.set(validated.id, Object.freeze(validated));
  return registry.get(validated.id);
}

/**
 * Retrieve a registered fixture by ID.
 * Throws if the fixture is not found.
 *
 * @param {string} id
 * @returns {object} frozen fixture definition
 */
export function loadFixture(id) {
  if (typeof id !== 'string' || !registry.has(id)) {
    throw new Error(`Fixture "${id}" not found in registry.`);
  }
  return registry.get(id);
}

/**
 * Check if a fixture is registered.
 *
 * @param {string} id
 * @returns {boolean}
 */
export function hasFixture(id) {
  return typeof id === 'string' && registry.has(id);
}

/**
 * List all registered fixtures.
 *
 * @returns {Array<object>}
 */
export function listFixtures() {
  return Array.from(registry.values());
}

/**
 * Clear all fixtures (primarily for testing).
 */
export function clearFixtures() {
  registry.clear();
}

/** Built-in standard modular reference scenarios. */
export const BUILTIN_FIXTURES = Object.freeze([
  staleFixture,
  timeoutFixture,
  conflictFixture,
  instructionFixture
]);

// Initialize default standard fixtures
for (const fix of BUILTIN_FIXTURES) {
  registerFixture(fix);
}

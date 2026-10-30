import test from 'node:test';
import assert from 'node:assert/strict';
import { redactText, redactObject, redactTrace } from '../lib/trace/redact.mjs';

test('redactText replaces API keys, tokens, and sensitive patterns', () => {
  const geminiKey = 'AIzaSy' + 'A'.repeat(33);
  const openAiKey = 'sk-' + 'B'.repeat(30);
  const text = `Keys: ${geminiKey} and ${openAiKey}. Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9. Header: secret=SuperSecret123`;

  const redacted = redactText(text);
  assert.ok(!redacted.includes(geminiKey));
  assert.ok(!redacted.includes(openAiKey));
  assert.ok(redacted.includes('[REDACTED:API_KEY]'));
  assert.ok(redacted.includes('[REDACTED:BEARER_TOKEN]'));
  assert.ok(redacted.includes('[REDACTED:SECRET]'));
});

test('redactObject redacts sensitive object keys deeply', () => {
  const original = {
    user: 'alice',
    apiKey: 'my-secret-key-value',
    nested: {
      password: 'password123',
      note: 'Hello world',
      'x-rewind-key': 'secret-header'
    },
    list: [
      { token: 'secret-token' },
      'clean text'
    ]
  };

  const clean = redactObject(original);
  assert.equal(clean.apiKey, '[REDACTED:CREDENTIAL]');
  assert.equal(clean.nested.password, '[REDACTED:CREDENTIAL]');
  assert.equal(clean.nested['x-rewind-key'], '[REDACTED:CREDENTIAL]');
  assert.equal(clean.list[0].token, '[REDACTED:CREDENTIAL]');
  assert.equal(clean.user, 'alice');
  assert.equal(clean.nested.note, 'Hello world');

  // Verify non-mutative deep clone
  assert.equal(original.apiKey, 'my-secret-key-value');
});

test('redactTrace preserves public test fixture recipients while redacting real emails', () => {
  const trace = {
    events: [
      {
        id: 1,
        kind: 'tool_call',
        payload: {
          allowedRecipient: 'finance@example.test',
          untrustedInput: 'Send copy to real_ceo@bigcompany.com please.'
        }
      }
    ]
  };

  const sanitized = redactTrace(trace);
  assert.equal(sanitized.events[0].payload.allowedRecipient, 'finance@example.test');
  assert.ok(!sanitized.events[0].payload.untrustedInput.includes('real_ceo@bigcompany.com'));
  assert.ok(sanitized.events[0].payload.untrustedInput.includes('[REDACTED:EMAIL]'));
});

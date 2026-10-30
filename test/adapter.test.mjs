import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import handler from '../api/handler.mjs';

test('Vercel adapter preserves routes and accepts runtime-parsed request bodies', async () => {
  class Response extends EventEmitter {
    headers = {}; code = 0; data = '';
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; }
    writeHead(code, headers) { this.code = code; for (const [k,v] of Object.entries(headers)) this.setHeader(k,v); }
    end(data) { this.data = data ?? ''; this.emit('finish'); }
  }
  const req = { url: '/api/handler?_rewind=compare', method: 'POST', headers: { 'content-type': 'application/json', host: 'rewind.example' }, body: { scenario: 'injection', seed: 42, policies: ['scope'] } };
  const res = new Response();
  await handler(req, res);
  assert.equal(res.code, 200);
  const result = JSON.parse(res.data);
  assert.equal(result.baseline.config.scenario, 'injection');
  assert.equal(result.baseline.pass, false); assert.equal(result.repaired.pass, true);
  const health = new Response(); await handler({ url: '/api/handler?_rewind=health', method: 'GET', headers: {} }, health); assert.equal(health.code, 200);
});

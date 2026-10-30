import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { SCENARIOS, POLICIES, execute, compare, searchRepairs, evaluateSuite, validateConfig, ENGINE_VERSION } from './lib/engine.mjs';
import { executeLive, compareLive, listModels } from './lib/live.mjs';
import { runBenchmark } from './lib/evaluation/runner.mjs';
import { computeAblationMatrix } from './lib/evaluation/ablation.mjs';

const ROOT = fileURLToPath(new URL('./public/', import.meta.url)).replace(/[\\/]+$/, '');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const endpoints = {
  '/api/run': execute,
  '/api/compare': compare,
  '/api/search': searchRepairs,
  '/api/suite': x => { const c = validateConfig(x); return evaluateSuite(c.policies, c.seed); },
  '/api/benchmark': x => { const c = validateConfig(x); return runBenchmark(c.policies, c.seed); },
  '/api/ablation': x => { const c = validateConfig(x); return computeAblationMatrix({ scenario: c.scenario, seed: c.seed, budget: x.budget }); }
};
const schema = { type: 'object', properties: { scenario: { type: 'string', enum: SCENARIOS.map(s => s.id) }, seed: { type: 'integer', minimum: 0, maximum: 999999 }, fault: { type: 'boolean' }, policies: { type: 'array', items: { type: 'string', enum: POLICIES.map(p => p.id) } }, budget: { type: 'integer', minimum: 0, maximum: 4 }, wholeSuite: { type: 'boolean' } }, additionalProperties: false };
const mcpTools = [['rewind_run', 'Execute a deterministic reference agent in an isolated seeded fixture.'], ['rewind_compare', 'Compare a baseline and repaired run with a matched clean control.'], ['rewind_search', 'Search 32 policy subsets for a minimal repair with zero control regressions.'], ['rewind_suite', 'Run 12 fault cases and 12 clean controls.']].map(([name, description]) => ({ name, description, inputSchema: schema, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } }));
let requests = 0, windowStart = Date.now(), activeModels = 0;

function reply(res, code, data, extra = {}) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
  res.end(data === undefined ? undefined : JSON.stringify(data));
}
async function body(req) {
  // Serverless runtimes may parse the body before invoking the Node handler.
  if (req.body !== undefined) {
    const raw = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? String(req.body) : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > 65536) { const e = new Error('Request is too large (64 KB maximum).'); e.status = 413; throw e; }
    try { return JSON.parse(raw); } catch { throw new Error('Request body must be valid JSON.'); }
  }
  let bytes = 0; const chunks = [];
  for await (const chunk of req) { bytes += chunk.length; if (bytes > 65536) { const e = new Error('Request is too large (64 KB maximum).'); e.status = 413; throw e; } chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw new Error('Request body must be valid JSON.'); }
}
function sameOrigin(req) {
  if (!req.headers.origin) return true;
  try { const origin = new URL(req.headers.origin); return origin.host === req.headers.host && ['http:', 'https:'].includes(origin.protocol); } catch { return false; }
}
async function mcpMessage(message) {
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') return { jsonrpc: '2.0', id: message?.id ?? null, error: { code: -32600, message: 'Invalid JSON-RPC request' } };
  if (message.id === undefined) return null;
  const envelope = { jsonrpc: '2.0', id: message.id };
  if (message.method === 'initialize') return { ...envelope, result: { protocolVersion: '2025-03-26', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'rewind-agent-lab', version: ENGINE_VERSION }, instructions: 'Public synthetic-fixture lab only. No external execution or private data access.' } };
  if (message.method === 'ping') return { ...envelope, result: {} };
  if (message.method === 'tools/list') return { ...envelope, result: { tools: mcpTools } };
  if (message.method === 'tools/call') {
    const route = { rewind_run: '/api/run', rewind_compare: '/api/compare', rewind_search: '/api/search', rewind_suite: '/api/suite' }[message.params?.name];
    if (!route) return { ...envelope, error: { code: -32602, message: 'Unknown tool' } };
    try { const result = endpoints[route](message.params.arguments ?? {}); return { ...envelope, result: { content: [{ type: 'text', text: JSON.stringify(result) }], isError: false } }; }
    catch (e) { return { ...envelope, result: { content: [{ type: 'text', text: e.message }], isError: true } }; }
  }
  return { ...envelope, error: { code: -32601, message: 'Method not found' } };
}

export function createServer() {
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/health' && req.method === 'GET') return reply(res, 200, { status: 'ok', version: ENGINE_VERSION });
      if (url.pathname === '/api/config' && req.method === 'GET') return reply(res, 200, { version: ENGINE_VERSION, scenarios: SCENARIOS, policies: POLICIES, modes: ['reference', 'gemini'], defaultModel: 'gemini-3.8-flash', storage: 'Browser-local history. No server database or stored API keys.' });
      if (url.pathname.startsWith('/api/') || url.pathname === '/mcp') {
        if (!sameOrigin(req)) return reply(res, 403, { error: 'Cross-origin requests are not permitted.' });
        if (req.method !== 'POST') return reply(res, 405, { error: 'Use POST for this endpoint.' }, { Allow: 'POST' });
        if (!req.headers['content-type']?.includes('application/json')) return reply(res, 415, { error: 'Use Content-Type: application/json.' });
        if (Date.now() - windowStart > 60000) { windowStart = Date.now(); requests = 0; }
        if (++requests > 200) return reply(res, 429, { error: 'The shared demo is busy. Try again in one minute.' }, { 'Retry-After': '60' });
        const input = await body(req);
        if (url.pathname === '/mcp') {
          if (Array.isArray(input) && (input.length === 0 || input.length > 10)) return reply(res, 400, { error: 'Use 1–10 JSON-RPC messages per batch.' });
          const result = Array.isArray(input) ? (await Promise.all(input.map(mcpMessage))).filter(Boolean) : await mcpMessage(input);
          return reply(res, result === null || Array.isArray(result) && !result.length ? 202 : 200, result === null || Array.isArray(result) && !result.length ? undefined : result);
        }
        const key = req.headers['x-rewind-key'];
        if (url.pathname === '/api/models' || input.mode === 'gemini') {
          if (activeModels >= 2) return reply(res, 429, { error: 'Two live requests are already in progress. Please try again shortly.' });
          activeModels++;
          try {
            if (url.pathname === '/api/models') return reply(res, 200, { models: await listModels(key) });
            const runner = { '/api/run': executeLive, '/api/compare': compareLive }[url.pathname];
            if (!runner) throw new Error('Repair search and suite evaluation use the deterministic reference agent. Switch to Reference mode.');
            return reply(res, 200, await runner(input, key));
          } finally { activeModels--; }
        }
        if (!endpoints[url.pathname]) return reply(res, 404, { error: 'Unknown API endpoint.' });
        const result = endpoints[url.pathname](input);
        const digest = createHash('sha256').update(JSON.stringify(result)).digest('hex');
        return reply(res, 200, { ...result, integrity: { algorithm: 'SHA-256', digest, note: 'Digest of the result excluding this integrity field; not a digital signature.' } });
      }
      if (!['GET', 'HEAD'].includes(req.method)) return reply(res, 405, { error: 'Method not allowed.' });
      const requested = url.pathname === '/' || url.pathname === '/lab' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const target = path.resolve(ROOT, requested);
      if (!target.startsWith(ROOT + path.sep)) return reply(res, 403, { error: 'Forbidden path.' });
      try { const content = await readFile(target); res.writeHead(200, { 'Content-Type': MIME[path.extname(target)] ?? 'application/octet-stream', 'Cache-Control': requested === 'index.html' || process.env.NODE_ENV !== 'production' ? 'no-cache' : 'public, max-age=3600' }); res.end(req.method === 'HEAD' ? undefined : content); }
      catch { reply(res, 404, { error: 'File not found.' }); }
    } catch (e) { reply(res, e.status ?? (e.name === 'TimeoutError' ? 504 : 400), { error: e.name === 'TimeoutError' ? 'The model provider timed out. No successful run was recorded.' : e.message }); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createServer();
  const flagPort = process.argv.indexOf('--port');
  const port = Number(process.env.PORT ?? (flagPort >= 0 ? process.argv[flagPort + 1] : 3000));
  server.listen(port, process.env.HOST ?? '0.0.0.0', () => console.log(`REWIND v${ENGINE_VERSION} · Local: http://localhost:${port}`));
  process.on('SIGTERM', () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 10000).unref(); });
}

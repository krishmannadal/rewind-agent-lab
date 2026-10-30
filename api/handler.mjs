import { createServer } from '../server.mjs';
const app = createServer();
/** Vercel adapter; the same HTTP handler also runs as a normal Render process. */
export default function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const target = url.searchParams.get('_rewind');
  if (target) {
    req.url = target === 'health' ? '/health' : target === 'mcp' ? '/mcp' : `/api/${target}`;
  }
  return new Promise(resolve => {
    res.once('finish', resolve);
    res.once('close', resolve);
    app.emit('request', req, res);
  });
}

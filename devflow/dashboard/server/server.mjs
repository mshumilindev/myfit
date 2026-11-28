/** SPO-639 (W17 B2): Dev Console HTTP server. Local-only, read-only; the data comes from an injected collector. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { checkRequest, safeStaticPath } from './guard.mjs';

/** @type {Record<string, string>} */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};
const HEADERS = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'content-security-policy':
    "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:",
};

/**
 * @param {{ uiRoot: string, collect: () => Promise<unknown> | unknown, port?: number, meta?: { brand?: string }, doc?: (id: string, dir: string, name: string) => string | null }} opts
 * @returns {import('node:http').Server}
 */
export function createDashServer({ uiRoot, collect, port = 5174, doc, meta = {} }) {
  const root = resolve(uiRoot);
  /** @param {import('node:http').ServerResponse} res @param {number} status @param {string | Buffer} body @param {string} [type] */
  const send = (res, status, body, type = 'application/json; charset=utf-8') => {
    res.writeHead(status, { ...HEADERS, 'content-type': type });
    res.end(body);
  };
  return createServer(async (req, res) => {
    const verdict = checkRequest(
      { method: req.method, url: req.url, headers: req.headers, remote: req.socket.remoteAddress },
      port,
    );
    if (!verdict.ok) return send(res, verdict.status, JSON.stringify({ error: verdict.why }));
    const url = req.url ?? '/';
    try {
      if (url.startsWith('/api/')) {
        const path = url.split('?')[0];
        if (path === '/api/health') return send(res, 200, JSON.stringify({ ok: true }));
        if (path === '/api/meta') return send(res, 200, JSON.stringify(meta));
        if (path === '/api/snapshot') return send(res, 200, JSON.stringify(await collect()));
        if (path === '/api/doc' && doc) {
          const q = new URL(url, 'http://x').searchParams;
          const text = doc(q.get('task') ?? '', q.get('dir') ?? '', q.get('name') ?? '');
          return text === null
            ? send(res, 404, JSON.stringify({ error: 'not-found' }))
            : send(res, 200, text, 'text/plain; charset=utf-8');
        }
        return send(res, 404, JSON.stringify({ error: 'not-found' }));
      }
      const rel = safeStaticPath(url);
      if (!rel) return send(res, 404, JSON.stringify({ error: 'not-found' }));
      const file = resolve(join(root, rel));
      if (file !== root && !file.startsWith(root + sep))
        return send(res, 404, JSON.stringify({ error: 'not-found' }));
      const body = await readFile(file);
      return send(
        res,
        200,
        req.method === 'HEAD' ? '' : body,
        TYPES[extname(file)] ?? 'application/octet-stream',
      );
    } catch {
      return send(res, 404, JSON.stringify({ error: 'not-found' }));
    }
  });
}

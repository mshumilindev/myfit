/**
 * SPO-639 (W17 B2): request guard for the local-only Dev Console API.
 * Read-only (GET/HEAD), loopback sockets only, Host must be the loopback name on our port (DNS-rebinding defence),
 * Origin, when sent, must be that same origin (cross-site pages cannot read the API).
 */
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/** @param {{ method?: string, url?: string, headers: Record<string, string | string[] | undefined>, remote?: string }} req @param {number} port */
export function checkRequest(req, port) {
  if (req.method !== 'GET' && req.method !== 'HEAD')
    return { ok: false, status: 405, why: 'method' };
  if (!req.remote || !LOOPBACK.has(req.remote)) return { ok: false, status: 403, why: 'remote' };
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const host = String(req.headers.host ?? '').toLowerCase();
  if (!allowedHosts.has(host)) return { ok: false, status: 403, why: 'host' };
  const origin = req.headers.origin;
  if (
    origin !== undefined &&
    !(typeof origin === 'string' && [...allowedHosts].some((h) => origin === `http://${h}`))
  )
    return { ok: false, status: 403, why: 'origin' };
  return { ok: true, status: 200, why: '' };
}

/**
 * Maps a URL path to a file under the UI root; null for anything that could leave it.
 * @param {string} urlPath
 */
export function safeStaticPath(urlPath) {
  let p;
  try {
    p = decodeURIComponent(String(urlPath).split('?')[0].split('#')[0]);
  } catch {
    return null;
  }
  if (p.includes('\0') || p.includes('\\')) return null;
  if (p.split('/').some((s) => s === '..' || s.startsWith('@'))) return null;
  if (p === '/' || p === '') return 'index.html';
  return p.replace(/^\/+/, '');
}

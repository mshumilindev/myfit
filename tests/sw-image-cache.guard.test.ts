/**
 * SPO-358: the service worker's picture cache must never keep a non-image answer (Hosting serves index.html with
 * status 200 for a missing file) under a picture URL, or an "empty card" outlives the deploy that fixed it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { imageCacheGuard } from '../client/swImageCacheGuard';

const res = (type: string | null, status = 200) =>
  new Response('x', { status, headers: type ? { 'content-type': type } : {} });

describe('service worker picture cache guard', () => {
  it('keeps real pictures', async () => {
    for (const t of ['image/jpeg', 'image/webp', 'image/png', 'image/svg+xml', 'IMAGE/JPEG']) {
      const r = res(t);
      expect(await imageCacheGuard.cacheWillUpdate({ response: r })).toBe(r);
    }
  });

  it('refuses the SPA fallback (HTML, 200) and answers without a type', async () => {
    for (const t of ['text/html; charset=utf-8', 'application/json', null]) {
      expect(await imageCacheGuard.cacheWillUpdate({ response: res(t) })).toBeNull();
    }
  });

  it('is wired into the picture route of the PWA config', () => {
    const cfg = readFileSync(join(__dirname, '..', 'client', 'vite.config.ts'), 'utf8');
    expect(cfg).toMatch(/cacheName: 'spotter-img'[\s\S]*?plugins: \[imageCacheGuard\]/);
  });

  it('is self-contained so Workbox can inline it into sw.js', () => {
    const src = imageCacheGuard.cacheWillUpdate.toString();
    expect(src).not.toMatch(/\bimport\b|\brequire\b/);
    // runs with no outer scope at all
    const standalone = new Function(`return (${src})`)() as typeof imageCacheGuard.cacheWillUpdate;
    return standalone({ response: res('image/png') }).then((r) => expect(r).not.toBeNull());
  });
});

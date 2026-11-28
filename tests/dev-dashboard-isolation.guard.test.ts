import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    if (n === 'node_modules' || n === 'dist') return [];
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

describe('Dev Console stays separate from the product (SPO-639 R1)', () => {
  it('client, functions and desktop never import dev-dashboard', () => {
    for (const dir of ['client/src', 'functions/src', 'desktop/src']) {
      for (const f of walk(dir).filter((p) => /\.(tsx?|mjs|js)$/.test(p))) {
        expect(readFileSync(f, 'utf8'), f).not.toMatch(/dev-dashboard/);
      }
    }
  });
  it('hosting serves only client/dist', () => {
    const fb = JSON.parse(readFileSync('firebase.json', 'utf8'));
    const hosting = Array.isArray(fb.hosting) ? fb.hosting : [fb.hosting];
    for (const h of hosting) expect(h.public).toBe('client/dist');
  });
  it('the server binds loopback only and has no write routes', () => {
    const main = readFileSync('devflow/dashboard/server/main.mjs', 'utf8');
    expect(main).toContain("'127.0.0.1'");
    expect(main).not.toMatch(/listen\([^)]*0\.0\.0\.0/);
    const srv = readFileSync('devflow/dashboard/server/server.mjs', 'utf8');
    expect(srv).not.toMatch(/writeFile|appendFile|unlink|rm\(/);
  });
});

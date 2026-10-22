import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const fb = JSON.parse(readFileSync(resolve(root, 'firebase.json'), 'utf8'));
const all = (
  fb.hosting.headers as { source: string; headers: { key: string; value: string }[] }[]
).find((h) => h.source === '**')!;
const h = (k: string) =>
  all.headers.find((x) => x.key.toLowerCase() === k.toLowerCase())?.value ?? '';
const directive = (csp: string, name: string) =>
  csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `) || d === name) ?? '';

describe('hosting security headers (iteration 14 item 3)', () => {
  const csp = h('Content-Security-Policy');
  const ro = h('Content-Security-Policy-Report-Only');
  it('sets the clickjacking, transport and referrer headers', () => {
    expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(h('X-Frame-Options')).toBe('DENY');
    expect(h('Strict-Transport-Security')).toMatch(/max-age=\d{8,}/);
    expect(h('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(h('Permissions-Policy')).toMatch(/payment=\(\)/);
    expect(h('Cross-Origin-Opener-Policy')).toMatch(/same-origin/);
    expect(h('X-Content-Type-Options')).toBe('nosniff');
  });
  it('the enforced CSP has no eval, no inline script, no wildcard script host and no framing', () => {
    const script = directive(csp, 'script-src');
    expect(script).not.toMatch(/unsafe-eval|'unsafe-inline'|\*\s|https:\s|http:/);
    expect(script).not.toMatch(/https:\/\/\*/);
    expect(directive(csp, 'default-src')).toBe("default-src 'none'");
    expect(directive(csp, 'object-src')).toBe("object-src 'none'");
    expect(directive(csp, 'base-uri')).toBe("base-uri 'self'");
  });
  it('Trusted Types run in report-only mode; the strict policy has no third-party script beyond reCAPTCHA/GTM', () => {
    expect(ro).toContain("require-trusted-types-for 'script'");
    expect(csp).not.toContain('require-trusted-types-for');
    const hosts = directive(ro, 'script-src')
      .split(/\s+/)
      .filter((x) => x.startsWith('https://'));
    expect(hosts.every((x) => /google|gstatic|googletagmanager/.test(x))).toBe(true);
  });
  it('names no font host and no analytics host in any policy (SPO-287)', () => {
    for (const policy of [csp, ro]) {
      expect(policy).not.toMatch(
        /fonts\.googleapis\.com|fonts\.gstatic\.com|google-analytics\.com|analytics\.google\.com|googletagmanager\.com/,
      );
      expect(directive(policy, 'font-src')).toBe("font-src 'self' data:");
    }
  });
  it('every inline event handler in index.html is covered by a hash', () => {
    const html = readFileSync(resolve(root, 'client/index.html'), 'utf8');
    const handlers = [...html.matchAll(/\son[a-z]+="([^"]+)"/g)].map((m) =>
      m[1].replaceAll('&quot;', '"'),
    );
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
      (m) => m[1],
    );
    for (const code of [...handlers, ...inline.filter((x) => x.trim())]) {
      const hash = `'sha256-${createHash('sha256').update(code).digest('base64')}'`;
      expect(directive(csp, 'script-src'), code.slice(0, 60)).toContain(hash);
    }
  });
});

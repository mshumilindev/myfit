import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * SPO-14: a CSS `@import url(https://…)` is render-blocking: the first paint waits until the remote host answers,
 * which on a dead network is "never". Remote fonts go through the non-blocking link in client/index.html.
 */
const cssFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return cssFiles(p);
    return p.endsWith('.css') ? [p] : [];
  });

describe('startup never waits for a remote host', () => {
  it('has no remote @import in any stylesheet of the client', () => {
    const bad = cssFiles('client/src').filter((f) =>
      /@import\s+(url\()?['"]?https?:/i.test(readFileSync(f, 'utf8')),
    );
    expect(bad).toEqual([]);
  });

  // SPO-287: the fonts are self-hosted (@fontsource), so there is no remote font host left to wait for or to leak the
  // visitor's IP to. This replaces the earlier "non-blocking media swap" contract (SPO-14): the goal, startup never waits
  // for a remote host, is now met by having none.
  it('index.html names no remote font host, and the landing fonts are bundled', () => {
    const html = readFileSync('client/index.html', 'utf8');
    expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    const bundled =
      readFileSync('client/src/main.tsx', 'utf8') +
      readFileSync('client/src/views/landing/LandingDesign.tsx', 'utf8');
    for (const fam of ['inter-tight', 'manrope', 'jetbrains-mono', 'kaushan-script'])
      expect(bundled).toContain(`@fontsource/${fam}/`);
  });
});

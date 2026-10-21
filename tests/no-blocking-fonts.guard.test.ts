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

  it('loads the Google Fonts stylesheet with the non-blocking media swap, landing families included', () => {
    const html = readFileSync('client/index.html', 'utf8');
    const link = /<link[^>]*fonts\.googleapis\.com\/css2[^>]*>/s.exec(html)?.[0] ?? '';
    expect(link).toContain('media="print"');
    expect(link).toContain("this.media = 'all'");
    for (const fam of ['Inter+Tight', 'Manrope', 'JetBrains+Mono', 'Kaushan+Script'])
      expect(link).toContain(fam);
  });
});

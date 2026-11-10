/**
 * Text that wears a fixed LIGHT colour (`color: var(--c-<light primitive>)`) is invisible on the light
 * Studio mode (the Today programme card's muscle line was pale on a pale plate). Text follows the
 * theme tokens (`--color-text`, `--color-*-text`, `--t-text`); a fixed light ink is allowed only on a
 * surface that is dark in every mode (a photo hero, a solid coloured button), listed here by selector.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '../client/src');

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.css')) out.push(p);
  }
  return out;
}

const prim = new Map<string, string>();
for (const f of walk(join(SRC, 'tokens'))) {
  for (const m of readFileSync(f, 'utf8').matchAll(/--c-([0-9a-f]{6}):\s*#([0-9a-f]{6})/g))
    prim.set(m[1], m[2]);
}
function lum(h: string): number {
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Surfaces that are dark / coloured in every theme and mode. */
const ALLOWED = new Set([
  '.session-top.past-hero .title',
  '.gym-photo-credit',
  '.gym-detail-hero .hero-text h1',
  '.gyms-hero-text h1',
  '.eq-tile-toggle',
  '.eq-tile-add',
  '.rx .slist .r.now .kn',
  '.rx-track .node.now .kn',
  '.uicall-rb--danger .uicall-rb-c',
  '.app-nutrition .fab',
]);

describe('fixed light ink', () => {
  it('is used only on surfaces that stay dark in every mode', () => {
    const bad: string[] = [];
    for (const f of walk(SRC)) {
      if (f.includes('/tokens/') || f.includes('/themes/')) continue;
      const css = readFileSync(f, 'utf8');
      for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const sel = m[1].trim().split('\n').pop()!.trim();
        for (const d of m[2].matchAll(/(?<![-\w])color:\s*var\(--c-([0-9a-f]{6})\)/g)) {
          const hex = prim.get(d[1]);
          if (hex && lum(hex) > 0.5 && !ALLOWED.has(sel)) bad.push(`${f.replace(SRC, '')}: ${sel}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

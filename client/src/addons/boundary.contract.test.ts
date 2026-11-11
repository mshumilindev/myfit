import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * An add-on is a separate package (owner 11.11): its code lives in its own folder and loads lazily while it is installed.
 * The core may only reach it through (a) its gate in addons/featureGates.ts and (b) ONE dynamic `import()` of its boot file
 * in addons/useAddonRuntime.ts. Any other import of an add-on folder from the core would put it in the first load.
 * The add-on may import the core; the core never imports the add-on.
 */
const SRC = join(__dirname, '..');
const SEPARATE = [{ id: 'planner', dir: 'planner', allowed: ['addons/useAddonRuntime.ts'] }];

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
}

describe('separate add-ons stay out of the core bundle', () => {
  const files = walk(SRC).map((p) => ({ rel: relative(SRC, p), src: readFileSync(p, 'utf8') }));
  for (const a of SEPARATE) {
    it(`${a.id}: only its boot file is imported from outside, lazily`, () => {
      const re = new RegExp(`(from\\s+|import\\()\\s*['"][./]*(?:\\.\\./)*${a.dir}/`, 'g');
      const bad: string[] = [];
      for (const f of files) {
        if (f.rel.startsWith(`${a.dir}/`)) continue;
        if (/\.(test|stories|cases\.test)\.tsx?$/.test(f.rel)) continue;
        const m = f.src.match(re);
        if (!m) continue;
        if (!a.allowed.includes(f.rel)) bad.push(f.rel);
        else if (m.some((x) => x.startsWith('from'))) bad.push(`${f.rel} (static import)`);
      }
      expect(bad).toEqual([]);
    });
  }
});

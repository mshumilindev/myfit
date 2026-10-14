import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname);

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f) && !/\.(test|stories)\./.test(f)) out.push(p);
  }
  return out;
}

describe('icon registry', () => {
  it('every literal icon name used in coach/** and components/ui/** exists in ICONS', () => {
    const ui = readFileSync(join(SRC, 'ui.tsx'), 'utf8');
    const block = /const ICONS[^=]*=\s*\{([\s\S]*?)\n\};/.exec(ui)?.[1] ?? '';
    const keys = new Set([...block.matchAll(/^\s*'?([\w-]+)'?\s*:/gm)].map((m) => m[1]));
    expect(keys.size).toBeGreaterThan(100);
    const pats = [
      /<Icon[^>]*?\bname=(?:"([\w-]+)"|\{?'([\w-]+)'\}?)/g,
      /\b(?:icon|iconTrailing|leadingIcon|trailingIcon)\s*[=:]\s*\{?["']([\w-]+)["']/g,
    ];
    const missing: string[] = [];
    for (const dir of ['coach', 'components/ui']) {
      for (const file of walk(join(SRC, dir))) {
        const t = readFileSync(file, 'utf8');
        for (const re of pats)
          for (const m of t.matchAll(re)) {
            const n = m[1] ?? m[2];
            if (n && !keys.has(n)) missing.push(`${n} (${file.replace(SRC, '')})`);
          }
      }
    }
    expect(missing).toEqual([]);
  });
});

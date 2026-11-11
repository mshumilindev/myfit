import { existsSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { describe, expect, it } from 'vitest';
import entries from './sizeEntries.json';
import { ADDONS } from './manifest';
import { computeAddonSizes, type SizeChunk, type SizePart } from '../../addonSizes';
import { formatSize } from './useAddonSizes';

const SRC = join(__dirname, '..');

/** A prefix is a directory (`coach/notes/`) or a file stem (`sleep` = a file or folder whose name starts so). */
function matches(prefix: string): boolean {
  if (prefix.endsWith('/')) return existsSync(join(SRC, prefix));
  const dir = join(SRC, dirname(prefix));
  return existsSync(dir) && readdirSync(dir).some((f) => f.startsWith(basename(prefix)));
}

describe('add-on size entries', () => {
  it('every shown add-on or module has an entry, and no entry is for something unknown', () => {
    const shown = ADDONS.filter((a) => !a.soon).map((a) => a.id);
    expect(Object.keys(entries).sort()).toEqual(shown.sort());
  });
  it('every path it lists exists', () => {
    for (const [id, p] of Object.entries(entries as Record<string, SizePart>)) {
      expect(
        (p.js?.length ?? 0) + (p.css?.length ?? 0) + (p.assets?.length ?? 0),
        `${id} has no paths`,
      ).toBeGreaterThan(0);
      for (const x of p.js ?? []) expect(matches(x), `${id}: ${x}`).toBe(true);
      for (const f of p.css ?? []) expect(existsSync(join(SRC, f)), `${id}: ${f}`).toBe(true);
      for (const f of p.assets ?? [])
        expect(existsSync(join(SRC, '..', 'public', f)), `${id}: public/${f}`).toBe(true);
    }
  });
});

describe('computeAddonSizes', () => {
  const chunks: SizeChunk[] = [
    { bytes: 1000, modules: { 'a/x.ts': 300, 'a/y/z.ts': 100, 'b.ts': 600 } },
    { bytes: 200, modules: { 'a/q.ts': 50 } },
  ];
  it('gives each add-on its share of each chunk, the longest prefix owning a module', () => {
    expect(
      computeAddonSizes(chunks, {
        app: { js: ['a/'] },
        mod: { js: ['a/y/'] },
        other: { js: ['b'] },
      }),
    ).toEqual({ app: 500, mod: 100, other: 600 });
  });
  it('adds the gzip of plain CSS files', () => {
    expect(computeAddonSizes(chunks, { t: { css: ['t.css'] } }, () => 77)).toEqual({ t: 77 });
  });
  it('adds the size of the public files an add-on shows', () => {
    expect(
      computeAddonSizes(
        chunks,
        { t: { assets: ['a.webp', 'b.webp'] } },
        () => 0,
        true,
        () => 40,
      ),
    ).toEqual({ t: 80 });
  });
  it('fails loudly when a path matches no module', () => {
    expect(() => computeAddonSizes(chunks, { a: { js: ['gone/'] } })).toThrow(/matches no module/);
  });
  it('formats KB and MB', () => {
    expect(formatSize(8000)).toBe('8 KB');
    expect(formatSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
  });
});

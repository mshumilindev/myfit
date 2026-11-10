import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import entries from './sizeEntries.json';
import { ADDONS } from './manifest';
import { computeAddonSizes, type ChunkNode } from '../../addonSizes';
import { formatSize } from './useAddonSizes';

const CLIENT = join(__dirname, '..', '..');

describe('add-on size entries', () => {
  it('name real add-ons and real screen files', () => {
    for (const [id, files] of Object.entries(entries)) {
      expect(
        ADDONS.some((a) => a.id === id),
        id,
      ).toBe(true);
      for (const f of files) expect(existsSync(join(CLIENT, f)), f).toBe(true);
    }
  });
});

describe('computeAddonSizes', () => {
  const node = (n: Partial<ChunkNode>): ChunkNode => ({
    imports: [],
    sources: [],
    isEntry: false,
    bytes: 0,
    ...n,
  });
  const graph = {
    'main.js': node({ isEntry: true, imports: ['vendor.js'], bytes: 500 }),
    'vendor.js': node({ bytes: 300 }),
    'a.js': node({ sources: ['src/a.tsx'], imports: ['vendor.js', 'shared.js'], bytes: 100 }),
    'b.js': node({ sources: ['src/b.tsx'], imports: ['shared.js'], bytes: 40 }),
    'shared.js': node({ bytes: 25 }),
  };
  it('counts what loads with the add-on and not what the shell already has; shared counts for each', () => {
    expect(computeAddonSizes(graph, { a: ['src/a.tsx'], b: ['src/b.tsx'] })).toEqual({
      a: 125,
      b: 65,
    });
  });
  it('fails loudly when an entry screen is in no chunk', () => {
    expect(() => computeAddonSizes(graph, { a: ['src/gone.tsx'] })).toThrow(/in no chunk/);
  });
  it('formats KB and MB', () => {
    expect(formatSize(8000)).toBe('8 KB');
    expect(formatSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
  });
});

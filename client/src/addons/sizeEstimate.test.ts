import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import entries from './sizeEntries.json';
import { estimateAddonSizes, unsized, type SizePart } from '../../addonSizes';

describe('add-on size fallbacks (dev estimate, build guard)', () => {
  it('estimates a number for every add-on in sizeEntries.json, so no card shows "—" on localhost', () => {
    const est = estimateAddonSizes(
      join(__dirname, '..'),
      join(__dirname, '..', '..', 'public'),
      entries as Record<string, SizePart>,
    );
    expect(unsized(est, Object.keys(entries))).toEqual([]);
  });
  it('unsized lists the ids without a measured size (missing or zero)', () => {
    expect(unsized({ a: 10, b: 0 }, ['a', 'b', 'c'])).toEqual(['b', 'c']);
    expect(unsized({ a: 10 }, ['a'])).toEqual([]);
  });
});

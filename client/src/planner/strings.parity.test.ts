/** SPO-554: the five Planner dictionaries stay in step: same keys, nothing empty, same placeholders. */
import { describe, expect, it } from 'vitest';
import { STRINGS } from './strings';

const LOCALES = ['en', 'uk', 'pl', 'lt', 'et'] as const;
type Dict = Record<string, unknown>;
const leaves = (v: unknown, path = ''): [string, unknown][] =>
  v && typeof v === 'object' && typeof v !== 'function'
    ? Object.entries(v as Dict).flatMap(([k, x]) => leaves(x, path ? `${path}.${k}` : k))
    : [[path, v]];
const base = new Map(leaves(STRINGS.en));

describe('Planner strings', () => {
  it.each(LOCALES.filter((l) => l !== 'en'))('%s has exactly the keys of en', (l) => {
    const got = new Map(leaves(STRINGS[l]));
    expect([...got.keys()].sort()).toEqual([...base.keys()].sort());
  });

  it.each(LOCALES)('%s has no empty text', (l) => {
    for (const [k, v] of leaves(STRINGS[l]))
      if (typeof v === 'string') expect(v.trim(), `${l}:${k}`).not.toBe('');
  });

  it.each(LOCALES.filter((l) => l !== 'en'))('%s keeps the {placeholders} of en', (l) => {
    const got = new Map(leaves(STRINGS[l]));
    for (const [k, v] of base) {
      if (typeof v !== 'string') continue;
      const ph = (s: unknown) => (String(s).match(/\{[a-zA-Z]+\}/g) ?? []).sort().join(',');
      expect(ph(got.get(k)), `${l}:${k}`).toBe(ph(v));
    }
  });
});

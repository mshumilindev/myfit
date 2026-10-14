import { describe, expect, it } from 'vitest';
import { LOCALE_IDS } from './index';
import { SHARE_LOCALES, shareStrings } from './coachShare';
import { shareEn } from './coachShare.en';
import { NOTES_LOCALES, notesStrings } from './coachNotes';
import { notesEn } from './coachNotes.en';

type Dict = Record<string, unknown>;
const CANDIDATES: unknown[][] = [
  ['Oleh'],
  [3],
  ['Oleh', 'program'],
  ['Oleh', 3],
  [3, 2],
  ['x', 3],
  [3, '12', '60'],
  [0],
  ['A', 'B', 'C'],
  ['Oleh', 'sets'],
  ['Program', 'Mon'],
];

/** Same keys, same kinds, recursively. */
function shape(a: Dict, b: Dict, path: string, bad: string[]) {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  if (ka.join() !== kb.join()) bad.push(`${path}: keys differ`);
  for (const k of ka) {
    const x = a[k];
    const y = b[k];
    if (typeof x !== typeof y) bad.push(`${path}.${k}: kind`);
    else if (x && typeof x === 'object' && !Array.isArray(x))
      shape(x as Dict, y as Dict, `${path}.${k}`, bad);
    else if (Array.isArray(x) && (!Array.isArray(y) || y.length === 0))
      bad.push(`${path}.${k}: list`);
  }
}

/** Every string a dictionary can produce. A function must work with at least one of the argument shapes. */
function outputs(d: Dict, path: string, out: { path: string; s: string }[], bad: string[]) {
  for (const [k, v] of Object.entries(d)) {
    if (typeof v === 'string') out.push({ path: `${path}.${k}`, s: v });
    else if (Array.isArray(v)) v.forEach((s) => out.push({ path: `${path}.${k}`, s: String(s) }));
    else if (typeof v === 'function') {
      let ok = false;
      for (const args of CANDIDATES) {
        try {
          const r = (v as (...a: unknown[]) => unknown)(...args);
          if (typeof r === 'string' && !/undefined|NaN/.test(r)) {
            out.push({ path: `${path}.${k}`, s: r });
            ok = true;
          }
        } catch {
          /* wrong argument shape */
        }
      }
      if (!ok) bad.push(`${path}.${k}: no argument shape works`);
    } else if (v && typeof v === 'object') outputs(v as Dict, `${path}.${k}`, out, bad);
  }
}

describe.each([
  [
    'coachShare',
    SHARE_LOCALES as Record<string, Dict>,
    shareEn as Dict,
    (l: never) => shareStrings(l),
  ],
  [
    'coachNotes',
    NOTES_LOCALES as Record<string, Dict>,
    notesEn as Dict,
    (l: never) => notesStrings(l),
  ],
])('%s dictionary', (_n, locales, en, get) => {
  it('registers all five locales', () => {
    expect(Object.keys(locales).sort()).toEqual([...LOCALE_IDS].sort());
    expect(get('en' as never)).toBe(en);
  });
  it.each(LOCALE_IDS)('%s mirrors en: same keys and kinds', (id) => {
    const bad: string[] = [];
    shape(en, locales[id], id, bad);
    expect(bad).toEqual([]);
  });
  it.each(LOCALE_IDS)('%s: no empty, untrimmed or unfilled strings', (id) => {
    const out: { path: string; s: string }[] = [];
    const bad: string[] = [];
    outputs(locales[id], id, out, bad);
    for (const { path, s } of out) {
      if (!s.length || s !== s.trim() || /\{n\}|undefined|NaN|\[object/.test(s))
        bad.push(`${path}: "${s}"`);
    }
    expect(bad).toEqual([]);
  });
  it.each(LOCALE_IDS.filter((l) => l !== 'en'))(
    '%s: translated, not copied (most strings differ from en)',
    (id) => {
      const a: { path: string; s: string }[] = [];
      const b: { path: string; s: string }[] = [];
      outputs(en, 'en', a, []);
      outputs(locales[id], id, b, []);
      const same = b.filter((x, i) => x.s === a[i]?.s && x.s.length > 6).length;
      expect(same / b.length).toBeLessThan(0.15);
    },
  );
});

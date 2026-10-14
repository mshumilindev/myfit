import { describe, expect, it } from 'vitest';

/**
 * Translation parity for EVERY coach dictionary (coach*.{en,uk,pl,lt,et}.ts), discovered by glob so a new feature
 * dictionary is covered without touching this file. Checks per locale against en: same keys, same kind (string or
 * function), same function arity, same `{placeholder}` tokens, no empty or unfilled strings, and every function
 * returns a non-empty string for sample arguments. Run alone with `npm run i18n:coach`.
 */
const LOCALES = ['uk', 'pl', 'lt', 'et'] as const;
type Dict = Record<string, unknown>;

const mods = import.meta.glob<Record<string, unknown>>('./coach*.{en,uk,pl,lt,et}.ts', {
  eager: true,
});

function dictOf(path: string): Dict {
  const m = mods[path];
  const d = Object.values(m).find((v) => v && typeof v === 'object' && !Array.isArray(v));
  if (!d) throw new Error(`${path} exports no dictionary object`);
  return d as Dict;
}

const families = [
  ...new Set(
    Object.keys(mods)
      .map((p) => /\.\/(coach[A-Za-z0-9]*)\.(en|uk|pl|lt|et)\.ts$/.exec(p)?.[1])
      .filter((x): x is string => !!x),
  ),
].sort();

const tokens = (s: string) => (s.match(/\{[A-Za-z0-9_]+\}/g) ?? []).sort().join(',');
const POOL: unknown[] = [0, 1, 2, 5, 12, 21, 'Oleh', 'Maria'];

/** Calls f with sample arguments of exactly its arity, so an `undefined` in the output is a real defect. */
function call(f: (...a: never[]) => unknown): string[] {
  const out: string[] = [];
  const n = f.length;
  const combos: unknown[][] = [];
  for (let i = 0; i < POOL.length; i++) {
    combos.push(Array.from({ length: n }, (_, j) => POOL[(i + j * 3) % POOL.length]));
  }
  for (const a of combos) {
    try {
      const r = f(...(a as never[]));
      if (typeof r === 'string') out.push(r);
    } catch {
      /* wrong argument shape for this sample */
    }
  }
  return out;
}

describe('coach dictionaries: five-locale parity', () => {
  it('finds the feature dictionaries', () => {
    expect(families.length).toBeGreaterThan(8);
    for (const f of families) expect(mods[`./${f}.en.ts`], `${f}.en`).toBeTruthy();
  });

  for (const fam of families) {
    describe(fam, () => {
      const en = mods[`./${fam}.en.ts`] ? dictOf(`./${fam}.en.ts`) : {};
      it.each(LOCALES)('%s mirrors en', (id) => {
        const path = `./${fam}.${id}.ts`;
        expect(mods[path], `${fam}.${id}.ts is missing`).toBeTruthy();
        const d = dictOf(path);
        expect(Object.keys(d).sort()).toEqual(Object.keys(en).sort());
        for (const k of Object.keys(en)) {
          expect(typeof d[k], `${id}.${k} kind`).toBe(typeof en[k]);
          if (typeof en[k] === 'function') {
            expect((d[k] as { length: number }).length, `${id}.${k} arity`).toBe(
              (en[k] as { length: number }).length,
            );
          } else if (typeof en[k] === 'string') {
            expect(tokens(d[k] as string), `${id}.${k} placeholders`).toBe(tokens(en[k] as string));
          }
        }
      });
      it.each(['en', ...LOCALES])('%s has no empty or unfilled strings', (id) => {
        const d = dictOf(`./${fam}.${id}.ts`);
        for (const [k, v] of Object.entries(d)) {
          const outs =
            typeof v === 'string' ? [v] : typeof v === 'function' ? call(v as never) : [];
          for (const s of outs) {
            expect(s.trim(), `${id}.${k}`).not.toBe('');
            expect(s, `${id}.${k} unfilled`).not.toMatch(/undefined|NaN|\[object/);
          }
        }
      });
    });
  }
});

import { describe, expect, it } from 'vitest';
import { LOCALES, LOCALE_IDS } from '../client/src/i18n';

/**
 * SPO-62: what `i18n:check` (keys, untranslated statics) and the shape test do not cover: a translation that is empty, or that
 * lost / invented a `{placeholder}` the English text carries (the sentence would then render a hole or a raw token).
 */
const TOKEN = /\{[A-Za-z0-9_]+\}|%[sd]/g;

function strings(
  node: unknown,
  path: string[] = [],
  out = new Map<string, string>(),
): Map<string, string> {
  if (typeof node === 'string') out.set(path.join('.'), node);
  else if (node && typeof node === 'object')
    for (const [k, v] of Object.entries(node)) strings(v, [...path, k], out);
  return out;
}

/** Parametrised texts are functions: call them with sentinels and see which arguments reach the sentence. */
/** Functions whose first argument is a word key ('drink' | 'unit'), not text: English prints it, other languages map it. */
const ENUM_ARG = new Set(['alcRegionSub']);
const SENTINELS = ['7771', '7772', '7773'];
function used(fn: unknown): string | null {
  try {
    const out = (fn as (...a: unknown[]) => unknown)(...SENTINELS.map(Number));
    return typeof out === 'string' ? SENTINELS.filter((x) => out.includes(x)).join() : null;
  } catch {
    return null;
  }
}
function fns(
  node: unknown,
  path: string[] = [],
  out = new Map<string, unknown>(),
): Map<string, unknown> {
  if (typeof node === 'function') out.set(path.join('.'), node);
  else if (node && typeof node === 'object')
    for (const [k, v] of Object.entries(node)) fns(v, [...path, k], out);
  return out;
}

const tokens = (s: string) => [...s.matchAll(TOKEN)].map((m) => m[0]).sort();

describe('i18n integrity (SPO-62)', () => {
  const base = strings(LOCALES.en);

  it('has strings to check (the guard is not vacuous)', () => {
    expect(base.size).toBeGreaterThan(1000);
  });

  const baseFns = fns(LOCALES.en);
  it('has parametrised texts to check', () => {
    expect([...baseFns.values()].filter((f) => used(f)).length).toBeGreaterThan(100);
  });

  for (const id of LOCALE_IDS.filter((l) => l !== 'en')) {
    const other = strings(LOCALES[id]);

    it(`${id}: no empty translation where English has text`, () => {
      const empty = [...base]
        .filter(([k, v]) => v.trim() !== '' && (other.get(k) ?? '').trim() === '')
        .map(([k]) => k);
      expect(empty).toEqual([]);
    });

    const otherFns = fns(LOCALES[id]);
    it(`${id}: parametrised texts use the same arguments as English`, () => {
      const bad = [...baseFns]
        .map(([k, f]) => [k, used(f), used(otherFns.get(k))] as const)
        .filter(([k, a, b]) => !ENUM_ARG.has(k) && a !== null && b !== null && a !== b)
        .map(([k, a, b]) => `${k}: en uses [${a}] / ${id} uses [${b}]`);
      expect(bad).toEqual([]);
    });

    it(`${id}: same {placeholders} as English`, () => {
      const bad = [...base]
        .filter(([k, v]) => other.has(k) && tokens(v).join() !== tokens(other.get(k)!).join())
        .map(
          ([k, v]) => `${k}: en ${tokens(v).join(' ')} / ${id} ${tokens(other.get(k)!).join(' ')}`,
        );
      expect(bad).toEqual([]);
    });
  }
});

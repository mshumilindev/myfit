import { describe, expect, it } from 'vitest';
import { LOCALE_IDS } from './index';
import { CALL_LOCALES, callStrings } from './calls';
import { callsEn } from './calls.en';

const KEYS = Object.keys(callsEn) as (keyof typeof callsEn)[];
const ARGS = ['Oleh', 12, '18:40'] as const;

function render(v: unknown): string {
  return typeof v === 'string' ? v : (v as (a: unknown) => string)(ARGS[0]);
}

describe('calls dictionary', () => {
  it('registers all five locales', () => {
    expect(Object.keys(CALL_LOCALES).sort()).toEqual([...LOCALE_IDS].sort());
    expect(callStrings('en')).toBe(callsEn);
  });

  it.each(LOCALE_IDS)('%s has every key with the same kind and arity as en', (id) => {
    const d = CALL_LOCALES[id];
    expect(Object.keys(d).sort()).toEqual([...KEYS].sort());
    for (const k of KEYS) {
      expect(typeof d[k], `${id}.${k}`).toBe(typeof callsEn[k]);
      if (typeof callsEn[k] === 'function')
        expect((d[k] as unknown as () => void).length, `${id}.${k}`).toBe(
          (callsEn[k] as unknown as () => void).length,
        );
    }
  });

  it.each(LOCALE_IDS)(
    '%s: no empty, untrimmed or unfilled strings; names and numbers appear',
    (id) => {
      const d = CALL_LOCALES[id];
      for (const k of KEYS) {
        const v = d[k] as unknown;
        const out = typeof v === 'string' ? v : (v as (a: unknown) => string)(ARGS[0]);
        expect(out.length, `${id}.${k}`).toBeGreaterThan(0);
        expect(out, `${id}.${k}`).toBe(out.trim());
        expect(out, `${id}.${k}`).not.toMatch(/\{\w+\}|undefined|NaN|\[object/);
      }
      expect(d.callTo('Oleh')).toContain('Oleh');
      expect(d.callWith('Oleh')).toContain('Oleh');
      expect(d.callLogVideo(12)).toContain('12');
      expect(d.callLogVoice(12)).toContain('12');
      expect(d.callEndedT('18:40')).toContain('18:40');
    },
  );

  it.each(LOCALE_IDS.filter((l) => l !== 'en'))('%s: translated, not copied', (id) => {
    const d = CALL_LOCALES[id];
    for (const k of [
      'callMute',
      'callAnswer',
      'callDecline',
      'callLogMissed',
      'callPreStart',
    ] as const)
      expect(d[k], `${id}.${k}`).not.toBe(callsEn[k]);
  });

  it('never overstates protection or reveals a schedule', () => {
    for (const id of LOCALE_IDS) {
      const text = KEYS.map((k) => render(CALL_LOCALES[id][k]))
        .join('\n')
        .toLowerCase();
      expect(text).not.toMatch(/end-to-end|e2e|we (can|do)(n't| not) see|schedule|working hours/);
    }
  });

  it.each(LOCALE_IDS.filter((l) => l !== 'en'))(
    '%s: short labels stay within the kit length budget',
    (id) => {
      const over: string[] = [];
      for (const k of KEYS) {
        const base = callsEn[k];
        if (typeof base !== 'string' || base.length < 2 || base.length > 24) continue;
        const v = CALL_LOCALES[id][k] as string;
        const max = Math.max(30, Math.ceil(base.length * 2.2));
        if (v.length > max) over.push(`${k} (${v.length} > ${max}): ${v}`);
      }
      expect(over).toEqual([]);
    },
  );
});

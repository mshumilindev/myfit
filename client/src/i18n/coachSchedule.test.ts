import { describe, expect, it } from 'vitest';
import { LOCALE_IDS } from './index';
import { SCHEDULE_LOCALES, scheduleStrings } from './coachSchedule';
import { scheduleEn } from './coachSchedule.en';

const KEYS = Object.keys(scheduleEn) as (keyof typeof scheduleEn)[];
type Fn = (...a: (string | number)[]) => string;

/** Every string of a dictionary, functions called with plausible arguments (several counts for plural forms). */
function samples(d: (typeof SCHEDULE_LOCALES)['en']): string[] {
  const out: string[] = [];
  for (const v of Object.values(d)) {
    if (typeof v === 'string') out.push(v);
    else {
      const f = v as unknown as Fn;
      for (const n of [0, 1, 2, 5, 11, 21]) {
        out.push(String(f(...[n, 'Oleh', 'Tue', 'Done'].slice(0, Math.max(1, f.length)))));
        out.push(String(f(...['Oleh', n, 'Tue', 'Done'].slice(0, Math.max(1, f.length)))));
      }
    }
  }
  return out;
}

describe('schedule dictionary', () => {
  it('registers all five locales', () => {
    expect(Object.keys(SCHEDULE_LOCALES).sort()).toEqual([...LOCALE_IDS].sort());
    expect(scheduleStrings('en')).toBe(scheduleEn);
  });

  it.each(LOCALE_IDS)('%s has every key with the same kind as en', (id) => {
    const dict = SCHEDULE_LOCALES[id];
    expect(Object.keys(dict).sort()).toEqual([...KEYS].sort());
    for (const k of KEYS) expect(typeof dict[k], `${id}.${k}`).toBe(typeof scheduleEn[k]);
  });

  it.each(LOCALE_IDS)('%s: no empty, untrimmed or unfilled strings', (id) => {
    for (const s of samples(SCHEDULE_LOCALES[id])) {
      expect(s.length).toBeGreaterThan(0);
      expect(s).toBe(s.trim());
      expect(s).not.toMatch(/\{n\}|undefined|NaN/);
    }
  });

  it.each(LOCALE_IDS.filter((l) => l !== 'en'))('%s: translated, not copied', (id) => {
    const d = SCHEDULE_LOCALES[id];
    for (const k of [
      'scTitle',
      'scToday',
      'scAddSessions',
      'scWeek',
      'scMonth',
      'rcAccept',
    ] as const)
      expect(d[k], `${id}.${k}`).not.toBe(scheduleEn[k]);
  });

  it('never promises end-to-end encryption', () => {
    for (const id of LOCALE_IDS)
      expect(JSON.stringify(samples(SCHEDULE_LOCALES[id])).toLowerCase()).not.toMatch(/end-to-end/);
  });

  it('plural forms differ where the language has them', () => {
    expect(SCHEDULE_LOCALES.uk.scSummary(1)).not.toBe(SCHEDULE_LOCALES.uk.scSummary(5));
    expect(SCHEDULE_LOCALES.pl.scSummary(2)).not.toBe(SCHEDULE_LOCALES.pl.scSummary(5));
    expect(SCHEDULE_LOCALES.en.scSummary(1)).toBe('1 session');
  });
});

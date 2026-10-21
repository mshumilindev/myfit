import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { setLocale } from '../../i18n';
import { en } from '../../i18n/en';
import { uk } from '../../i18n/uk';
import { ACTIVITY_TYPES } from '../../activities';
import type { Activity } from '../../types';
import { NOW, DAY } from '../__fixtures__/viewKit';
import {
  CATS,
  catKitTone,
  catName,
  catOf,
  catTone,
  catTypes,
  clock,
  fmtApprox,
  fmtDur,
  fmtKm,
  hhmm,
  kitTone,
  lastMeta,
  minToHhmm,
  nowMs,
  readLocal,
  relDay,
  toneClass,
  typeIcon,
  typeName,
  useNow,
  writeLocal,
} from './shared';

const act0 = (over: Partial<Activity> = {}): Activity =>
  ({
    id: 'a',
    type: 'run',
    category: 'conditioning',
    startedAt: NOW - 2 * DAY,
    finishedAt: NOW - 2 * DAY + 30 * 60_000,
    durationMin: 30,
    ...over,
  }) as Activity;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  setLocale('en');
  localStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe('activity categories', () => {
  it('splits the catalog in three: sports, recovery and the rest of conditioning, with nothing lost or doubled', () => {
    const all = CATS.flatMap((c) => catTypes(c).map((x) => x.key));
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(ACTIVITY_TYPES.length);
    expect(catTypes('sport').every((x) => x.sport)).toBe(true);
    expect(catTypes('recovery').every((x) => !x.sport && x.category === 'recovery')).toBe(true);
    expect(catTypes('conditioning').every((x) => !x.sport && x.category === 'conditioning')).toBe(
      true,
    );
  });

  it('a key finds its category; an unknown key counts as a sport', () => {
    expect(catOf('run')).toBe('conditioning');
    expect(catOf('tennis')).toBe('sport');
    expect(catOf('sauna')).toBe('recovery');
    expect(catOf('no-such-activity')).toBe('sport');
  });

  it('names come from the active language', () => {
    expect(catName('sport', en)).toBe(en.actSports);
    expect(catName('recovery', en)).toBe(en.actRecovery);
    expect(catName('conditioning', en)).toBe(en.actConditioning);
    expect(catName('sport', uk)).toBe(uk.actSports);
    expect(typeName('run', en)).toBe(en.actType.run);
    expect(typeName('mystery', en)).toBe('mystery');
  });

  it('colour families: sports green, recovery blue, the rest orchid; kit tones follow', () => {
    expect(toneClass('tennis')).toBe('la-s');
    expect(toneClass('sauna')).toBe('la-r');
    expect(toneClass('run')).toBe('la-g');
    expect(toneClass('mystery')).toBe('la-s');
    expect([catTone('sport'), catTone('recovery'), catTone('conditioning')]).toEqual([
      'la-s',
      'la-r',
      'la-g',
    ]);
    expect(kitTone('tennis')).toBe('sport');
    expect(kitTone('sauna')).toBe('rest');
    expect(kitTone('run')).toBe('conditioning');
    expect([catKitTone('sport'), catKitTone('recovery'), catKitTone('conditioning')]).toEqual([
      'sport',
      'rest',
      'conditioning',
    ]);
  });

  it('icons: the catalog icon, or a heartbeat for an unknown key', () => {
    expect(typeIcon('run')).toBeTruthy();
    expect(typeIcon('mystery')).toBe('heartbeat');
  });
});

describe('time and length wording', () => {
  it('durations are whole minutes and never negative', () => {
    expect(fmtDur(20.4, en)).toBe('20 min');
    expect(fmtDur(-5, en)).toBe('0 min');
  });

  it('approximate durations switch to hours from an hour up', () => {
    expect(fmtApprox(45, en)).toBe('45 min');
    expect(fmtApprox(60, en)).toBe(`1 ${en.hrShort}`);
    expect(fmtApprox(135, en)).toBe(`2 ${en.hrShort} 15 ${en.minShort}`);
    expect(fmtApprox(-3, en)).toBe('0 min');
  });

  it('clocks are zero-padded in 24 hours', () => {
    expect(hhmm(new Date(2026, 0, 1, 7, 5).getTime())).toBe('07:05');
    expect(minToHhmm(75)).toBe('01:15');
    expect(minToHhmm(1440 + 30)).toBe('00:30');
    expect(minToHhmm(-30)).toBe('23:30');
  });

  it('distance keeps one decimal', () => {
    expect(fmtKm(5)).toBe('5');
    expect(fmtKm(5.46)).toBe('5.5');
  });

  it('the stopwatch shows minutes and seconds, adding hours past the hour, and floors negatives at zero', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(42 * 60_000 + 10_000)).toBe('42:10');
    expect(clock(3600_000 + 2 * 60_000 + 3000)).toBe('1:02:03');
    expect(clock(-5000)).toBe('0:00');
  });

  it('"relative day": today, a weekday inside the week, a date after that', () => {
    expect(relDay(NOW - 3600_000, NOW, en, 'en')).toBe(en.laTodayLower);
    expect(relDay(NOW + DAY, NOW, en, 'en')).toBe(en.laTodayLower);
    expect(relDay(NOW - 3 * DAY, NOW, en, 'en')).toMatch(/^[A-Z][a-z]{2}$/);
    expect(relDay(NOW - 6 * DAY, NOW, en, 'en')).toMatch(/^[A-Z][a-z]{2}$/);
    expect(relDay(NOW - 7 * DAY, NOW, en, 'en')).toMatch(/\d/);
    expect(relDay(NOW - 10 * DAY, NOW, en, 'en')).toMatch(/\d/);
  });

  it('"last logged" meta leads with minutes, or with distance when asked and there is one', () => {
    expect(lastMeta(undefined, NOW, en, 'en')).toBe('');
    const a = act0({ distanceKm: 5.4 });
    expect(lastMeta(a, NOW, en, 'en')).toMatch(/^30 min · /);
    expect(lastMeta(a, NOW, en, 'en', { distanceFirst: true })).toMatch(
      new RegExp(`^5.4 ${en.laKm} · `),
    );
    expect(lastMeta(act0(), NOW, en, 'en', { distanceFirst: true })).toMatch(/^30 min · /);
  });
});

describe('local memory and the clock', () => {
  it('reads back what was written, and a removed or missing key gives the fallback', () => {
    expect(readLocal('k', 'fb')).toBe('fb');
    writeLocal('k', { a: 1 });
    expect(readLocal('k', null)).toEqual({ a: 1 });
    writeLocal('k', null);
    expect(readLocal('k', 'fb')).toBe('fb');
  });

  it('broken JSON or blocked storage never throws', () => {
    localStorage.setItem('bad', '{nope');
    expect(readLocal('bad', 'fb')).toBe('fb');
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readLocal('k', 'fb')).toBe('fb');
    expect(() => writeLocal('k', 1)).not.toThrow();
    get.mockRestore();
    set.mockRestore();
  });

  it('nowMs is the wall clock', () => {
    expect(nowMs()).toBe(NOW);
  });

  it('useNow ticks every 30 s normally and every second when fast', () => {
    const slow = renderHook(() => useNow(false));
    act(() => void vi.advanceTimersByTime(1000));
    expect(slow.result.current).toBe(NOW);
    act(() => void vi.advanceTimersByTime(29_000));
    expect(slow.result.current).toBe(NOW + 30_000);
    slow.unmount();
    const fast = renderHook(() => useNow(true));
    const t0 = fast.result.current;
    act(() => void vi.advanceTimersByTime(1000));
    expect(fast.result.current).toBe(t0 + 1000);
    fast.unmount();
  });
});

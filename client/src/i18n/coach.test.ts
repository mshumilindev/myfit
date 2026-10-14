import { describe, expect, it } from 'vitest';
import { LOCALE_IDS } from './index';
import { COACH_LOCALES, coachStrings, plural, pluralCategory } from './coach';
import { coachEn } from './coach.en';

const KEYS = Object.keys(coachEn) as (keyof typeof coachEn)[];
const TAB_KEYS = KEYS.filter(
  (k) => k.startsWith('nav') && k !== 'navLandmark' && k !== 'navWithUnread',
);

describe('coach dictionary (R-KIT-30)', () => {
  it('registers all five locales', () => {
    expect(Object.keys(COACH_LOCALES).sort()).toEqual([...LOCALE_IDS].sort());
    expect(coachStrings('en')).toBe(coachEn);
  });

  it.each(LOCALE_IDS)('%s has every key with the same type as en', (id) => {
    const dict = COACH_LOCALES[id];
    expect(Object.keys(dict).sort()).toEqual([...KEYS].sort());
    for (const k of KEYS) expect(typeof dict[k], `${id}.${k}`).toBe(typeof coachEn[k]);
  });

  it('English base carries the shell strings from the plan', () => {
    expect(coachEn).toMatchObject({
      navAgenda: 'Agenda',
      navClients: 'Clients',
      navSchedule: 'Schedule',
      navWeek: 'Week',
      navDecisions: 'Decisions',
      navPrograms: 'Programs',
      navChat: 'Chat',
      navMore: 'More',
      modeCoach: 'Coach',
      modeMyWorkouts: 'My workouts',
    });
  });

  it.each(LOCALE_IDS)('%s: strings are non-empty, trimmed, and nav labels fit a tab', (id) => {
    const dict = COACH_LOCALES[id];
    for (const k of KEYS) {
      const v = dict[k];
      if (typeof v === 'string') {
        expect(v.length, `${id}.${k}`).toBeGreaterThan(0);
        expect(v, `${id}.${k}`).toBe(v.trim());
      }
    }
    for (const k of TAB_KEYS) {
      expect((dict[k] as string).length, `${id}.${k}`).toBeLessThanOrEqual(13);
    }
  });

  it.each(LOCALE_IDS.filter((l) => l !== 'en'))('%s: translated, not copied from English', (id) => {
    const dict = COACH_LOCALES[id];
    // pl keeps the English word "Agenda" for the Agenda page, so it is not in this list
    for (const k of ['navClients', 'navSchedule', 'modeMyWorkouts', 'skipToContent'] as const)
      expect(dict[k], `${id}.${k}`).not.toBe(coachEn[k]);
  });

  it.each(LOCALE_IDS)('%s: count strings contain the number and no placeholder', (id) => {
    const dict = COACH_LOCALES[id];
    for (const n of [0, 1, 2, 3, 5, 9, 11, 12, 21, 22, 23, 148]) {
      for (const s of [dict.unread(n), dict.railLive(n), dict.navWithUnread('X', n)]) {
        expect(s).toContain(String(n));
        expect(s).not.toContain('{n}');
      }
    }
    expect(dict.navWithUnread('Chat', 3)).toMatch(/^Chat, /);
  });
});

describe('plural', () => {
  it('English: one / other', () => {
    expect(pluralCategory('en', 1)).toBe('one');
    expect(pluralCategory('en', 2)).toBe('other');
    expect(coachEn.unread(1)).toBe('1 unread');
    expect(coachEn.unread(23)).toBe('23 unread');
  });

  it('Ukrainian: one / few / many', () => {
    const u = COACH_LOCALES.uk.unread;
    expect(u(1)).toBe('1 непрочитане');
    expect(u(2)).toBe('2 непрочитані');
    expect(u(4)).toBe('4 непрочитані');
    expect(u(5)).toBe('5 непрочитаних');
    expect(u(11)).toBe('11 непрочитаних');
    expect(u(21)).toBe('21 непрочитане');
    expect(u(22)).toBe('22 непрочитані');
  });

  it('Polish: one / few / many', () => {
    const u = COACH_LOCALES.pl.unread;
    expect(u(1)).toBe('1 nieprzeczytana');
    expect(u(3)).toBe('3 nieprzeczytane');
    expect(u(5)).toBe('5 nieprzeczytanych');
    expect(u(12)).toBe('12 nieprzeczytanych');
    expect(u(22)).toBe('22 nieprzeczytane');
  });

  it('Lithuanian: one / few / other', () => {
    const u = COACH_LOCALES.lt.unread;
    expect(u(1)).toBe('1 neperskaityta');
    expect(u(2)).toBe('2 neperskaitytos');
    expect(u(10)).toBe('10 neperskaitytų');
    expect(u(21)).toBe('21 neperskaityta');
  });

  it('Estonian: one / other', () => {
    expect(COACH_LOCALES.et.railLive(1)).toBe('1 treenib');
    expect(COACH_LOCALES.et.railLive(2)).toBe('2 treenivad');
  });

  it('falls back to other when a category is missing', () => {
    expect(plural('uk', 3, { other: 'n={n}' })).toBe('n=3');
  });
});

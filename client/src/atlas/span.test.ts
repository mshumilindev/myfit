/**
 * Spans of time as a person says them — "2 days", "about 2 weeks", "1 year
 * and 4 months" — in all five languages, and through the translated chat's
 * placeholders (⟦D:…⟧ / ⟦A:…⟧ / ⟦Y:…⟧).
 */
import { describe, expect, it } from 'vitest';
import * as N from './num';
import { markFmt, setDict, translateOut } from './translate';
import type { Fmt } from './voice';

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** The edge values, in order. */
const EDGES: [string, number][] = [
  ['59 min', 59 * MIN],
  ['1 h', HOUR],
  ['23 h', 23 * HOUR],
  ['30 h', 30 * HOUR],
  ['44 h', 44 * HOUR],
  ['6.6 d', 6.6 * DAY],
  ['13 d', 13 * DAY],
  ['14 d', 14 * DAY],
  ['17 d', 17 * DAY],
  ['55 d', 55 * DAY],
  ['60 d', 60 * DAY],
  ['200 d', 200 * DAY],
  ['365 d', 365 * DAY],
  ['500 d', 500 * DAY],
];

const SPAN: Record<'en' | 'uk' | 'pl' | 'lt' | 'et', string[]> = {
  en: [
    'under an hour',
    '1 hour',
    '23 hours',
    '1 day',
    '2 days',
    '7 days',
    '13 days',
    '2 weeks',
    'about 2 weeks',
    '8 weeks',
    '2 months',
    'about 7 months',
    '1 year',
    'about 1 year and 4 months',
  ],
  uk: [
    'менше години',
    '1 година',
    '23 години',
    '1 день',
    '2 дні',
    '7 днів',
    '13 днів',
    '2 тижні',
    'близько 2 тижнів',
    '8 тижнів',
    '2 місяці',
    'близько 7 місяців',
    '1 рік',
    'близько 1 року і 4 місяців',
  ],
  pl: [
    'mniej niż godzina',
    '1 godzina',
    '23 godziny',
    '1 dzień',
    '2 dni',
    '7 dni',
    '13 dni',
    '2 tygodnie',
    'mniej więcej 2 tygodnie',
    '8 tygodni',
    '2 miesiące',
    'mniej więcej 7 miesięcy',
    '1 rok',
    'mniej więcej 1 rok i 4 miesiące',
  ],
  lt: [
    'mažiau nei valandą',
    '1 valandą',
    '23 valandas',
    '1 dieną',
    '2 dienas',
    '7 dienas',
    '13 dienų',
    '2 savaites',
    'maždaug 2 savaites',
    '8 savaites',
    '2 mėnesius',
    'maždaug 7 mėnesius',
    '1 metus',
    'maždaug 1 metus ir 4 mėnesius',
  ],
  et: [
    'alla tunni',
    '1 tund',
    '23 tundi',
    '1 päev',
    '2 päeva',
    '7 päeva',
    '13 päeva',
    '2 nädalat',
    'umbes 2 nädalat',
    '8 nädalat',
    '2 kuud',
    'umbes 7 kuud',
    '1 aasta',
    'umbes 1 aasta ja 4 kuud',
  ],
};

const AGO: Record<'en' | 'uk' | 'pl' | 'lt' | 'et', string[]> = {
  en: [
    'under an hour ago',
    '1 hour ago',
    '23 hours ago',
    '1 day ago',
    '2 days ago',
    '7 days ago',
    '13 days ago',
    '2 weeks ago',
    'about 2 weeks ago',
    '8 weeks ago',
    '2 months ago',
    'about 7 months ago',
    '1 year ago',
    'about 1 year and 4 months ago',
  ],
  uk: [
    'менше години тому',
    '1 годину тому',
    '23 години тому',
    '1 день тому',
    '2 дні тому',
    '7 днів тому',
    '13 днів тому',
    '2 тижні тому',
    'близько 2 тижнів тому',
    '8 тижнів тому',
    '2 місяці тому',
    'близько 7 місяців тому',
    '1 рік тому',
    'близько 1 року і 4 місяців тому',
  ],
  pl: [
    'mniej niż godzinę temu',
    '1 godzinę temu',
    '23 godziny temu',
    '1 dzień temu',
    '2 dni temu',
    '7 dni temu',
    '13 dni temu',
    '2 tygodnie temu',
    'mniej więcej 2 tygodnie temu',
    '8 tygodni temu',
    '2 miesiące temu',
    'mniej więcej 7 miesięcy temu',
    '1 rok temu',
    'mniej więcej 1 rok i 4 miesiące temu',
  ],
  lt: [
    'mažiau nei prieš valandą',
    'prieš 1 valandą',
    'prieš 23 valandas',
    'prieš 1 dieną',
    'prieš 2 dienas',
    'prieš 7 dienas',
    'prieš 13 dienų',
    'prieš 2 savaites',
    'prieš maždaug 2 savaites',
    'prieš 8 savaites',
    'prieš 2 mėnesius',
    'prieš maždaug 7 mėnesius',
    'prieš 1 metus',
    'prieš maždaug 1 metus ir 4 mėnesius',
  ],
  et: [
    'vähem kui tund tagasi',
    '1 tund tagasi',
    '23 tundi tagasi',
    '1 päev tagasi',
    '2 päeva tagasi',
    '7 päeva tagasi',
    '13 päeva tagasi',
    '2 nädalat tagasi',
    'umbes 2 nädalat tagasi',
    '8 nädalat tagasi',
    '2 kuud tagasi',
    'umbes 7 kuud tagasi',
    '1 aasta tagasi',
    'umbes 1 aasta ja 4 kuud tagasi',
  ],
};

describe('spans of time', () => {
  for (const l of ['en', 'uk', 'pl', 'lt', 'et'] as const) {
    it(`span table (${l})`, () => {
      expect(EDGES.map(([, ms]) => N.span(l, ms))).toEqual(SPAN[l]);
    });
    it(`ago table (${l})`, () => {
      expect(EDGES.map(([, ms]) => N.ago(l, ms))).toEqual(AGO[l]);
    });
  }

  it('the owner’s "44h ago" and the old "~30 h" read as days', () => {
    expect(N.ago('en', 44 * HOUR)).toBe('2 days ago');
    expect(N.ago('en', 1.235921712962963 * DAY)).toBe('1 day ago');
    expect(N.ago('uk', 1.235921712962963 * DAY)).toBe('1 день тому');
  });

  it('never a decimal, never an hour abbreviation', () => {
    for (let h = 0; h < 24 * 800; h += 7)
      for (const l of ['en', 'uk', 'pl', 'lt', 'et'] as const) {
        const s = N.ago(l, h * HOUR + 17 * MIN);
        expect(s).not.toMatch(/\d[.,]\d|\d ?(h|год)\b|~/u);
      }
  });

  it('plural forms past the edges', () => {
    expect(N.span('uk', 21 * HOUR)).toBe('21 година');
    expect(N.ago('uk', 21 * HOUR)).toBe('21 годину тому');
    expect(N.span('uk', 5 * DAY)).toBe('5 днів');
    expect(N.span('uk', 3 * 7 * DAY)).toBe('3 тижні');
    expect(N.span('uk', 5 * 30.44 * DAY)).toBe('5 місяців');
    expect(N.span('uk', 2 * 365.25 * DAY)).toBe('2 роки');
    expect(N.span('uk', 5 * 365.25 * DAY)).toBe('5 років');
    expect(N.span('pl', 22 * HOUR)).toBe('22 godziny');
    expect(N.span('pl', 5 * 30.44 * DAY)).toBe('5 miesięcy');
    expect(N.span('pl', 2 * 365.25 * DAY)).toBe('2 lata');
    expect(N.span('pl', 5 * 365.25 * DAY)).toBe('5 lat');
    expect(N.span('lt', 11 * DAY)).toBe('11 dienų');
    expect(N.span('lt', 21 * HOUR)).toBe('21 valandą');
    expect(N.span('lt', 10 * 30.44 * DAY)).toBe('10 mėnesių');
    expect(N.span('et', 3 * 7 * DAY)).toBe('3 nädalat');
    expect(N.span('en', 1.5 * 365.25 * DAY)).toBe('1 year and 6 months');
    expect(N.span('en', 2 * 365.25 * DAY)).toBe('2 years');
    // Weeks: "about" only when 2+ days off the nearest whole week.
    expect(N.span('en', 15 * DAY)).toBe('2 weeks');
    expect(N.span('en', 16 * DAY)).toBe('about 2 weeks');
    expect(N.span('en', 20 * DAY)).toBe('3 weeks');
  });

  it('calendar days: today, yesterday, then ago', () => {
    expect([0, 1, 2, 17].map((d) => N.daysAgo('en', d))).toEqual([
      'today',
      'yesterday',
      '2 days ago',
      'about 2 weeks ago',
    ]);
    expect([0, 1, 3].map((d) => N.daysAgo('uk', d))).toEqual(['сьогодні', 'вчора', '3 дні тому']);
    expect(N.daysAgo('pl', 1)).toBe('wczoraj');
    expect(N.daysAgo('lt', 1)).toBe('vakar');
    expect(N.daysAgo('et', 1)).toBe('eile');
  });

  it('through the context: its formatters first, else the table', () => {
    expect(N.agoOf({ locale: 'uk' }, 3 * DAY)).toBe('3 дні тому');
    const marked = markFmt({ kg: String, mmss: String, muscle: String, exercise: String });
    expect(N.agoOf({ locale: 'en', fmt: marked }, 3 * DAY)).toBe(`⟦A:${3 * DAY}⟧`);
    expect(N.spanOf({ locale: 'en', fmt: marked }, 3 * DAY)).toBe(`⟦D:${3 * DAY}⟧`);
    expect(N.daysAgoOf({ locale: 'en', fmt: marked }, 1)).toBe('⟦Y:1⟧');
  });
});

describe('spans in the translated chat', () => {
  const real: Fmt = {
    kg: (k) => `${k} kg`,
    mmss: String,
    muscle: (m) => m,
    exercise: (e) => e,
  };
  const m = markFmt(real);

  it('a placeholder becomes the target language’s words and plurals', () => {
    setDict('pl', {
      "By the way, {1} hasn't moved in {2}.": 'Przy okazji, {1} stoi w miejscu już {2}.',
      '{1} since your last session.': 'Od ostatniego treningu: {1}.',
      'Last session was {1}.': 'Ostatni trening: {1}.',
    });
    setDict('lt', { 'Last session was {1}.': 'Paskutinė treniruotė buvo {1}.' });
    setDict('et', { 'Last session was {1}.': 'Viimane trenn oli {1}.' });
    expect(
      translateOut(
        `By the way, ${m.exercise('Bench')} hasn't moved in ${m.span!(17 * DAY)}.`,
        'pl',
        real,
      ),
    ).toBe('Przy okazji, Bench stoi w miejscu już mniej więcej 2 tygodnie.');
    expect(translateOut(`Last session was ${m.ago!(44 * HOUR)}.`, 'pl', real)).toBe(
      'Ostatni trening: 2 dni temu.',
    );
    expect(translateOut(`Last session was ${m.ago!(200 * DAY)}.`, 'lt', real)).toBe(
      'Paskutinė treniruotė buvo prieš maždaug 7 mėnesius.',
    );
    expect(translateOut(`Last session was ${m.daysAgo!(1)}.`, 'et', real)).toBe(
      'Viimane trenn oli eile.',
    );
  });

  it('a sentence the dictionary lacks stays English, span included', () => {
    expect(translateOut(`Nothing like it: ${m.ago!(3 * 7 * DAY)}.`, 'pl', real)).toBe(
      'Nothing like it: 3 weeks ago.',
    );
  });

  it('a span that opens the sentence starts upper-case', () => {
    setDict('et', { '{1} since your last session.': '{1} viimasest trennist.' });
    expect(translateOut(`${m.span!(17 * DAY)} since your last session.`, 'et', real)).toBe(
      'Umbes 2 nädalat viimasest trennist.',
    );
  });
});

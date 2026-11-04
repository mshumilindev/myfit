// SPO-124 — Savage really swears, Bro stays warm, and the limits hold.
import { describe, expect, it } from 'vitest';
import { phraseBook, say, type Fmt } from './voice';
import { lineAllowed, swearingNow } from './guard';
import { COACH_DEFAULT } from './types';
import { SWEAR_CLOSE, SWEAR_OPEN } from './swearWords';
import { DICT as PL_DICT } from '../i18n/atlasDict.pl';
import { DICT as LT_DICT } from '../i18n/atlasDict.lt';
import { DICT as ET_DICT } from '../i18n/atlasDict.et';
import { styled, type StyleCtx } from './style';
import type { CoachFact, FactKind, Temper } from './types';
import type { LocaleId } from '../i18n';

const LOCALES: LocaleId[] = ['en', 'uk', 'pl', 'lt', 'et'];
const fmt: Fmt = {
  kg: (k) => `${k} kg`,
  mmss: (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`,
  muscle: (m) => m,
  exercise: (e) => e,
};
const PROFANITY: Record<string, RegExp> = {
  en: /fuck|shit|bullshit|cunt|asshole|dick|prick|bastard|bitch|\barse\b|\bass\b/i,
  uk: /бляд|блять|нахуй|хуй|хуєв|пизд|їб|йоб|сук|срак|срат|гівн|говн|мудак/i,
  pl: /kurw|chuj|pierdol|jeb|spierdal|dup[aąęy]|gówn|skurw|huj/i,
  lt: /bybi|šūd|kurv|nachui|pizd|bliamb|jobano|subin|velni/i,
  et: /kurat|türa|vittu|persse|paska|munn|litsakas|türg/i,
};
const SOFT_KINDS: FactKind[] = ['bodyweight', 'shortSleep', 'comeback', 'streak'];

const fact = (kind: string, id: string): CoachFact =>
  ({
    kind,
    id,
    sessions: 3,
    sets: 12,
    minutes: 50,
    exercise: 'Bench',
    weight: 80,
    prevWeight: 75,
    reps: 8,
    prevReps: 8,
    restSec: 30,
    targetSec: 90,
    dayName: 'Monday',
    high: 'chest',
    low: 'back',
    highSets: 10,
    lowSets: 3,
    planned: 4,
    daysOff: 5,
    hours: 5,
    days: 5,
    kg: 80,
    deltaPct: 2,
  }) as unknown as CoachFact;

const KINDS: FactKind[] = [
  'intro',
  'session',
  'pr',
  'stall',
  'restShort',
  'setDrop',
  'skipped',
  'imbalance',
  'week',
] as FactKind[];
const SLUR = /\bn[i1]gg|\bfag|retard|підор|педик|пидор|хохол|москал|кацап|\bmurzyn|\bpedał|\bžyd/i;

describe('SPO-124 swearing', () => {
  it('Savage with swearing on really swears in every locale', () => {
    for (const loc of LOCALES) {
      const hits = new Set<string>();
      for (const kind of KINDS)
        for (let i = 0; i < 30; i++) {
          const t = say(fact(kind, `${kind}${i}`), 5, {
            locale: loc,
            fmt,
            yoMama: false,
            swearing: true,
          });
          if (PROFANITY[loc].test(t)) hits.add(`${kind}`);
        }
      expect(hits.size, loc).toBeGreaterThanOrEqual(KINDS.length - 1);
    }
  });

  it('every swear line: no body words, no slurs, no mom, no broken text', () => {
    for (const loc of LOCALES) {
      const sw = phraseBook(loc).swear;
      for (const kind of KINDS) {
        const lines = sw[kind] ?? [];
        expect(lines.length, `${loc}.${kind}`).toBeGreaterThanOrEqual(3);
        let swears = 0;
        for (const l of lines as ((f: CoachFact, x: Fmt) => string)[]) {
          const out = l(fact(kind, 'x'), fmt);
          expect(out).toBeTruthy();
          expect(out).not.toMatch(/undefined|NaN|\[object/);
          expect(lineAllowed(out, 5), `${loc}.${kind}: ${out}`).toBe(true);
          expect(out).not.toMatch(SLUR);
          expect(out).not.toMatch(/\bmom\b|твоя мама|twoja matka|tavo mama|su ema/i);
          if (PROFANITY[loc].test(out)) swears++;
        }
        expect(swears, `${loc}.${kind}`).toBeGreaterThanOrEqual(Math.ceil(lines.length / 2));
      }
    }
  });

  it('sensitive kinds never get swear lines', () => {
    for (const loc of LOCALES)
      for (const k of SOFT_KINDS) expect(phraseBook(loc).swear[k] ?? []).toHaveLength(0);
  });

  it('swearing off, Bro and Neutral: no profanity at all', () => {
    for (const loc of LOCALES)
      for (const kind of KINDS)
        for (let i = 0; i < 20; i++) {
          const f = fact(kind, `${kind}${i}`);
          expect(say(f, 5, { locale: loc, fmt, yoMama: true, swearing: false })).not.toMatch(
            PROFANITY[loc],
          );
          for (const t of [1, 3] as Temper[])
            expect(say(f, t, { locale: loc, fmt, yoMama: true, swearing: true })).not.toMatch(
              PROFANITY[loc],
            );
        }
  });

  it('sensitive facts stay serious even with swearing on', () => {
    for (const loc of LOCALES)
      for (const k of SOFT_KINDS)
        for (let i = 0; i < 20; i++)
          expect(
            say(fact(k, `${k}${i}`), 5, { locale: loc, fmt, yoMama: true, swearing: true }),
          ).not.toMatch(PROFANITY[loc]);
  });

  it('Bro has at least 4 lines per kind and varied output', () => {
    for (const loc of LOCALES) {
      for (const kind of [...KINDS, ...SOFT_KINDS]) {
        const outs = new Set<string>();
        for (let i = 0; i < 60; i++)
          outs.add(say(fact(kind, `${kind}${i}`), 1, { locale: loc, fmt, yoMama: false }));
        expect(outs.size, `${loc}.${kind}`).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('chat answers swear in every locale only when Savage + on', () => {
    for (const loc of LOCALES) {
      const ctx = (temper: Temper, swearing: boolean, seed: string): StyleCtx => ({
        temper,
        locale: loc,
        yoMama: false,
        swearing,
        topic: 'progress_lift',
        seed,
      });
      const seeds = Array.from({ length: 200 }, (_, i) => `q${i}`);
      const on = seeds.some((s) =>
        PROFANITY[loc].test(styled('Bench 100 kg.', ctx(5, true, s)).text),
      );
      expect(on, loc).toBe(true);
      for (const s of seeds) {
        expect(styled('Bench 100 kg.', ctx(5, false, s)).text).not.toMatch(PROFANITY[loc]);
        expect(styled('Bench 100 kg.', ctx(1, true, s)).text).not.toMatch(PROFANITY[loc]);
      }
    }
  });

  it('the slur blocklist rejects slurs in a hard temper', () => {
    expect(lineAllowed('you fag', 5)).toBe(false);
    expect(lineAllowed('ти підор', 5)).toBe(false);
    expect(lineAllowed('fucking lazy sets', 5)).toBe(true);
  });

  it('profanity is seasoning: some lines swear, most do not', () => {
    for (const loc of LOCALES)
      for (const kind of KINDS) {
        let n = 0;
        for (let i = 0; i < 200; i++)
          if (
            PROFANITY[loc].test(
              say(fact(kind, `${kind}${i}`), 5, {
                locale: loc,
                fmt,
                yoMama: false,
                swearing: true,
              }),
            )
          )
            n++;
        expect(n, `${loc}.${kind}`).toBeGreaterThan(200 * 0.15);
        expect(n, `${loc}.${kind}`).toBeLessThan(200 * 0.6);
      }
  });

  it('slur guard works on Cyrillic / Polish / Lithuanian and spares innocent words', () => {
    for (const bad of ['ти жид', 'to żyd', 'tu žydas', 'ти підор', 'you retard', 'ти негр'])
      expect(lineAllowed(bad, 5), bad).toBe(false);
    for (const ok of ['негативний тренд', 'интегральный', 'mažyd', 'fagioli', 'pedał roweru'])
      expect(lineAllowed(ok, 5), ok).toBe(true);
  });

  it('keep-my-temper never keeps swearing in a sensitive situation', () => {
    const coach = { ...COACH_DEFAULT, temper: 5 as Temper, swearing: true, keepTemper: true };
    const ctx = {
      injuries: [],
      restPeriods: [],
      sleeps: [],
      finished: [{ id: 'w', startedAt: 1_000, finishedAt: 2_000 } as never],
      now: 1_000 + 20 * 86_400_000, // 20 days off → comeback
    };
    expect(swearingNow(coach, ctx)).toBe(false);
    expect(swearingNow(coach, { ...ctx, finished: [], now: 5 })).toBe(true);
  });

  it('pl / lt / et chat swear words are translated, not left in English', () => {
    for (const [loc, dict] of [
      ['pl', PL_DICT],
      ['lt', LT_DICT],
      ['et', ET_DICT],
    ] as const)
      for (const s of [...SWEAR_OPEN.en, ...SWEAR_CLOSE.en])
        expect(dict[s.trim()], `${loc}: ${s}`).toBeTruthy();
  });
});

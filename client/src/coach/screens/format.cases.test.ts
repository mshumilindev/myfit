import { describe, expect, it } from 'vitest';
import { rosterEn as r } from '../../i18n/coachRoster.en';
import { DAY } from '../domain/time';
import type { CoachClient, Consent, Signal } from '../domain/types';
import {
  ageLabel,
  agoText,
  consentItems,
  firstName,
  lastLabel,
  levelLabels,
  modeDescription,
  modeLabel,
  sharedReadable,
  sharesSummary,
  signalBody,
  signalTitle,
  statusLabel,
  toCsv,
  trainerDaysText,
} from './format';

const off: Consent = {
  totals: 'off',
  sets: 'off',
  body: 'off',
  sleep: 'off',
  injury: 'off',
  nutrition: 'off',
  checkins: 'off',
};
const NOW = Date.UTC(2026, 9, 7, 9, 5);
const sig = (kind: Signal['kind'], facts: Signal['facts'], reason?: Signal['reason']): Signal => ({
  key: `c|${kind}|x`,
  clientId: 'c',
  kind,
  severity: 'watch',
  confidence: 'high',
  strength: 50,
  exerciseKey: null,
  detectedAt: NOW,
  facts,
  evidence: [],
  reason,
});

describe('labels', () => {
  it('statusLabel maps every status, including the row-only ones', () => {
    expect(statusLabel(r, 'urgent')).toBe(r.roStatusUrgent);
    expect(statusLabel(r, 'watch')).toBe(r.roStatusWatch);
    expect(statusLabel(r, 'good')).toBe(r.roStatusGood);
    expect(statusLabel(r, 'none')).toBe(r.roStatusNone);
  });

  it('modeLabel / modeDescription pick app, hybrid, program', () => {
    expect([modeLabel(r, 'app'), modeLabel(r, 'hybrid'), modeLabel(r, 'program')]).toEqual([
      r.ivApp,
      r.ivHybrid,
      r.ivProgram,
    ]);
    expect([
      modeDescription(r, 'app'),
      modeDescription(r, 'hybrid'),
      modeDescription(r, 'program'),
    ]).toEqual([r.c3LogApp, r.c3LogHybrid, r.c3LogProgram]);
    expect(new Set([r.ivApp, r.ivHybrid, r.ivProgram]).size).toBe(3);
  });

  it('levelLabels is the dictionary level table', () => {
    expect(levelLabels(r)).toBe(r.c3Level);
  });

  it('sharesSummary: sets with injuries, sets, totals, nothing', () => {
    expect(sharesSummary(r, { ...off, sets: 'full', injury: 'full' })).toBe(r.roSharesSetsInjury);
    expect(sharesSummary(r, { ...off, sets: 'full' })).toBe(r.roSharesSets);
    expect(sharesSummary(r, { ...off, totals: 'full' })).toBe(r.roSharesTotals);
    expect(sharesSummary(r, off)).toBe(r.roSharesNone);
  });

  it('trainerDaysText joins localised day names in the given order', () => {
    expect(trainerDaysText(r, ['Tue', 'Thu'])).toBe(`${r.c3Dow.Tue}, ${r.c3Dow.Thu}`);
    expect(trainerDaysText(r, [])).toBe('');
  });
});

describe('consentItems', () => {
  it('lists the seven categories; a category not shared only gets the lock text with the first name', () => {
    const items = consentItems(r, 'Oleh Bondar', { ...off, totals: 'full' }, 'app');
    expect(items).toHaveLength(7);
    const totals = items.find((i) => i.id === 'totals')!;
    expect(totals).toMatchObject({
      level: 'full',
      levelLabel: r.c3Level.full,
      what: r.c3Cat.totals.what,
    });
    const sets = items.find((i) => i.id === 'sets')!;
    expect(sets).toMatchObject({ level: 'off', what: r.c3NotShared('Oleh') });
    expect(JSON.stringify(sets)).not.toContain('Bondar');
  });

  it('a program-only client shares nothing whatever the stored consent says', () => {
    const items = consentItems(r, 'Oleh', { ...off, totals: 'full', sets: 'full' }, 'program');
    expect(items.every((i) => i.level === 'off')).toBe(true);
    expect(items.every((i) => i.what === r.c3NotShared('Oleh'))).toBe(true);
  });
});

describe('sharedReadable', () => {
  it('hybrid counts like app; a single category lists alone', () => {
    expect(sharedReadable(r, 'hybrid', { ...off, sets: 'full' })).toBe(r.c3Cat.sets.label);
  });
});

describe('time labels', () => {
  const client = (over: Partial<CoachClient>): CoachClient =>
    ({ mode: 'app', lastSessionAt: null, ...over }) as CoachClient;

  it('lastLabel: program clients are not logged; no session; today; yesterday; N days; clock skew counts as today', () => {
    expect(lastLabel(r, client({ mode: 'program', lastSessionAt: NOW }), NOW)).toBe(r.roNotLogged);
    expect(lastLabel(r, client({ lastSessionAt: null }), NOW)).toBe(r.roNoSession);
    expect(lastLabel(r, client({ lastSessionAt: NOW - 3_600_000 }), NOW)).toBe(r.roLastToday);
    expect(lastLabel(r, client({ lastSessionAt: NOW - DAY }), NOW)).toBe(r.roLastYesterday);
    expect(lastLabel(r, client({ lastSessionAt: NOW - 3 * DAY }), NOW)).toBe(r.roLastDays(3));
    expect(lastLabel(r, client({ lastSessionAt: NOW + 2 * DAY }), NOW)).toBe(r.roLastToday);
  });

  it('lastLabel counts calendar (UTC) days, not 24-hour spans', () => {
    const lateYesterday = Date.UTC(2026, 9, 6, 23, 59);
    const earlyToday = Date.UTC(2026, 9, 7, 0, 1);
    expect(lastLabel(r, client({ lastSessionAt: lateYesterday }), earlyToday)).toBe(
      r.roLastYesterday,
    );
  });

  it('ageLabel: same day is today, otherwise whole days, never negative', () => {
    expect(ageLabel(r, NOW, NOW)).toBe(r.sgToday);
    expect(ageLabel(r, NOW - 2 * DAY, NOW)).toBe(r.sgAgeDays(2));
    expect(ageLabel(r, NOW + 5 * DAY, NOW)).toBe(r.sgToday);
  });

  it('agoText: now, minutes, hours, days with the rounding boundaries', () => {
    expect(agoText(r, NOW - 20_000, NOW)).toBe(r.stAgoNow);
    expect(agoText(r, NOW - 29_000, NOW)).toBe(r.stAgoNow);
    expect(agoText(r, NOW - 30_000, NOW)).toBe(r.stAgoMin(1));
    expect(agoText(r, NOW - 59 * 60_000, NOW)).toBe(r.stAgoMin(59));
    expect(agoText(r, NOW - 60 * 60_000, NOW)).toBe(r.stAgoHour(1));
    expect(agoText(r, NOW - 23 * 3_600_000, NOW)).toBe(r.stAgoHour(23));
    expect(agoText(r, NOW - 24 * 3_600_000, NOW)).toBe(r.stAgoDay(1));
    expect(agoText(r, NOW - 3 * DAY, NOW)).toBe(r.stAgoDay(3));
    expect(agoText(r, NOW + 5 * 60_000, NOW)).toBe(r.stAgoNow);
  });
});

describe('signals', () => {
  it('stall, spike, pr, ready, injury, machine titles and bodies come from facts', () => {
    expect(signalTitle(r, sig('stall', { exercise: 'Squat', weeks: 3 }))).toBe(
      r.sgTitleStall('Squat', 3),
    );
    expect(signalBody(r, sig('stall', { e1rm: 120, weeks: 3 }))).toBe(r.sgBodyStall(120, 3));
    expect(signalTitle(r, sig('machine', {}))).toBe(r.sgTitleMachine);
    expect(signalBody(r, sig('machine', { exercise: 'Leg press', from: 100, to: 90 }))).toBe(
      r.sgBodyMachine('Leg press', 100, 90),
    );
    expect(signalTitle(r, sig('spike', { muscle: 'Quads', pct: 40 }))).toBe(
      r.sgTitleSpike('Quads', 40),
    );
    expect(signalBody(r, sig('spike', { sets: 20, chronic: 12 }))).toBe(r.sgBodySpike(20, 12));
    expect(signalTitle(r, sig('ready', { exercise: 'Bench' }))).toBe(r.sgTitleReady('Bench'));
    expect(signalBody(r, sig('ready', { sessions: 3, maxRpe: 8 }))).toBe(r.sgBodyReady(3, 8));
    expect(signalTitle(r, sig('pr', { exercise: 'Deadlift', e1rm: 200 }))).toBe(
      r.sgTitlePr('Deadlift', 200),
    );
    expect(signalBody(r, sig('pr', { e1rm: 200, previous: 190 }))).toBe(r.sgBodyPr(200, 190));
    expect(signalTitle(r, sig('injury', { exercise: 'Press' }))).toBe(r.sgTitleInjury('Press'));
    expect(signalBody(r, sig('injury', {}))).toBe(r.sgBodyInjury);
  });

  it('rhythm: low weeks win over idle days', () => {
    expect(signalTitle(r, sig('rhythm', { lowWeeks: 2, idleDays: 9 }))).toBe(r.sgTitleRhythmLow(2));
    expect(signalTitle(r, sig('rhythm', { lowWeeks: 0, idleDays: 9 }))).toBe(
      r.sgTitleRhythmIdle(9),
    );
    expect(signalBody(r, sig('rhythm', { plannedThisWeek: 4 }))).toBe(r.sgBodyRhythm(4));
  });

  it('nodata: sets not shared vs no data', () => {
    expect(signalTitle(r, sig('nodata', {}, 'sets-not-shared'))).toBe(r.sgTitleNoSets);
    expect(signalTitle(r, sig('nodata', {}, 'no-data'))).toBe(r.sgTitleNoData);
    expect(signalTitle(r, sig('nodata', {}))).toBe(r.sgTitleNoData);
    expect(signalBody(r, sig('nodata', {}, 'sets-not-shared'))).toBe(r.sgBodyNoSets);
    expect(signalBody(r, sig('nodata', {}))).toBe(r.sgBodyNoData);
  });

  it('malformed facts (strings for numbers, nulls, NaN, missing) fall back to 0 / empty instead of NaN', () => {
    expect(signalTitle(r, sig('stall', { exercise: null, weeks: 'many' }))).toBe(
      r.sgTitleStall('', 0),
    );
    expect(signalBody(r, sig('pr', { e1rm: Number.NaN, previous: Number.POSITIVE_INFINITY }))).toBe(
      r.sgBodyPr(0, 0),
    );
    expect(signalTitle(r, sig('spike', {}))).toBe(r.sgTitleSpike('', 0));
  });
});

describe('toCsv', () => {
  it('quotes commas, quotes and newlines; doubles inner quotes; rows end with CRLF between them', () => {
    expect(toCsv([['a', 'b,c', 'say "hi"', 'x\ny']])).toBe('a,"b,c","say ""hi""","x\ny"');
    expect(toCsv([['1'], ['2']])).toBe('1\r\n2');
    expect(toCsv([])).toBe('');
  });

  it('neutralises every formula trigger (= + - @ tab CR) with a leading apostrophe, then quotes when needed', () => {
    for (const lead of ['=', '+', '-', '@', '\t'])
      expect(toCsv([[`${lead}cmd`]])).toBe(`'${lead}cmd`);
    expect(toCsv([['\rcmd']])).toBe(`"'\rcmd"`);
    expect(toCsv([['=A1,B1']])).toBe(`"'=A1,B1"`);
    expect(toCsv([['not=formula', '1-2']])).toBe('not=formula,1-2');
  });
});

describe('firstName', () => {
  it('first word of the trimmed name', () => {
    expect(firstName('  Iryna   Melnyk ')).toBe('Iryna');
    expect(firstName('')).toBe('');
  });
});

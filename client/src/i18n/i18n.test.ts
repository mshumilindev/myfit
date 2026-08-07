import { describe, expect, it } from 'vitest';
import { en } from './en';
import { uk } from './uk';
import { pl } from './pl';
import { lt } from './lt';
import { et } from './et';
import {
  fmtDurationHM,
  fmtDurationHuman,
  fmtKg,
  fmtSessionClock,
  fmtSet,
  fmtSetSnack,
  fmtTonnes,
  LOCALES,
  setLocale,
} from './index';

const dicts = { en, uk, pl, lt, et };

describe('dictionaries', () => {
  it('should expose every en key in every locale with the same type', () => {
    for (const [id, dict] of Object.entries(dicts)) {
      for (const key of Object.keys(en) as (keyof typeof en)[]) {
        expect(dict[key], `${id}.${String(key)}`).toBeDefined();
        expect(typeof dict[key], `${id}.${String(key)}`).toBe(typeof en[key]);
      }
    }
  });

  it('should keep weekday letters at exactly 7 per locale', () => {
    for (const dict of Object.values(dicts)) {
      expect(dict.weekDayLetters).toHaveLength(7);
    }
  });

  it('should register all five locales', () => {
    expect(Object.keys(LOCALES).sort()).toEqual(['en', 'et', 'lt', 'pl', 'uk']);
  });
});

describe('plurals', () => {
  it('should decline Ukrainian чергові зміни correctly', () => {
    expect(uk.signOutQueueBody(1)).toContain('1 зміна');
    expect(uk.signOutQueueBody(2)).toContain('2 зміни');
    expect(uk.signOutQueueBody(5)).toContain('5 змін');
    expect(uk.signOutQueueBody(11)).toContain('11 змін');
    expect(uk.signOutQueueBody(21)).toContain('21 зміна');
  });

  it('should decline Ukrainian підходи correctly', () => {
    expect(uk.nSetsTag(1)).toBe('1 підхід');
    expect(uk.nSetsTag(3)).toBe('3 підходи');
    expect(uk.nSetsTag(12)).toBe('12 підходів');
  });

  it('should decline Polish serie correctly', () => {
    expect(pl.nSetsTag(1)).toBe('1 seria');
    expect(pl.nSetsTag(2)).toBe('2 serie');
    expect(pl.nSetsTag(5)).toBe('5 serii');
    expect(pl.nSetsTag(22)).toBe('22 serie');
  });

  it('should decline Lithuanian serijos correctly', () => {
    expect(lt.nSetsTag(1)).toBe('1 serija');
    expect(lt.nSetsTag(2)).toBe('2 serijos');
    expect(lt.nSetsTag(10)).toBe('10 serijų');
    expect(lt.nSetsTag(11)).toBe('11 serijų');
    expect(lt.nSetsTag(21)).toBe('21 serija');
  });

  it('should pluralise Estonian muudatused correctly', () => {
    expect(et.offlineQueued(1)).toContain('1 muudatus j');
    expect(et.offlineQueued(5)).toContain('5 muudatust');
    expect(et.nSetsTag(1)).toBe('1 seeria');
    expect(et.nSetsTag(4)).toBe('4 seeriat');
  });

  it('should pluralise English changes correctly', () => {
    expect(en.offlineQueued(1)).toContain('1 change queued');
    expect(en.offlineQueued(2)).toContain('2 changes queued');
  });
});

describe('formatters', () => {
  it('should format the session clock like the boards (24:18, 8:00:00)', () => {
    expect(fmtSessionClock(24 * 60000 + 18000)).toBe('24:18');
    expect(fmtSessionClock(8 * 3600 * 1000)).toBe('8:00:00');
    expect(fmtSessionClock(0)).toBe('0:00');
  });

  it('should format volume with thin-space thousands (4 980 kg)', () => {
    expect(fmtKg(4980)).toBe('4\u2009980 kg');
    expect(fmtKg(700)).toBe('700 kg');
    expect(fmtKg(1385)).toBe('1\u2009385 kg');
  });

  it('should format tonnes to one decimal (2.1 t)', () => {
    expect(fmtTonnes(2100)).toBe('2.1 t');
    expect(fmtTonnes(3400)).toBe('3.4 t');
  });

  it('should format durations (1:12 h:mm and 1h 20m)', () => {
    expect(fmtDurationHM(72 * 60000)).toBe('1:12');
    expect(fmtDurationHM(54 * 60000)).toBe('0:54');
    expect(fmtDurationHuman(80 * 60000)).toBe('1h 20m');
    expect(fmtDurationHuman(40 * 60000)).toBe('40m');
  });

  it('should format sets in design order (85 × 8; snackbar 8 × 80 kg)', () => {
    setLocale('en');
    expect(fmtSet(85, 8)).toBe('85 × 8');
    // No weight means a bodyweight set, which the boards label BW — never 0.
    expect(fmtSet(null, 8)).toBe('BW × 8');
    expect(fmtSetSnack(8, 80)).toBe('8 × 80 kg');
    expect(fmtSetSnack(8, null)).toBe('8 × BW');
  });

  it('should label bodyweight sets in the active locale', () => {
    setLocale('uk');
    expect(fmtSet(null, 8)).toBe(`${uk.bodyweightShort} × 8`);
    setLocale('en');
  });
});

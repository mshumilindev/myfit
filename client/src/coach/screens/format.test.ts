import { describe, expect, it } from 'vitest';
import { rosterEn as r } from '../../i18n/coachRoster.en';
import type { Consent } from '../domain/types';
import { agoText, firstName, sharedReadable, toCsv } from './format';

describe('format', () => {
  it('toCsv neutralises formula-looking cells and quotes commas', () => {
    const out = toCsv([['=SUM(A1)', '+1', '-2', '@x', 'a,b', 'ok']]);
    expect(out).not.toMatch(/(^|,)"?[=+\-@]/);
    expect(out).toContain('"a,b"');
    expect(out).toContain('ok');
  });
  it('firstName', () => {
    expect(firstName('Oleh Bondar')).toBe('Oleh');
    expect(firstName('  Madonna ')).toBe('Madonna');
  });
  it('agoText returns a non-empty phrase', () => {
    const now = Date.UTC(2026, 9, 7, 9, 5);
    expect(agoText(r, now - 14 * 60_000, now)).toMatch(/14/);
  });
  it('sharedReadable lists exactly the consented, readable categories', () => {
    const off: Consent = {
      totals: 'off',
      sets: 'off',
      body: 'off',
      sleep: 'off',
      injury: 'off',
      nutrition: 'off',
      checkins: 'off',
    };
    expect(sharedReadable(r, 'app', off)).toBe(r.roSharesNone);
    // sleep/nutrition are shared but not readable by the trainer yet: never promised
    expect(
      sharedReadable(r, 'app', { ...off, totals: 'full', sleep: 'full', nutrition: 'full' }),
    ).toBe(r.c3Cat.totals.label);
    const both = sharedReadable(r, 'app', { ...off, totals: 'full', injury: 'full' });
    expect(both).toContain(r.c3Cat.totals.label);
    expect(both).toContain(r.c3Cat.injury.label);
    expect(both).not.toContain(r.c3Cat.sets.label);
    expect(sharedReadable(r, 'program', { ...off, totals: 'full' })).toBe(r.roSharesNone);
  });
});

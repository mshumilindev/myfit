/**
 * First-run locale detection (saved choice -> timezone -> browser language -> en) and the short weekday formatter.
 * `detect()` runs when the module is imported, so each case re-imports it with a stubbed timezone and language list.
 * The branches must not depend on the machine's own timezone: CI runs in UTC, the owner's machine in Europe/Warsaw, and
 * `client/src/i18n/index.ts` is the file the root coverage gate measures.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type I18n = typeof import('../client/src/i18n');

function stubTimezone(tz: string | 'throws') {
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation((() => {
    if (tz === 'throws') throw new Error('no Intl');
    return { resolvedOptions: () => ({ timeZone: tz }) };
  }) as unknown as typeof Intl.DateTimeFormat);
}

function stubLanguages(languages: string[], language = languages[0] ?? '') {
  Object.defineProperty(navigator, 'languages', { configurable: true, value: languages });
  Object.defineProperty(navigator, 'language', { configurable: true, value: language });
}

async function freshLocale(): Promise<I18n> {
  vi.resetModules();
  const mod = await import('../client/src/i18n');
  vi.restoreAllMocks(); // detection happened at import; later Intl use must be real
  return mod;
}

describe('first-run locale detection', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    stubLanguages(['en-US'], 'en-US');
  });

  it.each([
    ['Europe/Warsaw', 'pl'],
    ['Europe/Kyiv', 'uk'],
    ['Europe/Vilnius', 'lt'],
    ['Europe/Tallinn', 'et'],
  ])('timezone %s -> %s, even with an English browser', async (tz, expected) => {
    stubTimezone(tz);
    stubLanguages(['en-GB']);
    expect((await freshLocale()).getLocale()).toBe(expected);
  });

  it('an unmapped timezone falls back to the browser language list', async () => {
    stubTimezone('America/New_York');
    stubLanguages(['de-DE', 'pl-PL']);
    expect((await freshLocale()).getLocale()).toBe('pl');
  });

  it('falls back to navigator.language when the list is empty', async () => {
    stubTimezone('UTC');
    stubLanguages([], 'uk-UA');
    expect((await freshLocale()).getLocale()).toBe('uk');
  });

  it('a throwing Intl is not fatal: language, then English', async () => {
    stubTimezone('throws');
    stubLanguages(['et-EE']);
    expect((await freshLocale()).getLocale()).toBe('et');
    stubTimezone('throws');
    stubLanguages(['xx-XX']);
    expect((await freshLocale()).getLocale()).toBe('en');
  });

  it('English when nothing matches', async () => {
    stubTimezone('UTC');
    stubLanguages(['ja-JP']);
    expect((await freshLocale()).getLocale()).toBe('en');
  });

  it('a saved choice beats timezone and language', async () => {
    localStorage.setItem('gym.locale', 'lt');
    stubTimezone('Europe/Warsaw');
    stubLanguages(['uk-UA']);
    expect((await freshLocale()).getLocale()).toBe('lt');
  });

  it('an invalid saved value is ignored', async () => {
    localStorage.setItem('gym.locale', 'xx');
    stubTimezone('Europe/Kyiv');
    expect((await freshLocale()).getLocale()).toBe('uk');
  });
});

describe('fmtWeekdayShort', () => {
  it('returns the short weekday without a trailing dot, per locale', async () => {
    const { fmtWeekdayShort } = await import('../client/src/i18n');
    const monday = Date.UTC(2026, 9, 26, 12); // Monday 26 Oct 2026
    expect(fmtWeekdayShort(monday, 'en')).toBe('Mon');
    for (const id of ['en', 'uk', 'pl', 'lt', 'et'] as const) {
      const out = fmtWeekdayShort(monday, id);
      expect(out.length).toBeGreaterThan(0);
      expect(out).not.toContain('.');
    }
  });
});

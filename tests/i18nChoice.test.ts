/**
 * Language choice events and the account-synced language (SPO-389). `client/src/i18n/index.ts` is the file the root
 * coverage gate measures, so these branches are pinned here as well as in client/src/i18n/localeChoice.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyRemoteLocale,
  getLocale,
  hasSavedLocale,
  onLocaleChoice,
  setLocale,
} from '../client/src/i18n';

describe('language choice and the account language', () => {
  beforeEach(() => {
    localStorage.clear();
    setLocale('en');
  });

  it('a different language is a choice; the same one is not', () => {
    const fn = vi.fn();
    const off = onLocaleChoice(fn);
    setLocale('uk');
    setLocale('uk');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('uk');
    off();
    setLocale('pl');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('a language from the account is applied and cached without being a choice', () => {
    const fn = vi.fn();
    const off = onLocaleChoice(fn);
    applyRemoteLocale('lt');
    expect(getLocale()).toBe('lt');
    expect(localStorage.getItem('gym.locale')).toBe('lt');
    applyRemoteLocale('lt'); // already current
    applyRemoteLocale('xx'); // unknown
    expect(getLocale()).toBe('lt');
    expect(fn).not.toHaveBeenCalled();
    off();
  });

  it('knows whether the person picked a language on this device', () => {
    localStorage.clear();
    expect(hasSavedLocale()).toBe(false);
    setLocale('et');
    expect(hasSavedLocale()).toBe(true);
  });

  it('an unreadable storage means nothing is saved', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(hasSavedLocale()).toBe(false);
    spy.mockRestore();
  });
});

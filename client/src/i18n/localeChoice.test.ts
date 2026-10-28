import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyRemoteLocale, getLocale, onLocaleChoice, setLocale } from './index';

describe('language choice events (SPO-389)', () => {
  beforeEach(() => setLocale('en'));

  it('a different language is the person’s choice', () => {
    const fn = vi.fn();
    const off = onLocaleChoice(fn);
    setLocale('uk');
    expect(fn).toHaveBeenCalledWith('uk');
    off();
  });

  it('picking the language already in use is not a change for the account', () => {
    const fn = vi.fn();
    const off = onLocaleChoice(fn);
    setLocale('en');
    expect(fn).not.toHaveBeenCalled();
    expect(localStorage.getItem('gym.locale')).toBe('en');
    off();
  });

  it('a language from the account is applied without being sent back', () => {
    const fn = vi.fn();
    const off = onLocaleChoice(fn);
    applyRemoteLocale('pl');
    expect(getLocale()).toBe('pl');
    expect(fn).not.toHaveBeenCalled();
    off();
  });
});

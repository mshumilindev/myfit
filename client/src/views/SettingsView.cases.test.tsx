import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SettingsView } from './SettingsView';
import { isFlagOn } from '../data/flags';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';

beforeEach(() => {
  localStorage.clear();
  setLocale('en');
});
afterEach(cleanup);

describe('SettingsView', () => {
  it('lists every feature flag, all off by default, and goes back', () => {
    const onClose = vi.fn();
    render(<SettingsView onClose={onClose} />);
    expect(screen.getByText(en.settingsTitle)).toBeTruthy();
    expect(screen.getByText(en.settingsSub)).toBeTruthy();
    for (const label of [en.flagNutrition]) {
      const sw = screen.getByRole('switch', { name: label }) as HTMLInputElement | HTMLElement;
      expect(sw.getAttribute('aria-checked') ?? (sw as HTMLInputElement).checked).toMatch(
        /false|^$|undefined/,
      );
    }
    expect(screen.getByText(en.flagNutritionDesc)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.backAction }));
    expect(onClose).toHaveBeenCalled();
  });

  it('flipping a switch turns the device flag on, persists it and re-renders; flipping again turns it off', () => {
    render(<SettingsView onClose={() => undefined} />);
    const sw = () => screen.getByRole('switch', { name: en.flagNutrition });
    expect(isFlagOn('nutrition')).toBe(false);
    fireEvent.click(sw());
    expect(isFlagOn('nutrition')).toBe(true);
    expect(JSON.parse(localStorage.getItem('gym.flags') ?? '{}')).toMatchObject({
      nutrition: true,
    });
    expect(sw().getAttribute('aria-checked')).toBe('true');
    fireEvent.click(sw());
    expect(isFlagOn('nutrition')).toBe(false);
    expect(sw().getAttribute('aria-checked')).toBe('false');
  });

  it('starts with the flags already stored on the device', () => {
    localStorage.setItem('gym.flags', JSON.stringify({ nutrition: true }));
    render(<SettingsView onClose={() => undefined} />);
    expect(
      screen.getByRole('switch', { name: en.flagNutrition }).getAttribute('aria-checked'),
    ).toBe('true');
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeSettingsView } from './ThemeSettingsView';
import { en } from '../i18n/en';
import { getAxis } from '../themes';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.setAttribute('data-theme', 'studio');
  document.documentElement.setAttribute('data-mode', 'dark');
  document.documentElement.setAttribute('data-accent', 'titan');
});
afterEach(cleanup);

const save = () => screen.getByRole('button', { name: en.save });

describe('ThemeSettingsView', () => {
  it('opens with Titanium selected and Save off', () => {
    render(<ThemeSettingsView onClose={() => undefined} />);
    expect(screen.getAllByRole('radio')).toHaveLength(9);
    expect(
      screen.getByRole('radio', { name: new RegExp(en.accentTitan) }).getAttribute('aria-checked'),
    ).toBe('true');
    expect((save() as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows a picked accent at once as a draft, saves only on Save', () => {
    render(<ThemeSettingsView onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(en.accentLime) }));
    expect(getAxis('accent')).toBe('lime');
    expect(localStorage.getItem('gym.accent')).toBeNull();
    expect((save() as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(save());
    expect(localStorage.getItem('gym.accent')).toBe('lime');
    expect((save() as HTMLButtonElement).disabled).toBe(true);
  });

  it('puts the saved look back when the page is left without Save', () => {
    const { unmount } = render(<ThemeSettingsView onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(en.accentIndigo) }));
    expect(getAxis('accent')).toBe('indigo');
    unmount();
    expect(getAxis('accent')).toBe('titan');
  });

  it('Reset asks first, then returns the draft to Auto + Titanium', () => {
    localStorage.setItem('gym.accent', 'crimson');
    document.documentElement.setAttribute('data-accent', 'crimson');
    render(<ThemeSettingsView onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: en.themeReset }));
    expect(screen.getByText(en.themeResetTitle)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.themeResetConfirm }));
    expect(
      screen.getByRole('radio', { name: new RegExp(en.accentTitan) }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(localStorage.getItem('gym.accent')).toBe('crimson'); // not saved until Save
    expect((save() as HTMLButtonElement).disabled).toBe(false);
  });

  it('Back with unsaved changes asks first; without changes it just leaves', () => {
    let closed = 0;
    render(<ThemeSettingsView onClose={() => (closed += 1)} />);
    fireEvent.click(screen.getByRole('button', { name: en.backAction }));
    expect(closed).toBe(1);
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(en.accentLime) }));
    fireEvent.click(screen.getByRole('button', { name: en.backAction }));
    expect(closed).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: en.themeLeaveStay }));
    expect(closed).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: en.backAction }));
    fireEvent.click(screen.getByRole('button', { name: en.themeLeaveConfirm }));
    expect(closed).toBe(2);
  });
});

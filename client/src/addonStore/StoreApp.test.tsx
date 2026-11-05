import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setRole } from '../api';
import { setHash } from '../route';
import { addonsPref } from '../addons/enabledSet';
import * as enabledSet from '../addons/enabledSet';
import { StoreApp } from './StoreApp';
import { StoreInstalled } from './StoreInstalled';

vi.mock('../components/suite/BrandAccount', () => ({
  BrandAccount: () => <span data-testid="avatar" />,
}));

beforeEach(() => {
  localStorage.clear();
  addonsPref.reset();
  setRole('member');
  setHash('#/store', true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('StoreApp tabs', () => {
  it('Discover: week pick, progress, not-turned-on list and coming soon (no action buttons)', () => {
    render(<StoreApp role="member" onOpenProfile={() => {}} />);
    expect(screen.getByText('App of the week')).toBeTruthy();
    expect(screen.getByText(/^0 of \d+ turned on$/)).toBeTruthy();
    expect(screen.getByText('Coming soon')).toBeTruthy();
    expect(screen.getAllByText('Nutrition').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Music').length).toBeGreaterThan(0);
    expect(screen.queryByText(/notify/i)).toBeNull();
    expect(screen.getByTestId('avatar')).toBeTruthy();
  });

  it('Discover: search narrows the list', () => {
    render(<StoreApp role="member" onOpenProfile={() => {}} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzzz' } });
    expect(screen.getByText('Nothing found')).toBeTruthy();
  });

  it('Browse: categories open a filtered list; Food shows Soon', () => {
    setHash('#/store/browse', true);
    render(<StoreApp role="member" onOpenProfile={() => {}} />);
    expect(screen.getByText('Recovery')).toBeTruthy();
    expect(screen.getAllByText('Soon').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('Recovery'));
    expect(screen.getByText('Sleep sounds')).toBeTruthy();
    expect(screen.queryByText('Atlas')).toBeNull();
  });

  it('Installed starts empty (nothing is on until chosen)', () => {
    setHash('#/store/installed', true);
    render(<StoreApp role="member" onOpenProfile={() => {}} />);
    expect(screen.getByText('Only the base so far')).toBeTruthy();
  });

  it('switches tabs through the address', () => {
    render(<StoreApp role="member" onOpenProfile={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Installed' }));
    expect(window.location.pathname + window.location.hash).toMatch(/installed/);
    expect(screen.getByText('Only the base so far')).toBeTruthy();
  });
});

describe('StoreInstalled toggles', () => {
  it('shows an enabled app with its add-ons and calls disable / enable', () => {
    act(() => enabledSet.enableAddons(['sleep', 'sleep-sounds'], 'member'));
    const enable = vi.spyOn(enabledSet, 'enableAddons');
    const disable = vi.spyOn(enabledSet, 'disableAddons');
    render(<StoreInstalled role="member" />);
    const sounds = screen.getByRole('switch', { name: 'Turn on Sleep sounds' }) as HTMLInputElement;
    expect(sounds.checked).toBe(true);
    const auto = screen.getByRole('switch', {
      name: 'Turn on Sleep auto-start',
    }) as HTMLInputElement;
    expect(auto.checked).toBe(false);

    fireEvent.click(auto);
    expect(enable).toHaveBeenCalledWith(['sleep-auto-start'], 'member');
    fireEvent.click(screen.getByRole('switch', { name: 'Turn on Sleep sounds' }));
    expect(disable).toHaveBeenCalledWith(['sleep-sounds'], 'member');
    const sleep = screen.getByRole('switch', { name: 'Turn on Sleep' });
    expect(within(sleep.closest('section') as HTMLElement).getAllByRole('switch').length).toBe(3);
  });
});

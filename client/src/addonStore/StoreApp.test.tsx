// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addonsPref } from '../addons/enabledSet';
import { addonsQueuePref } from '../addons/queue';
import { currentHash } from '../route';
import { StoreApp } from './StoreApp';

beforeEach(() => {
  addonsPref.reset();
  addonsQueuePref.reset();
  window.location.hash = '#/store';
});
afterEach(cleanup);

describe('StoreApp', () => {
  it('keeps a picked item in Recommended as "Selected", and a click un-picks it', () => {
    render(<StoreApp role="member" onOpenProfile={() => {}} />);
    const add = screen.getAllByRole('button', { name: 'Add' })[0]!;
    fireEvent.click(add);
    const picked = screen.getAllByRole('button', { name: /Selected ✓/ });
    expect(picked.length).toBeGreaterThan(0);
    expect(addonsQueuePref.get().length).toBeGreaterThan(0);
    act(() => fireEvent.click(picked[0]!));
    expect(addonsQueuePref.get()).toEqual([]);
    expect(screen.getAllByRole('button', { name: 'Add' }).length).toBeGreaterThan(0);
  });
  it('shows an empty Selected screen with no install action', () => {
    window.location.hash = '#/store/selected';
    render(<StoreApp role="member" onOpenProfile={() => {}} />);
    expect(screen.getAllByText(/Nothing waiting/i).length).toBeGreaterThan(0);
  });
  it('Cancel in search returns to the tab it was opened from, not out of the store', () => {
    window.location.hash = '#/store/apps';
    render(<StoreApp role="member" onOpenProfile={() => {}} />);
    fireEvent.focus(
      screen.getAllByRole('searchbox')[0] ?? screen.getAllByPlaceholderText(/Search/)[0]!,
    );
    expect(currentHash()).toBe('#/store/search');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(currentHash()).toBe('#/store/apps');
  });
  it('lets you leave the store from the header', () => {
    render(<StoreApp role="member" onOpenProfile={() => {}} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Back to Spotter' })[0]!);
    expect(currentHash()).toBe('#/today');
  });
});

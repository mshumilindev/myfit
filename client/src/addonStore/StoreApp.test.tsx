// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addonsPref, enableAddons } from '../addons/enabledSet';
import { resetInstall } from '../addons/installRun';
import { addonsQueuePref, modulePickPref, queueAdd } from '../addons/queue';
import { currentHash } from '../route';
import { StoreApp } from './StoreApp';

beforeEach(() => {
  addonsPref.reset();
  addonsQueuePref.reset();
  modulePickPref.reset();
  resetInstall();
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
  it('Selected lists the modules of a picked item, all off, and ticking one picks it', () => {
    queueAdd(['health'], 'member');
    window.location.hash = '#/store/selected';
    render(<StoreApp role="member" onOpenProfile={() => {}} />);
    const sw = screen.getAllByRole('switch', { name: 'Cycle' })[0]!;
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(screen.getAllByRole('switch', { name: 'Unwell' }).length).toBeGreaterThan(0);
    fireEvent.click(sw);
    expect(modulePickPref.get()).toEqual(['cycle']);
  });
  it('Discover has a Themes tile in the bento next to the other small tiles', () => {
    render(<StoreApp role="member" onOpenProfile={() => {}} />);
    const tile = screen.getAllByText('Looks')[0]!.closest('.sk-btile')!;
    expect(tile.classList.contains('sk-btile-span2')).toBe(false); // four small tiles: a 2x2 block
    fireEvent.click(tile);
    expect(currentHash()).toBe('#/store/themes');
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
  it('Install runs the picked list, lands on All set, and Undo puts it back in Selected', async () => {
    queueAdd(['atlas'], 'member');
    window.location.hash = '#/store/selected';
    render(<StoreApp role="member" onOpenProfile={() => {}} />);
    fireEvent.click(screen.getAllByRole('button', { name: /Install 1 item/ })[0]!);
    expect(currentHash()).toBe('#/store/installing');
    await waitFor(() => expect(currentHash()).toBe('#/store/done'), { timeout: 3000 });
    expect(addonsPref.get()).toContain('atlas');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(addonsPref.get()).not.toContain('atlas');
    expect(addonsQueuePref.get()).toEqual(['atlas']);
    expect(currentHash()).toBe('#/store/selected');
  });
  it('the install screens are left for Discover when nothing is running', async () => {
    window.location.hash = '#/store/done';
    render(<StoreApp role="member" onOpenProfile={() => {}} />);
    await waitFor(() => expect(currentHash()).toBe('#/store'));
  });
  it('a coming-soon item shows the note and what is planned, with no add action', () => {
    window.location.hash = '#/store/item/music';
    render(<StoreApp role="member" onOpenProfile={() => {}} />);
    expect(screen.getByText('Not available yet.')).toBeTruthy();
    expect(screen.getByText('Playlist per session')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Add$|^Add with/ })).toBeNull();
  });
  it('offline: a bar says so and adding is replaced by a disabled Offline pill; installed items stay', () => {
    const net = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(<StoreApp role="member" onOpenProfile={() => {}} />);
    expect(screen.getByText('You are offline.')).toBeTruthy();
    const pills = screen.getAllByRole('button', { name: 'Offline' });
    expect(pills.length).toBeGreaterThan(0);
    expect((pills[0] as HTMLButtonElement).disabled).toBe(true);
    net.mockRestore();
  });
  it('Manage shows the modules as switches; Remove asks first, then removes the app with its add-ons', () => {
    enableAddons(['injury-log', 'sleep'], 'member');
    window.location.hash = '#/store/manage/health';
    render(<StoreApp role="member" onOpenProfile={() => {}} />);
    expect(screen.getAllByRole('switch').length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Health' }));
    expect(addonsPref.get()).toContain('health');
    expect(screen.getByText(/Your entries stay saved/)).toBeTruthy();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }));
    expect(addonsPref.get()).toEqual(['sleep']);
    expect(currentHash()).toBe('#/store/installed');
  });
  it('Cancel in the remove sheet changes nothing', () => {
    enableAddons(['health'], 'member');
    window.location.hash = '#/store/manage/health';
    render(<StoreApp role="member" onOpenProfile={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Health' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(addonsPref.get()).toContain('health');
  });
  it('No results offers suggestions and categories; a category opens Apps on it', () => {
    window.location.hash = '#/store/search';
    render(<StoreApp role="member" onOpenProfile={() => {}} />);
    fireEvent.change(screen.getAllByRole('searchbox')[0]!, { target: { value: 'zzzz' } });
    expect(screen.getByText(/Nothing for/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Insights' }));
    expect(currentHash()).toBe('#/store/apps?cat=insights');
  });
  it('an empty Installed points to Add-ons', () => {
    window.location.hash = '#/store/installed';
    render(<StoreApp role="member" onOpenProfile={() => {}} />);
    expect(screen.getByText('Training, Today and Chat are always on.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Browse add-ons' }));
    expect(currentHash()).toBe('#/store/addons');
  });
  it('Discover turns into the progress hero when most of the catalog is installed', () => {
    enableAddons(['health', 'sleep', 'theme-cyberpunk'], 'member');
    render(<StoreApp role="member" onOpenProfile={() => {}} />);
    expect(screen.getByText(/left to complete Spotter/)).toBeTruthy();
    expect(screen.queryByText('App of the week')).toBeNull();
  });
  it('and says everything is added when nothing is left', () => {
    enableAddons(['health', 'sleep', 'atlas', 'apex', 'theme-cyberpunk'], 'member');
    render(<StoreApp role="member" onOpenProfile={() => {}} />);
    expect(screen.getByText('Everything is added')).toBeTruthy();
  });
});

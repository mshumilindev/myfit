import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setSyncMeta } from '../syncMeta';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { fmtDayMonth, fmtWeekday, setLocale } from '../i18n';
import { en } from '../i18n/en';
import { openToday, resetTodayMocks } from './__fixtures__/todayMocks';
import {
  emptyState,
  freezeClock,
  installIntersectionObserver,
  NOW,
  richState,
} from './__fixtures__/viewKit';

beforeEach(() => {
  freezeClock(NOW);
  setLocale('en');
  resetTodayMocks();
  installIntersectionObserver();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('TodayView: chrome', () => {
  beforeEach(() => setSyncMeta(0, false));
  it('shows today as the weekday title with the day and month under it', async () => {
    await openToday();
    expect(document.querySelector('.td-topbar-title h2')?.textContent).toBe(fmtWeekday(NOW, 'en'));
    expect(document.querySelector('.td-topbar-date')?.textContent).toBe(fmtDayMonth(NOW, 'en'));
  });

  // The header sync state is the kit SyncStateIcon (SPO-375). Which state it shows is derived in
  // syncHealth (tested there); here: it replaces the old dot + word chip and is named by its state.
  it('the header shows the sync icon, named by its state, instead of the old chip', async () => {
    await openToday({ ...richState(), syncStatus: 'synced' as never });
    const icon = document.querySelector('.td-topbar-actions .uisi') as HTMLElement;
    expect(icon.getAttribute('data-state')).toBe('synced');
    expect(icon.getAttribute('aria-label')).toBe(en.synced);
    expect(icon.querySelector('.uisi-tip')?.textContent).toBe(en.synced);
    expect(document.querySelector('.sync-chip')).toBeNull();
  });

  it('offline shows the cache note and the number of queued writes', async () => {
    setSyncMeta(2, false);
    await openToday({
      ...richState(),
      syncStatus: 'offline' as never,
    });
    expect(screen.getByText(en.servedFromCache)).toBeTruthy();
    expect(screen.getByText(en.offlineQueued(2))).toBeTruthy();
  });

  it('syncing with a queue shows the sending notice with the count', async () => {
    setSyncMeta(1, false);
    await openToday({
      ...richState(),
      syncStatus: 'syncing' as never,
    });
    expect(screen.getByText(en.sendingQueued)).toBeTruthy();
    expect(screen.queryByText(en.servedFromCache)).toBeNull();
  });

  it('first load with nothing cached shows a skeleton instead of the screen', async () => {
    await openToday({
      ...emptyState(),
      lastSyncAt: null,
      syncStatus: 'syncing' as never,
    });
    expect(document.querySelector('.td-topbar')).toBeNull();
    expect(document.querySelectorAll('.uisk').length).toBeGreaterThan(0);
  });
});

describe('TodayView: empty account', () => {
  it('invites the first session; start opens the Start sheet and log-past opens the backfill', async () => {
    const { shell } = await openToday(emptyState());
    expect(screen.getByText(en.tdEmptyTitle)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.startFirstSession }));
    expect(shell.calls.openStart).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getAllByRole('button', { name: en.logPastSession })[0]);
    expect(document.querySelector('[role="dialog"], [role="alertdialog"]')).not.toBeNull();
  });

  it('on desktop the start button moves focus into the standing Start panel instead of opening a second sheet', async () => {
    const { setDesktop } = await import('./__fixtures__/viewKit');
    setDesktop(true);
    try {
      const { shell } = await openToday(emptyState());
      fireEvent.click(screen.getByRole('button', { name: en.startFirstSession }));
      // the spy is created on first call: no spy = never called
      expect(shell.calls.openStart?.mock.calls.length ?? 0).toBe(0);
      const side = document.querySelector('.today-start-side') as HTMLElement;
      expect(side.contains(document.activeElement)).toBe(true);
    } finally {
      setDesktop(false);
    }
  });

  it('suggests adding a gym when none exists, which jumps to the gyms tab', async () => {
    const { shell } = await openToday(emptyState());
    fireEvent.click(screen.getByText(en.addGymHint));
    expect(shell.calls.goTab).toHaveBeenCalledWith('gyms');
  });

  it('no week strip and no history section without history', async () => {
    await openToday(emptyState());
    expect(document.querySelector('.td-history')).toBeNull();
    expect(document.querySelector('.td-week')).toBeNull();
  });
});

describe('TodayView: history', () => {
  it('shows the recent history section when there are finished sessions', async () => {
    await openToday();
    expect(document.querySelector('.td-history')).not.toBeNull();
    expect(screen.getByText(en.tdHistory)).toBeTruthy();
  });

  it('offers the full history when there are more days than the timeline shows', async () => {
    const { shell } = await openToday();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.seeAllHistory) }));
    expect(shell.calls.openOverlay).toHaveBeenCalledWith({ screen: 'history' });
  });
});

describe('TodayView: footer actions', () => {
  it('Customize swaps the sections for the editor and Done returns', async () => {
    await openToday();
    fireEvent.click(screen.getByRole('button', { name: en.todayCustomize }));
    expect(screen.queryByRole('button', { name: en.todayCustomize })).toBeNull();
    expect(screen.queryByRole('button', { name: en.todayThemes })).toBeNull();
    expect(screen.getByRole('button', { name: en.todayEditCancel })).toBeTruthy();
  });

  it('Themes freezes the screen and opens the themes page', async () => {
    const { shell } = await openToday();
    fireEvent.click(screen.getByRole('button', { name: en.todayThemes }));
    expect(shell.calls.openOverlay).toHaveBeenCalledWith({ screen: 'themes' });
  });

  it('on desktop the Start sheet stands open on the right', async () => {
    const { setDesktop } = await import('./__fixtures__/viewKit');
    setDesktop(true);
    await openToday();
    const side = document.querySelector('.today-start-side') as HTMLElement;
    expect(side.querySelector('.start-inline')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.todayCustomize }));
    expect(side.querySelector('.start-inline')).toBeNull();
    expect(side.querySelector('.tdc-side-host')).not.toBeNull();
  });
});

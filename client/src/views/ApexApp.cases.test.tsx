import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApexApp, APEX_TABS, type ApexTab } from './ApexApp';
import { __getStateForTests } from '../store';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import type { Notif, NotifState } from '../notifications';
import {
  emptyState,
  freezeClock,
  installIntersectionObserver,
  NOW,
  richState,
  seed,
  setDesktop,
} from './__fixtures__/viewKit';

const drawn: Array<{
  headline: string;
  kicker: string;
  hero: { value: string; label: string };
  rows: Array<{ name: string; detail: string; accent: boolean; lead: string }>;
}> = [];
vi.mock('../data/shareCard', async (orig) => ({
  ...(await orig<typeof import('../data/shareCard')>()),
  drawStatCard: vi.fn(async (_cv: unknown, model: never) => {
    drawn.push(model);
  }),
  cardBlob: vi.fn(async () => null),
}));

const feedNotif: Notif = {
  id: 'n1',
  kind: 'pr',
  ts: NOW - 1000,
  title: 'New PR',
  subtitle: 'Bench',
};

beforeEach(() => {
  freezeClock();
  setLocale('en');
  localStorage.clear();
  seed(richState());
  setDesktop(false);
  installIntersectionObserver();
  drawn.length = 0;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function app(tab: ApexTab, over: Partial<Parameters<typeof ApexApp>[0]> = {}) {
  const props = {
    store: __getStateForTests(),
    now: NOW,
    tab,
    onTab: vi.fn(),
    onOpenShell: vi.fn(),
    onOpenProfile: vi.fn(),
    notifs: [feedNotif],
    notifState: { n1: { ts: NOW, seen: false } } as NotifState,
    notifUnread: 3,
    onNotifSeen: vi.fn(),
    onNotifMarkAll: vi.fn(),
    ...over,
  };
  return { ...render(<ApexApp {...props} />), props };
}

describe('ApexApp', () => {
  it('exposes the five tabs in order', () => {
    expect(APEX_TABS).toEqual(['home', 'challenges', 'ranks', 'awards', 'feed']);
  });

  it('home tab: the overview, four nav items on a phone, the bell badge and the apps switch', () => {
    const { props, container } = app('home');
    expect(container.querySelector('.apx-home')).toBeTruthy();
    for (const label of [en.apexHomeTab, en.challengesTab, en.apexRanksTab, en.apexAwardsTab])
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: new RegExp(en.feedTitle) }).textContent).toContain(
      '3',
    );
    fireEvent.click(screen.getByRole('button', { name: en.shellSwitch }));
    expect(props.onOpenShell).toHaveBeenCalled();
  });

  it('choosing a nav item reports the tab', () => {
    const { props } = app('home');
    const bar = document.querySelector('.suite-tabbar, nav') as HTMLElement;
    fireEvent.click(within(bar).getByText(en.apexRanksTab));
    expect(props.onTab).toHaveBeenCalledWith('ranks');
  });

  it('the bell opens the feed, and on the feed tab the badge is hidden and the feed renders', () => {
    const { props } = app('home');
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.feedTitle) }));
    expect(props.onTab).toHaveBeenCalledWith('feed');
    cleanup();
    const feed = app('feed');
    expect(screen.getByText('New PR')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: new RegExp(en.feedTitle) }).textContent,
    ).not.toContain('3');
    fireEvent.click(screen.getByRole('button', { name: en.notifMarkAll }));
    expect(feed.props.onNotifMarkAll).toHaveBeenCalled();
  });

  it('challenges tab hosts the challenge hub', () => {
    app('challenges');
    expect(document.querySelector('.ch-head h2')?.textContent).toBe(en.challengesTitle);
  });

  it('ranks tab shows the standards and the share sheet carries the trained lifts', async () => {
    app('ranks');
    expect(document.querySelector('.apex-page h2')?.textContent).toBe(en.ranksTitle);
    fireEvent.click(screen.getByRole('button', { name: en.rcShare }));
    await waitFor(() => expect(drawn.length).toBeGreaterThan(0));
    const m = drawn[drawn.length - 1];
    expect(m.kicker).toBe(en.ranksTitle);
    expect(m.headline).toBe(en.apxRanksShareLine);
    expect(m.hero.label).toBe(en.apxRanksUnit);
    expect(Number(m.hero.value)).toBeGreaterThan(0);
    expect(m.rows.length).toBeGreaterThan(0);
    expect(m.rows.length).toBeLessThanOrEqual(6);
    for (const r of m.rows) expect(r.detail).toMatch(/\d+ kg$/);
  });

  it('the ranks share needs a known sex and weight; without them nothing opens', () => {
    const s = richState();
    const store = { ...s, bodyMetrics: { ...s.bodyMetrics, sex: undefined } } as never;
    app('ranks', { store });
    fireEvent.click(screen.getByRole('button', { name: en.rcShare }));
    expect(drawn).toHaveLength(0);
    cleanup();
    const noWeight = { ...s, bodyMetrics: { ...s.bodyMetrics, weights: [] } } as never;
    app('ranks', { store: noWeight });
    fireEvent.click(screen.getByRole('button', { name: en.rcShare }));
    expect(drawn).toHaveLength(0);
  });

  it('female accounts share with the female standards', async () => {
    const s = richState();
    const store = { ...s, bodyMetrics: { ...s.bodyMetrics, sex: 'female' } } as never;
    app('ranks', { store });
    fireEvent.click(screen.getByRole('button', { name: en.rcShare }));
    await waitFor(() => expect(drawn.length).toBeGreaterThan(0));
    expect(drawn[0].headline).toBe(en.apxRanksShareLine);
  });

  it('awards tab lists achievements and shares the unlocked ones', async () => {
    app('awards');
    expect(document.querySelector('.apex-page h2')?.textContent).toBe(en.awardsTitle);
    fireEvent.click(screen.getByRole('button', { name: en.rcShare }));
    await waitFor(() => expect(drawn.length).toBeGreaterThan(0));
    const m = drawn[drawn.length - 1];
    expect(m.kicker).toBe(en.awardsTitle);
    expect(m.headline).toBe(en.apxAwardsShareLine);
    expect(m.hero.label).toBe(en.apxAwardsUnit);
    expect(Number(m.hero.value)).toBeGreaterThan(0);
    expect(m.rows.length).toBeLessThanOrEqual(6);
    expect(m.rows[0].detail).toMatch(/[A-Za-z]{3}|✓/);
  });

  it('closing the share sheet returns to the tab', async () => {
    app('awards');
    fireEvent.click(screen.getByRole('button', { name: en.rcShare }));
    await waitFor(() => expect(document.querySelector('canvas')).toBeTruthy());
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(document.querySelector('canvas')).toBeNull());
  });

  it('awards share on an empty account still opens (zero unlocked)', async () => {
    seed(emptyState());
    app('awards', { store: emptyState() });
    fireEvent.click(screen.getByRole('button', { name: en.rcShare }));
    await waitFor(() => expect(drawn.length).toBeGreaterThan(0));
    expect(drawn[0].hero.value).toBe('0');
    expect(drawn[0].rows).toEqual([]);
  });

  it('desktop uses the rail (no bottom bar) whose entries switch tabs, open the feed and the profile', () => {
    setDesktop(true);
    const { props, container } = app('ranks');
    expect(container.querySelector('.app-rail, [class*="rail"]')).toBeTruthy();
    const rail = container.querySelector('.app-rail, [class*="rail"]') as HTMLElement;
    fireEvent.click(within(rail).getByText(en.challengesTab));
    expect(props.onTab).toHaveBeenCalledWith('challenges');
  });

  it('desktop rail: the bell entry opens the feed with its unread badge and no entry is active on the feed', () => {
    setDesktop(true);
    const { props, container } = app('home');
    const bell = within(
      container.querySelector('.app-rail, [class*="rail"]') as HTMLElement,
    ).getByRole('button', { name: new RegExp(en.notifTitle) });
    expect(bell.textContent).toContain('3');
    fireEvent.click(bell);
    expect(props.onTab).toHaveBeenCalledWith('feed');
    cleanup();
    const onFeed = app('feed');
    expect(onFeed.container.querySelector('[class*="rail"] [aria-current="page"]')).toBeNull();
  });

  it('desktop rail: the Apps entry opens the shell switcher', () => {
    setDesktop(true);
    const { props, container } = app('home');
    fireEvent.click(container.querySelector('.rail-switch') as HTMLElement);
    expect(props.onOpenShell).toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ApexHome } from './ApexHome';
import { __getStateForTests } from '../store';
import { giveUpChallenge, startChallenge } from '../challenges';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import type { Notif } from '../notifications';
import { DAY, emptyState, freezeClock, NOW, richState, seed } from './__fixtures__/viewKit';

const notif = (id: string, kind: Notif['kind'], ageMs: number): Notif => ({
  id,
  kind,
  ts: NOW - ageMs,
  title: `T-${id}`,
  subtitle: `S-${id}`,
});

const started: string[] = [];
beforeEach(() => {
  freezeClock();
  setLocale('en');
  localStorage.clear();
  seed(richState());
});
afterEach(() => {
  for (const id of started.splice(0)) giveUpChallenge(id);
  cleanup();
  vi.useRealTimers();
});

function view(over: Partial<Parameters<typeof ApexHome>[0]> = {}) {
  const onTab = vi.fn();
  const out = render(
    <ApexHome store={__getStateForTests()} now={NOW} notifs={[]} onTab={onTab} {...over} />,
  );
  return { ...out, onTab };
}

describe('ApexHome', () => {
  it('on an empty account: no active challenge, zero streak, no rank, no award, no feed', () => {
    seed(emptyState());
    const { onTab, container } = view({ store: emptyState() });
    expect(screen.getByText(en.apexNoActive)).toBeTruthy();
    expect(screen.getByText(en.notifStreakTitle(0))).toBeTruthy();
    expect(screen.queryByText(en.apexNextRank)).toBeNull();
    expect(screen.queryByText(en.apexLatestAward)).toBeNull();
    expect(screen.queryByText(en.apexRecent)).toBeNull();
    expect(container.querySelectorAll('.apx-dot').length).toBe(7);
    fireEvent.click(screen.getByText(en.apexNoActive));
    expect(onTab).toHaveBeenCalledWith('challenges');
  });

  it('shows the running challenge with live progress and opens Challenges', () => {
    started.push(startChallenge('sessions', 12, 14, NOW - 5 * DAY).id);
    const { onTab, container } = view();
    expect(screen.queryByText(en.apexNoActive)).toBeNull();
    expect(container.querySelector('.apx-active')).toBeTruthy();
    expect(container.querySelector('.apx-active-sub')?.textContent).toContain(en.chDaysLeft(9));
    fireEvent.click(container.querySelector('.apx-active') as HTMLElement);
    expect(onTab).toHaveBeenCalledWith('challenges');
  });

  it('skips challenges that are not active', () => {
    const ac = startChallenge('sessions', 12, 14, NOW - 5 * DAY);
    started.push(ac.id);
    // an unknown template never renders as the card
    started.push(startChallenge('no-such-template', 3, 7, NOW - DAY).id);
    const { container } = view();
    expect(container.querySelectorAll('.apx-active').length).toBe(1);
  });

  it('week dots: trained and rest days are "on", missed past days "off", days to come "future"', () => {
    const { container } = view();
    const dots = [...container.querySelectorAll('.apx-dot')].map((d) =>
      d.className.replace('apx-dot st-', ''),
    );
    // NOW is Saturday: Mon-Sat are not in the future, Sunday is.
    expect(dots).toHaveLength(7);
    expect(dots[6]).toBe('future');
    expect(dots.slice(0, 6).every((d) => d === 'on' || d === 'off')).toBe(true);
    // the fixture trains Mon/Wed/Fri of the current week (21, 23, 25 Sep)
    expect(dots[0]).toBe('on');
    expect(dots[1]).toBe('off');
    expect(dots[2]).toBe('on');
    expect(dots[4]).toBe('on');
  });

  it('counts a rest period as an "on" day', () => {
    const s = richState();
    const sat = Math.floor(NOW / DAY);
    const store = {
      ...s,
      restPeriods: [{ id: 'r', startDay: sat - 4, endDay: sat - 4, mode: 'off', createdAt: NOW }],
    } as never;
    seed(store);
    const { container } = view({ store });
    const dots = [...container.querySelectorAll('.apx-dot')].map((d) => d.className);
    expect(dots.filter((d) => d.includes('st-on')).length).toBeGreaterThanOrEqual(3);
  });

  it('shows the closest strength rank with kilos to go and opens Ranks', () => {
    const { onTab, container } = view();
    const rank = container.querySelector('.apx-rank') as HTMLElement;
    expect(rank).toBeTruthy();
    expect(screen.getByText(en.apexNextRank)).toBeTruthy();
    expect(rank.querySelector('.apx-rank-title')?.textContent).toMatch(/ → /);
    expect(rank.querySelector('.apx-rank-togo')?.textContent).toMatch(/^\+\d+ kg$/);
    const w = (rank.querySelector('.apx-rank-bar span') as HTMLElement).style.width;
    expect(parseInt(w, 10)).toBeGreaterThanOrEqual(0);
    fireEvent.click(rank);
    expect(onTab).toHaveBeenCalledWith('ranks');
  });

  it('hides the rank card when sex or weight is not known', () => {
    const s = richState();
    const noSex = { ...s, bodyMetrics: { ...s.bodyMetrics, sex: undefined } } as never;
    seed(noSex);
    view({ store: noSex });
    expect(screen.queryByText(en.apexNextRank)).toBeNull();
    cleanup();
    const noWeight = { ...s, bodyMetrics: { ...s.bodyMetrics, weights: [] } } as never;
    seed(noWeight);
    view({ store: noWeight });
    expect(screen.queryByText(en.apexNextRank)).toBeNull();
  });

  it('female accounts get a rank too (different standards table)', () => {
    const s = richState();
    const f = { ...s, bodyMetrics: { ...s.bodyMetrics, sex: 'female' } } as never;
    seed(f);
    view({ store: f });
    expect(screen.getByText(en.apexNextRank)).toBeTruthy();
  });

  it('shows the latest unlocked achievement and opens Awards', () => {
    const { onTab, container } = view();
    const award = container.querySelector('.apx-award') as HTMLElement;
    expect(award).toBeTruthy();
    expect(award.querySelector('.apx-award-title')?.textContent?.length).toBeGreaterThan(0);
    fireEvent.click(award);
    expect(onTab).toHaveBeenCalledWith('awards');
  });

  it('lists the top three milestones with relative times and links to the feed', () => {
    const notifs = [
      notif('a', 'pr', 5 * 60_000),
      notif('b', 'streak', 3 * 3600_000),
      notif('c', 'unknown-kind' as never, 3 * DAY),
      notif('d', 'trend', 4 * DAY),
    ];
    const { onTab, container } = view({ notifs });
    expect(screen.getByText(en.apexRecent)).toBeTruthy();
    expect(screen.queryByText('T-d')).toBeNull();
    const rows = [...container.querySelectorAll('.apx-recent button')].map(
      (r) => r.textContent ?? '',
    );
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatch(/^T-a.*5m$/);
    expect(rows[1]).toMatch(/^T-b.*3h$/);
    expect(rows[2]).toMatch(/^T-c.*Sep/);
    fireEvent.click(screen.getByText('T-a'));
    expect(onTab).toHaveBeenLastCalledWith('feed');
    fireEvent.click(screen.getByRole('button', { name: en.apexSeeAll }));
    expect(onTab).toHaveBeenLastCalledWith('feed');
  });

  it('a milestone younger than a minute reads 1m, never 0m', () => {
    const { container } = view({ notifs: [notif('x', 'pr', 5_000)] });
    expect(container.querySelector('.apx-recent')?.textContent).toContain('1m');
  });

  it('re-renders after a challenge is started (the card appears without a remount)', () => {
    const { container } = view();
    expect(container.querySelector('.apx-active')).toBeNull();
    act(() => {
      started.push(startChallenge('sessions', 12, 14, NOW - DAY).id);
    });
    expect(container.querySelector('.apx-active')).toBeTruthy();
  });
});

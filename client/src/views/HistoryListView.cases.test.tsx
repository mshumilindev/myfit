import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { HistoryListView } from './HistoryListView';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import {
  DAY,
  emptyState,
  freezeClock,
  makeShell,
  NOW,
  richState,
  seed,
} from './__fixtures__/viewKit';

beforeEach(() => {
  freezeClock();
  setLocale('en');
  seed(richState());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

const prev = () => screen.getByRole('button', { name: en.weekNext }) as HTMLButtonElement;
const next = () => screen.getByRole('button', { name: en.weekPrev }) as HTMLButtonElement;

describe('HistoryListView', () => {
  it('with no history says so and offers only the back button', () => {
    seed(emptyState());
    const onClose = vi.fn();
    render(<HistoryListView shell={makeShell()} onClose={onClose} />);
    expect(screen.getByText(en.noHistoryYet)).toBeTruthy();
    expect(screen.queryByRole('button', { name: en.weekOpen })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.backAction }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens on the current Monday-start week with the session count in the header', () => {
    render(<HistoryListView shell={makeShell()} onClose={() => undefined} />);
    expect(screen.getByText(en.tdHistory)).toBeTruthy();
    expect(screen.getByText(en.historyCount(30))).toBeTruthy();
    expect(screen.getByText(en.weekThis)).toBeTruthy();
    expect(screen.getByRole('button', { name: en.weekOpen }).textContent).toContain(
      'Sep 21 – Sep 27',
    );
    // already on the newest week: cannot go to a newer one
    expect(prev().disabled).toBe(true);
    expect(next().disabled).toBe(false);
  });

  it('steps to the older week and back, captioning last week', () => {
    render(<HistoryListView shell={makeShell()} onClose={() => undefined} />);
    fireEvent.click(next());
    const pick = screen.getByRole('button', { name: en.weekOpen });
    expect(pick.textContent).toContain('Sep 14 – Sep 20');
    expect(pick.textContent).toContain(en.weekLast);
    fireEvent.click(next());
    expect(screen.getByRole('button', { name: en.weekOpen }).textContent).toContain(
      en.historyCount(3),
    );
    fireEvent.click(prev());
    fireEvent.click(prev());
    expect(screen.getByText(en.weekThis)).toBeTruthy();
  });

  it('stops at the oldest recorded week', () => {
    render(<HistoryListView shell={makeShell()} onClose={() => undefined} />);
    for (let i = 0; i < 60 && !next().disabled; i++) fireEvent.click(next());
    expect(next().disabled).toBe(true);
    expect(prev().disabled).toBe(false);
  });

  it('the week picker lists weeks with captions and jumps to the chosen one', () => {
    render(<HistoryListView shell={makeShell()} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: en.weekOpen }));
    expect(screen.getByText(en.weekPickTitle)).toBeTruthy();
    const dlg = screen.getByText(en.weekPickTitle).closest('[role="dialog"]') as HTMLElement;
    const rows = within(dlg).getAllByRole('button');
    expect(rows.length).toBeGreaterThan(5);
    const target = within(dlg).getByText('Sep 7 – Sep 13');
    fireEvent.click(target.closest('button') as HTMLElement);
    expect(screen.queryByText(en.weekPickTitle)).toBeNull();
    expect(screen.getByRole('button', { name: en.weekOpen }).textContent).toContain(
      'Sep 7 – Sep 13',
    );
  });

  it('a week with nothing recorded says so, in the page and in the picker caption', () => {
    const base = richState();
    const w0 = base.workouts[base.workouts.length - 1];
    const mk = (id: string, startedAt: number) => ({
      ...w0,
      id,
      startedAt,
      finishedAt: startedAt + 3_600_000,
    });
    seed({
      ...base,
      workouts: [mk('recent', NOW - 3_600_000), mk('old', NOW - 24 * DAY)],
      activities: [],
      sleeps: [],
      restPeriods: [],
      injuries: [],
    });
    render(<HistoryListView shell={makeShell()} onClose={() => undefined} />);
    fireEvent.click(next());
    expect(screen.getAllByText(en.weekEmpty).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: en.weekOpen }));
    const dlg = screen.getByText(en.weekPickTitle).closest('[role="dialog"]') as HTMLElement;
    expect(within(dlg).getAllByText(en.weekEmpty).length).toBe(1);
    expect(within(dlg).getAllByText(en.weekLast).length).toBe(1);
    expect(within(dlg).getAllByText(en.historyCount(1)).length).toBe(1);
  });

  it('a rest period or an injury makes a week "no workouts" rather than empty', () => {
    const base = richState();
    const w0 = base.workouts[base.workouts.length - 1];
    seed({
      ...base,
      workouts: [
        { ...w0, id: 'old', startedAt: NOW - 24 * DAY, finishedAt: NOW - 24 * DAY + 3_600_000 },
      ],
      activities: [],
      sleeps: [],
      restPeriods: [
        {
          id: 'r',
          startDay: Math.floor((NOW - 15 * DAY) / DAY),
          endDay: Math.floor((NOW - 14 * DAY) / DAY),
          mode: 'off',
          createdAt: NOW,
        },
      ] as never,
      injuries: [],
    });
    render(<HistoryListView shell={makeShell()} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: en.weekOpen }));
    const dlg = screen.getByText(en.weekPickTitle).closest('[role="dialog"]') as HTMLElement;
    expect(within(dlg).getAllByText(en.weekNoWorkouts).length).toBeGreaterThan(0);
  });

  it('tapping a workout, an activity or a sleep row opens the matching overlay', () => {
    const shell = makeShell();
    const { container } = render(<HistoryListView shell={shell} onClose={() => undefined} />);
    fireEvent.click(next());
    fireEvent.click(container.querySelector('.hist-workout') as HTMLElement);
    expect(shell.openOverlay).toHaveBeenLastCalledWith(
      expect.objectContaining({ screen: 'past-workout' }),
    );
    fireEvent.click(container.querySelector('.hist-activity:not(.cat-sleep)') as HTMLElement);
    expect(shell.openOverlay).toHaveBeenLastCalledWith(
      expect.objectContaining({ screen: 'activity' }),
    );
    fireEvent.click(container.querySelector('.hist-item.cat-sleep') as HTMLElement);
    expect(shell.openOverlay).toHaveBeenLastCalledWith(
      expect.objectContaining({ screen: 'sleep', mode: 'edit' }),
    );
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Workout } from '../types';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { DAY, emptyState, freezeClock, makeShell, NOW, seed } from './__fixtures__/viewKit';

const m = vi.hoisted(() => ({ callFn: vi.fn(), revalidate: vi.fn() }));
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  callFn: m.callFn,
}));
vi.mock('../offline/offlineCache', () => ({
  offlineRevalidate: (o: {
    fetch: () => Promise<unknown>;
    apply: (d: unknown) => void;
    onError?: (e: unknown) => void;
    accept?: (d: unknown) => boolean;
  }) => {
    m.revalidate(o);
    void o.fetch().then(
      (d) => (!o.accept || o.accept(d)) && o.apply(d),
      (e) => o.onError?.(e),
    );
    return () => undefined;
  },
}));

import { ExerciseHistoryView } from './ExerciseHistoryView';

const BENCH = 'Barbell Bench Press - Medium Grip';
const wk = (
  id: string,
  ageDays: number,
  name: string,
  sets: Array<[number, number | null]>,
  extra: Record<string, unknown> = {},
  gymId: string | null = null,
): Workout =>
  ({
    id,
    startedAt: NOW - ageDays * DAY,
    finishedAt: NOW - ageDays * DAY + 3_600_000,
    autoFinished: false,
    gymId,
    exercises: [
      {
        id: `${id}-e`,
        name,
        kind: 'strength',
        position: 0,
        sets: sets.map(([reps, weight], i) => ({
          id: `${id}-s${i}`,
          position: i,
          reps,
          weight,
          isWarmup: false,
        })),
        ...extra,
      },
    ],
  }) as Workout;

beforeEach(() => {
  freezeClock();
  setLocale('en');
  m.callFn.mockReset();
  m.revalidate.mockReset();
  seed(emptyState());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const stat = (label: string) =>
  [...document.querySelectorAll('.stat-grid .cell')]
    .find((c) => c.querySelector('.l')?.textContent === label)
    ?.querySelector('.v')?.textContent;
const open = (over: Partial<Parameters<typeof ExerciseHistoryView>[0]> = {}) => {
  const shell = makeShell();
  const onClose = vi.fn();
  const out = render(
    <ExerciseHistoryView name={BENCH} shell={shell} onClose={onClose} {...over} />,
  );
  return { ...out, shell, onClose };
};

describe('ExerciseHistoryView: own log', () => {
  it('with no sessions shows dashes, the empty chart card and an empty table', () => {
    open();
    expect(stat(en.recordKg)).toBe('—');
    expect(stat(en.est1rm)).toBe('—');
    expect(stat(en.lastTopSet)).toBe('—');
    expect(screen.getByText(en.notEnoughData)).toBeTruthy();
    expect(document.querySelectorAll('tbody tr').length).toBe(0);
  });

  it('record, estimated 1RM and last top set come from the finished sessions', () => {
    seed({
      ...emptyState(),
      workouts: [
        wk('new', 2, BENCH, [
          [8, 80],
          [6, 90],
        ]),
        wk('mid', 9, BENCH, [[5, 100]]),
        wk('old', 16, BENCH, [[10, 60]]),
      ],
    });
    open();
    expect(stat(en.recordKg)).toBe('100');
    // latest session's top set 90 x 6 -> Epley 108
    expect(stat(en.lastTopSet)).toBe('90');
    expect(Number(stat(en.est1rm))).toBeGreaterThan(100);
    const rows = [...document.querySelectorAll('tbody tr')].map((r) =>
      [...r.querySelectorAll('td')].map((c) => c.textContent),
    );
    expect(rows[0]).toEqual(['Sep 24', '90 × 6', expect.stringMatching(/^1\D?180 kg$/)]);
    expect(rows).toHaveLength(3);
  });

  it('draws the top-set line from three sessions with min and record under it', () => {
    seed({
      ...emptyState(),
      workouts: [
        wk('a', 2, BENCH, [[5, 90]]),
        wk('b', 9, BENCH, [[5, 80]]),
        wk('c', 16, BENCH, [[5, 70]]),
      ],
    });
    const { container } = open();
    expect(screen.getByText(en.topSet12w)).toBeTruthy();
    expect(
      container.querySelector('.chart-card polyline')?.getAttribute('points')?.split(' '),
    ).toHaveLength(3);
    expect(screen.getByText('70 kg')).toBeTruthy();
    expect(screen.getByText(en.recordSuffix('90 kg'))).toBeTruthy();
    expect(screen.queryByText(en.notEnoughData)).toBeNull();
  });

  it('only the latest 6 sessions are listed', () => {
    seed({
      ...emptyState(),
      workouts: Array.from({ length: 9 }, (_, i) => wk(`w${i}`, i + 1, BENCH, [[5, 50 + i]])),
    });
    open();
    expect(document.querySelectorAll('tbody tr').length).toBe(6);
  });

  it('a bodyweight-only exercise shows 0-weight sets and no 1RM', () => {
    seed({ ...emptyState(), workouts: [wk('a', 2, 'Pullups', [[8, null]])] });
    open({ name: 'Pullups' });
    expect(stat(en.recordKg)).toBe('—');
    expect(stat(en.est1rm)).toBe('—');
    expect(stat(en.lastTopSet)).toBe('0');
  });

  it('matches the exercise name case-insensitively and ignores unfinished workouts', () => {
    const live = { ...wk('live', 0, BENCH, [[5, 200]]), finishedAt: null } as Workout;
    seed({ ...emptyState(), workouts: [live, wk('a', 2, BENCH.toUpperCase(), [[5, 70]])] });
    open();
    expect(stat(en.recordKg)).toBe('70');
  });

  it('shows muscle chips and equipment needs for a known exercise; a muscle chip leads to that muscle history', () => {
    const { shell, container } = open();
    expect(container.querySelector('.hist-chips')).toBeTruthy();
    const chip = container.querySelector('.hist-chips > *') as HTMLElement;
    expect(chip).toBeTruthy();
    fireEvent.click(chip);
    fireEvent.click(screen.getByRole('button', { name: /history/i }));
    expect(shell.openOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ screen: 'muscle-history' }),
    );
  });

  it('an unknown custom exercise shows the session count instead of chips', () => {
    seed({ ...emptyState(), workouts: [wk('a', 2, 'Zzz Mystery Move', [[5, 20]])] });
    const { container } = open({ name: 'Zzz Mystery Move' });
    expect(container.querySelector('.hist-chips')).toBeNull();
    expect(screen.getByText(en.oneSession)).toBeTruthy();
    cleanup();
    seed({
      ...emptyState(),
      workouts: [
        wk('a', 2, 'Zzz Mystery Move', [[5, 20]]),
        wk('b', 9, 'Zzz Mystery Move', [[5, 20]]),
      ],
    });
    open({ name: 'Zzz Mystery Move' });
    expect(screen.getByText(en.nSessionsSince(2, 'Sep 17'))).toBeTruthy();
  });

  it('Details opens the exercise page; back closes', () => {
    const { shell, onClose } = open();
    fireEvent.click(screen.getByRole('button', { name: en.detailsAction }));
    expect(shell.openOverlay).toHaveBeenCalledWith({ screen: 'exercise-detail', name: BENCH });
    fireEvent.click(screen.getByRole('button', { name: en.backAction }));
    expect(onClose).toHaveBeenCalled();
  });

  it('lists where the lift can be done: ok at gyms with the kit, missing otherwise', () => {
    seed({
      ...emptyState(),
      gyms: [
        {
          id: 'g1',
          name: 'Iron Yard',
          lat: 0,
          lng: 0,
          radiusM: 50,
          inventory: ['barbell', 'bench', 'rack', 'dumbbell', 'cable', 'machine'],
        },
        { id: 'g2', name: 'Bare Room', lat: 1, lng: 1, radiusM: 50, inventory: ['bands'] },
      ],
    } as never);
    const { container } = open();
    expect(screen.getByText(en.whereYouCanDoIt)).toBeTruthy();
    const rows = [...container.querySelectorAll('.wcdi-row')];
    expect(rows).toHaveLength(2);
    expect(rows[0].classList.contains('miss')).toBe(false);
    expect(rows[1].classList.contains('miss')).toBe(true);
    expect(rows[1].querySelector('.v.miss')?.textContent).toMatch(/^No /);
    expect(screen.getByText(en.inventoryNote)).toBeTruthy();
  });

  it('records by machine: the same lift on two machines, with a normalized curve and a dashed switch', () => {
    const machine = { equipment: ['machine'] };
    seed({
      ...emptyState(),
      gyms: [
        { id: 'g1', name: 'Iron Yard', lat: 0, lng: 0, radiusM: 50 },
        { id: 'g2', name: 'Home', lat: 1, lng: 1, radiusM: 50 },
      ],
      workouts: [
        wk('a', 2, 'Leg Press', [[10, 200]], machine, 'g1'),
        wk('b', 9, 'Leg Press', [[10, 180]], machine, 'g1'),
        wk('c', 16, 'Leg Press', [[10, 120]], machine, 'g2'),
        wk('d', 23, 'Leg Press', [[10, 110]], machine, 'g2'),
      ],
    } as never);
    const { container } = open({ name: 'Leg Press' });
    expect(screen.getByText(en.exRecByMachine)).toBeTruthy();
    const group = screen.getByText(en.exRecByMachine).parentElement as HTMLElement;
    expect(group.textContent).toMatch(/200 kg × 10/);
    expect(group.textContent).toMatch(/120 kg × 10/);
    expect(group.textContent).toContain(en.exNoMachine);
    expect(screen.getByText(en.exProgressSwitch)).toBeTruthy();
    expect(container.querySelector('.chart-card line[stroke-dasharray]')).toBeTruthy();
    // the gym column appears once the lift was done at two gyms
    expect(container.querySelector('thead')?.textContent).toContain(en.exHistGym);
    expect(
      [...container.querySelectorAll('tbody tr')].map(
        (r) => r.querySelectorAll('td')[1].textContent,
      ),
    ).toEqual(['Iron Yard', 'Iron Yard', 'Home', 'Home']);
  });
});

describe('ExerciseHistoryView: an athlete (trainer view)', () => {
  const remote = [
    wk('r1', 3, BENCH, [[5, 120]]),
    wk('r2', 10, BENCH, [[5, 110]]),
    wk('r3', 17, BENCH, [[5, 100]]),
  ];

  it('loads the athlete history through the audited function and names the athlete', async () => {
    m.callFn.mockResolvedValue({ workouts: remote });
    open({ userId: 'a1', userName: 'Ada L.' });
    expect(m.callFn).toHaveBeenCalledWith('athleteExerciseHistory', { id: 'a1', name: BENCH });
    expect(m.revalidate.mock.calls[0][0].key).toBe(`athleteExerciseHistory.a1\u0000${BENCH}`);
    expect(screen.getByText('Ada L.')).toBeTruthy();
    await waitFor(() => expect(stat(en.recordKg)).toBe('120'));
    expect(document.querySelectorAll('tbody tr').length).toBe(3);
    // never shows the coach own gyms or machine records
    expect(screen.queryByText(en.whereYouCanDoIt)).toBeNull();
    expect(document.querySelector('thead')?.textContent).not.toContain(en.exHistGym);
  });

  it('shows empty while loading and stays empty if the call fails', async () => {
    m.callFn.mockRejectedValue(new Error('denied'));
    open({ userId: 'a1' });
    await waitFor(() => expect(screen.getByText(en.notEnoughData)).toBeTruthy());
    expect(stat(en.recordKg)).toBe('—');
  });

  it('a malformed answer is not applied', async () => {
    m.callFn.mockResolvedValue({ workouts: 'nope' });
    open({ userId: 'a1' });
    await act(async () => {
      await Promise.resolve();
    });
    expect(stat(en.recordKg)).toBe('—');
  });

  it('switching to another lift does not show the previous lift data', async () => {
    m.callFn.mockResolvedValueOnce({ workouts: remote });
    const { rerender, shell } = open({ userId: 'a1' });
    await waitFor(() => expect(stat(en.recordKg)).toBe('120'));
    m.callFn.mockReturnValueOnce(new Promise(() => undefined));
    rerender(
      <ExerciseHistoryView
        name="Barbell Squat"
        userId="a1"
        shell={shell}
        onClose={() => undefined}
      />,
    );
    expect(stat(en.recordKg)).toBe('—');
  });
});

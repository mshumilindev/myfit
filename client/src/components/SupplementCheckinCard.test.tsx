import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SupplementCheckinCard } from './SupplementCheckinCard';
import { __getStateForTests, __replaceStateForTests } from '../store';
import {
  defaultSupplementSettings,
  emptySupplementState,
  newSupplementEntry,
} from '../supplements';
import { setLocale } from '../i18n';
import type { SupplementCheckin, SupplementEntry, SupplementId, Workout } from '../types';

/** Wednesday 7 Oct 2026, 20:00 (local): today is asked about (the evening hour has come). */
const WED_EVENING = new Date(2026, 9, 7, 20).getTime();
const WED_MORNING = new Date(2026, 9, 7, 9).getTime();
const T0 = new Date(2026, 8, 1, 10).getTime();
const ent = (id: SupplementId, over: Partial<SupplementEntry> = {}): SupplementEntry => ({
  ...newSupplementEntry(id, `e-${id}`, T0),
  ...over,
});
const workout = (startedAt: number): Workout =>
  ({
    id: `w${startedAt}`,
    startedAt,
    finishedAt: startedAt + 3_600_000,
    autoFinished: false,
    gymId: null,
    exercises: [],
  }) as unknown as Workout;

function seed(
  entries: SupplementEntry[] = [ent('creatine'), ent('whey')],
  opts: {
    master?: boolean;
    checkinsOn?: boolean;
    checkins?: Record<string, SupplementCheckin>;
    workouts?: Workout[];
  } = {},
) {
  const settings = defaultSupplementSettings();
  settings.useInCalculations = opts.master ?? true;
  settings.checkinsOn = opts.checkinsOn ?? true;
  __replaceStateForTests({
    ...__getStateForTests(),
    workouts: opts.workouts ?? [],
    supplements: { entries, checkins: opts.checkins ?? {}, settings, updatedAt: 1 },
  });
}
/** The two days before today answered, so only today can be pending. */
const PRIOR: Record<string, SupplementCheckin> = {
  '2026-10-06': { taken: true },
  '2026-10-05': { taken: true },
};

beforeEach(() => {
  setLocale('en');
  try {
    localStorage.clear();
  } catch {
    /* no storage */
  }
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(WED_EVENING);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  __replaceStateForTests({
    ...__getStateForTests(),
    workouts: [],
    supplements: emptySupplementState(),
  });
});

const checkins = () => __getStateForTests().supplements.checkins ?? {};

describe('SupplementCheckinCard', () => {
  it('asks once, grouped, with All / Some… / None and "Not now"', () => {
    seed(undefined, { checkins: PRIOR });
    render(<SupplementCheckinCard />);
    expect(screen.getByText('Did you take your supplements today?')).toBeTruthy();
    expect(screen.getByText('Creatine + Whey')).toBeTruthy();
    for (const name of ['All', 'Some…', 'None', 'Not now'])
      expect(screen.getByRole('button', { name })).toBeTruthy();
    // One card, not one per item.
    expect(screen.getAllByTestId('sup-checkin')).toHaveLength(1);
  });

  it('"All" stores a "taken" answer without ids and the card goes away', () => {
    seed(undefined, { checkins: PRIOR });
    render(<SupplementCheckinCard />);
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(checkins()['2026-10-07']).toEqual({ taken: true });
    expect(screen.queryByTestId('sup-checkin')).toBeNull();
  });

  it('"None" stores "not taken" and the card goes away', () => {
    seed(undefined, { checkins: PRIOR });
    render(<SupplementCheckinCard />);
    fireEvent.click(screen.getByRole('button', { name: 'None' }));
    expect(checkins()['2026-10-07']).toEqual({ taken: false });
    expect(screen.queryByTestId('sup-checkin')).toBeNull();
  });

  it('"Some…" opens a checklist; Save stays disabled until something changes', () => {
    seed(undefined, { checkins: PRIOR });
    render(<SupplementCheckinCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Some…' }));
    const save = () => screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(save().disabled).toBe(true);
    const whey = screen.getByRole('checkbox', { name: 'Whey' }) as HTMLInputElement;
    expect(whey.checked).toBe(true);
    fireEvent.click(whey);
    expect(save().disabled).toBe(false);
    // Putting it back is no change again.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Whey' }));
    expect(save().disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Whey' }));
    fireEvent.click(save());
    expect(checkins()['2026-10-07']).toEqual({ taken: true, entryIds: ['e-creatine'] });
    expect(screen.queryByTestId('sup-checkin')).toBeNull();
  });

  it('unticking everything is the same as "None"', () => {
    seed(undefined, { checkins: PRIOR });
    render(<SupplementCheckinCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Some…' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Creatine' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Whey' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(checkins()['2026-10-07']).toEqual({ taken: false });
  });

  it('"Not now" hides it for the day without answering; it is back the next day', () => {
    seed(undefined, { checkins: PRIOR });
    const { unmount } = render(<SupplementCheckinCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByTestId('sup-checkin')).toBeNull();
    expect(checkins()['2026-10-07']).toBeUndefined();
    unmount();
    render(<SupplementCheckinCard />);
    expect(screen.queryByTestId('sup-checkin')).toBeNull();
    cleanup();
    vi.setSystemTime(WED_EVENING + 24 * 3600 * 1000);
    render(<SupplementCheckinCard />);
    expect(screen.queryByTestId('sup-checkin')).toBeTruthy();
  });

  it('one pending day at a time, the most recent first; the older one follows', () => {
    seed();
    render(<SupplementCheckinCard />);
    expect(screen.getByText('Did you take your supplements today?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText('Did you take your supplements yesterday?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText('Did you take your supplements on Monday?')).toBeTruthy();
  });

  it('asks about today only from the evening hour (before it: yesterday)', () => {
    vi.setSystemTime(WED_MORNING);
    seed(undefined, { checkins: { '2026-10-06': { taken: true }, '2026-10-05': { taken: true } } });
    const a = render(<SupplementCheckinCard />);
    expect(a.container.firstChild).toBeNull();
    a.unmount();
    seed();
    render(<SupplementCheckinCard />);
    expect(screen.getByText('Did you take your supplements yesterday?')).toBeTruthy();
  });

  it('shows nothing with no entries, the master off, check-ins off, or when answered', () => {
    seed([]);
    const a = render(<SupplementCheckinCard />);
    expect(a.container.firstChild).toBeNull();
    a.unmount();
    seed(undefined, { master: false });
    const b = render(<SupplementCheckinCard />);
    expect(b.container.firstChild).toBeNull();
    b.unmount();
    seed(undefined, { checkinsOn: false });
    const c = render(<SupplementCheckinCard />);
    expect(c.container.firstChild).toBeNull();
    c.unmount();
    seed(undefined, { checkins: { ...PRIOR, '2026-10-07': { taken: false } } });
    const d = render(<SupplementCheckinCard />);
    expect(d.container.firstChild).toBeNull();
  });

  it('lists only what is due: a training-day entry waits for a training day', () => {
    const tue = ent('caffeine', { schedule: 'trainingDays' });
    seed([tue], { checkins: PRIOR });
    const a = render(<SupplementCheckinCard />);
    expect(a.container.firstChild).toBeNull(); // no plan, no workout: a rest day
    a.unmount();
    seed([tue, ent('whey')], { checkins: PRIOR });
    const b = render(<SupplementCheckinCard />);
    expect(screen.getByText('Whey')).toBeTruthy(); // only the daily one is due
    b.unmount();
    seed([tue, ent('whey')], {
      checkins: PRIOR,
      workouts: [workout(new Date(2026, 9, 7, 18).getTime())],
    });
    render(<SupplementCheckinCard />);
    expect(screen.getByText('Caffeine + Whey')).toBeTruthy();
  });
});

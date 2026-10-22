import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Shell } from '../App';
import { COACH_DEFAULT } from '../atlas/types';
import { emptyCycleState } from '../cycle/cycleState';
import { __getStateForTests, __replaceStateForTests } from '../store';
import * as shareCard from '../data/shareCard';
import type { Exercise, SetEntry, Workout } from '../types';
import { SessionView } from './SessionView';

vi.mock('../data/shareCard', async (orig) => ({
  ...(await orig<typeof import('../data/shareCard')>()),
  drawShareCard: vi.fn(),
  drawStatCard: vi.fn(),
  cardBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}));

// Wednesday 14 Oct 2026, 18:00 local — fixed wall clock, only Date is faked so timers/userEvent keep running.
const NOW = new Date(2026, 9, 14, 18, 0).getTime();
const MIN = 60000;

const shell = (): Shell => ({
  openOverlay: vi.fn(),
  replaceOverlay: vi.fn(),
  goTab: vi.fn(),
  goPlaybook: vi.fn(),
  openStart: vi.fn(),
  toast: vi.fn(),
  snack: vi.fn(),
  signOut: vi.fn(),
  queueLength: 0,
});
const set = (id: string, o: Partial<SetEntry> = {}): SetEntry => ({
  id,
  reps: 8,
  weight: 80,
  isWarmup: false,
  position: Number(id.replace(/\D/g, '')) || 0,
  ...o,
});
const ex = (id: string, name: string, sets: SetEntry[], o: Partial<Exercise> = {}): Exercise => ({
  id,
  name,
  kind: 'strength',
  position: 0,
  sets,
  ...o,
});
const wk = (id: string, exercises: Exercise[], o: Partial<Workout> = {}): Workout => ({
  id,
  startedAt: NOW - 30 * MIN,
  finishedAt: null,
  autoFinished: false,
  exercises,
  ...o,
});
function seed(workouts: Workout[], extra: Record<string, unknown> = {}) {
  __replaceStateForTests({
    ...__getStateForTests(),
    workouts,
    activities: [],
    sleeps: [],
    gyms: [],
    queue: [],
    coach: { ...COACH_DEFAULT },
    cycle: emptyCycleState(),
    ...extra,
  });
}
const mine = (id = 'open') => __getStateForTests().workouts.find((w) => w.id === id)!;
function mount(id = 'open', sh: Shell = shell(), extra: { past?: boolean } = {}) {
  const onClose = vi.fn();
  const r = render(<SessionView workoutId={id} shell={sh} onClose={onClose} {...extra} />);
  return { ...r, onClose, sh };
}

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (q: string) => ({
      matches: false,
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const DAY = 24 * 60 * MIN;
const fin = (id: string, daysAgo: number, exs: Exercise[]): Workout =>
  wk(id, exs, { startedAt: NOW - daysAgo * DAY, finishedAt: NOW - daysAgo * DAY + 50 * MIN });
const history = (daysAgo = 3) =>
  fin('h1', daysAgo, [
    ex('b0', 'Bench press', [set('x1'), set('x2')]),
    ex('i0', 'Incline press', [set('x3')], { position: 1 }),
  ]);
/** Twelve chest sets, a set every 10 s: the chest is done for the day. */
const chestDone = () =>
  wk('open', [
    ex(
      'bench',
      'Bench press',
      Array.from({ length: 12 }, (_, i) =>
        set(`s${i + 1}`, { loggedAt: NOW - (120 - i * 10) * 1000 }),
      ),
    ),
  ]);

describe('SessionView · suggestions under the set card', () => {
  it('says the muscle is done after enough hard sets, with the reason and what to do next', () => {
    seed([chestDone(), history()]);
    const { container } = mount();
    const banner = container.querySelector('.tired-banner') as HTMLElement;
    expect(within(banner).getByText('Chest is tired')).toBeTruthy();
    expect(within(banner).getByText('12 hard sets done today')).toBeTruthy();
    expect(banner.querySelector('.tb-why')!.textContent).toContain(
      'your chest got 12 hard sets today',
    );
    expect(banner.querySelector('.tb-kicker')!.textContent).toBe('NEXT · YOUR ROUTINE');
    expect(banner.querySelector('.tb-name')!.textContent).toBe('Incline press');
  });

  it('a suggestion tile adds that lift to the session', async () => {
    seed([chestDone(), history()]);
    const { container } = mount();
    await userEvent.click(container.querySelector('.tb-tile-main') as HTMLElement);
    expect(mine().exercises.map((e) => e.name)).toEqual(['Bench press', 'Incline press']);
  });

  it('the header folds the banner away and brings it back', async () => {
    seed([chestDone(), history()]);
    const { container } = mount();
    const head = within(container.querySelector('.tired-banner') as HTMLElement).getByText(
      'Chest is tired',
    );
    await userEvent.click(head);
    expect(container.querySelector('.tired-banner.collapsed')).toBeTruthy();
    expect(container.querySelector('.tb-tiles')).toBeNull();
    await userEvent.click(head);
    expect(container.querySelector('.tb-tiles')).toBeTruthy();
  });

  it('Details on a suggestion opens that lift in a sheet', async () => {
    seed([chestDone(), history()]);
    const { container } = mount();
    await userEvent.click(
      within(container.querySelector('.tired-banner') as HTMLElement).getByRole('button', {
        name: 'Details',
      }),
    );
    expect(document.querySelector('.xp-detail-sheet')).toBeTruthy();
  });

  it('once the planned sets are done, "Next up" offers what usually follows even if the muscle is fresh', async () => {
    const sets = [1, 2, 3].map((i) => set(`s${i}`, { loggedAt: NOW - (10 - i) * MIN }));
    seed([wk('open', [ex('bench', 'Bench press', sets, { plannedSets: 3 })]), history()]);
    const { container } = mount();
    const banner = container.querySelector('.next-banner') as HTMLElement;
    expect(within(banner).getByText('Next up')).toBeTruthy();
    expect(banner.querySelector('.tb-name')!.textContent).toBe('Incline press');
    await userEvent.click(within(banner).getByText('Next up'));
    expect(container.querySelector('.next-banner.collapsed')).toBeTruthy();
  });

  it('no banner while the plan still has sets to go', () => {
    const sets = [1, 2].map((i) => set(`s${i}`, { loggedAt: NOW - (10 - i) * MIN }));
    seed([wk('open', [ex('bench', 'Bench press', sets, { plannedSets: 4 })]), history()]);
    const { container } = mount();
    expect(container.querySelector('.tired-banner')).toBeNull();
  });
});

describe('SessionView · returning after a break', () => {
  it('eases in after three weeks away and walks the warm-up ramp before the working sets', async () => {
    seed([
      wk('open', [ex('bench', 'Bench press', [])]),
      fin('h1', 21, [
        ex('b0', 'Bench press', [
          set('x1', { weight: 100, reps: 5 }),
          set('x2', { weight: 100, reps: 5 }),
        ]),
      ]),
    ]);
    const { container } = mount();
    const text = () => container.textContent ?? '';
    expect(text()).toContain('Ease in');
    expect(text()).toContain('3 weeks since your last Bench press — no weight jump this time');
    expect(text()).toContain('Warm-up 1 of 3');
    expect(text()).toContain('Warm-up ramp toward 100.0 kg');
    await userEvent.click(screen.getByRole('button', { name: 'Log' }));
    const first = mine().exercises[0].sets[0];
    expect(first).toMatchObject({ isWarmup: true, weight: 20, reps: 10 });
    expect(text()).toContain('Warm-up 2 of 3');
    expect(container.querySelector('.rst-next')!.textContent).toBe('Next: Set 2 · 60 × 5');
  });
});

describe('SessionView · a new record', () => {
  const recordRun = async () => {
    seed([
      wk('open', [
        ex('bench', 'Bench press', [set('s1', { weight: 80, loggedAt: NOW - 5 * MIN })]),
      ]),
      fin('h1', 7, [ex('b0', 'Bench press', [set('x1', { weight: 70, reps: 8 })])]),
    ]);
    const r = mount();
    const w = within(r.container.querySelector('.gset') as HTMLElement).getByRole('group', {
      name: 'Weight, kg',
    });
    await userEvent.click(w.querySelectorAll('button')[1]);
    await userEvent.click(w.querySelectorAll('button')[1]);
    await userEvent.click(screen.getByRole('button', { name: 'Log' }));
    return r;
  };

  it('celebrates a heavier set than ever before and compares the numbers with the old best', async () => {
    const { container } = await recordRun();
    const card = container.querySelector('.pr-card') as HTMLElement;
    expect(card.querySelector('.pr-kicker')!.textContent).toBe('New record · Bench press');
    expect(card.querySelector('.pr-main')!.textContent).toBe('85.0 kg × 8');
    const tiles = [...card.querySelectorAll('.pr-tile')].map((x) => x.textContent);
    expect(tiles).toEqual(['e1RM108.0+7.0', 'Best weight85.0+5.0', 'Set volume680.0+40.0']);
  });

  it('shares the record as a card, and dismissing it folds into the rest timer', async () => {
    const { container } = await recordRun();
    await userEvent.click(container.querySelector('.pr-share') as HTMLElement);
    await waitFor(() => expect(vi.mocked(shareCard.drawStatCard)).toHaveBeenCalled());
    const model = vi.mocked(shareCard.drawStatCard).mock.calls[0][1];
    expect(model).toMatchObject({ headline: 'Bench press', kicker: 'New record · Bench press' });
    expect(model.hero.value).toBe('85.0 kg × 8');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.querySelector('.sheet')).toBeNull());
    await userEvent.click(container.querySelector('.pr-ok') as HTMLElement);
    expect(container.querySelector('.pr-card')).toBeNull();
    expect(container.querySelector('.rst-card')).toBeTruthy();
  });
});

describe('SessionView · tank bars', () => {
  const barsOf = (c: HTMLElement) =>
    [...c.querySelectorAll('[style*="--stim"]')].map((e) =>
      Number((e as HTMLElement).style.getPropertyValue('--stim')),
    );

  it('draw one bar per logged set during the live session, falling as the muscle tires', () => {
    seed([
      wk('open', [
        ex(
          'bench',
          'Bench press',
          [1, 2, 3, 4].map((i) => set(`s${i}`, { loggedAt: NOW - ((20 - i * 2) * MIN) / 2 })),
        ),
      ]),
    ]);
    const { container } = mount();
    const bars = barsOf(container);
    expect(bars).toHaveLength(4);
    for (let i = 1; i < bars.length; i++) expect(bars[i]).toBeLessThan(bars[i - 1]);
  });

  it('are not drawn on a finished session', () => {
    seed([
      wk(
        'done',
        [
          ex(
            'bench',
            'Bench press',
            [1, 2, 3].map((i) => set(`s${i}`)),
          ),
        ],
        { finishedAt: NOW - 5 * MIN },
      ),
    ]);
    const { container } = mount('done');
    expect(barsOf(container)).toHaveLength(0);
  });
});

describe('SessionView · record attempt', () => {
  const warm = (id: string, w: number, reps: number, ago: number) =>
    set(id, { weight: w, reps, isWarmup: true, type: 'warmup', loggedAt: NOW - ago * MIN });
  const top = (id: string) => [1, 2, 3].map((i) => set(`${id}${i}`, { weight: 80, reps: 12 }));

  it('flags the next working set as a record attempt when the proposed load beats the best', () => {
    const ramp = [
      warm('w1', 20, 10, 9),
      warm('w2', 50, 5, 8),
      warm('w3', 70, 3, 7),
      warm('w4', 85, 1, 6),
    ];
    seed([
      wk('open', [ex('bench', 'Bench press', ramp, { equipment: ['barbell'] })]),
      fin('h1', 7, [ex('b0', 'Bench press', top('x'))]),
      fin('h2', 14, [ex('b1', 'Bench press', top('y'))]),
    ]);
    const { container } = mount();
    const card = container.querySelector('.gset') as HTMLElement;
    expect(card.textContent).toContain('Set 5 · PR attempt');
    expect(card.textContent).toContain('2.5 kg over your best 80.0 kg');
  });

  it('says nothing while the proposal only repeats the best', () => {
    seed([
      wk('open', [ex('bench', 'Bench press', [set('s1', { loggedAt: NOW - 5 * MIN })])]),
      fin('h1', 7, [ex('b0', 'Bench press', [set('x1')])]),
    ]);
    const { container } = mount();
    expect(container.textContent).not.toContain('PR attempt');
  });
});

// Sheets leave a 160 ms focus-settle timer behind; let it fire before the jsdom window goes away.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 250)));

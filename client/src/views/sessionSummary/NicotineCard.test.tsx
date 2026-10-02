import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { NicotineCard } from './NicotineCard';
import { __getStateForTests, __replaceStateForTests } from '../../store';
import { setLocale } from '../../i18n';
import {
  EVIDENCE_SURFACES,
  EXPERIMENTAL_SURFACES,
  defaultNicotineSettings,
  emptyNicotineState,
  newNicotineProduct,
} from '../../nicotine';
import type { NicotineProduct, NicotineSettings, SleepNight, Workout } from '../../types';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const END = new Date(2026, 8, 30, 18, 30).getTime();

const squat = (id: string, startedAt: number, kg = 100): Workout => ({
  id,
  startedAt,
  finishedAt: startedAt + 60 * MIN,
  autoFinished: false,
  exercises: [
    {
      id: `e-${id}`,
      name: 'Barbell Squat',
      position: 0,
      kind: 'strength',
      primaryMuscle: 'quads',
      sets: Array.from({ length: 4 }, (_, i) => ({
        id: `${id}-s${i}`,
        reps: 5,
        weight: kg,
        isWarmup: false,
        rpe: 8,
        position: i,
      })),
    },
  ],
});
const current = squat('cur', END - 60 * MIN);
const history = [3, 6, 9].map((n) => squat(`h${n}`, END - 60 * MIN - n * DAY));

const night = (daysAgo: number): SleepNight => {
  const bed = END - daysAgo * DAY - 10 * HOUR;
  return {
    id: `n${daysAgo}`,
    date: new Date(bed + 7 * HOUR).toISOString().slice(0, 10),
    bedtime: bed,
    wake: bed + 7 * HOUR,
    source: 'backfill',
  } as SleepNight;
};

const vape: NicotineProduct = {
  ...newNicotineProduct('vape', 'v'),
  unit: 'ml',
  amount: 1.5,
  strengthMg: 20,
};
const heated: NicotineProduct = {
  ...newNicotineProduct('heated', 'h'),
  unit: 'sticks',
  amount: 8,
  strengthMg: 1,
};

function seed(
  opts: {
    products?: NicotineProduct[];
    settings?: Partial<NicotineSettings>;
    workouts?: Workout[];
    sleeps?: SleepNight[];
  } = {},
) {
  __replaceStateForTests({
    ...__getStateForTests(),
    workouts: opts.workouts ?? history,
    sleeps: opts.sleeps ?? [1, 2, 3, 4, 5].map(night),
    nicotine: {
      products: opts.products ?? [vape, heated],
      settings: { ...defaultNicotineSettings(), ...opts.settings },
      updatedAt: 1,
    },
  });
}

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* no storage */
  }
  setLocale('en');
});
afterEach(() => {
  cleanup();
  __replaceStateForTests({ ...__getStateForTests(), nicotine: emptyNicotineState() });
});

describe('NicotineCard', () => {
  it('shows the two lines as ranges with a weak-evidence label, marks them as estimates, and offers the explanation', () => {
    seed();
    render(<NicotineCard workout={current} />);
    expect(screen.getByText('Without nicotine')).toBeTruthy();
    expect(screen.getByText('Recovery time')).toBeTruthy();
    expect(
      screen.getByText(/About \d+(–\d+)?% quicker\. Between sessions of the same kind\./),
    ).toBeTruthy();
    // No top-set / e1RM line and no kg on a lift: not evidenced.
    expect(screen.queryByText('Top set')).toBeNull();
    expect(screen.queryByText(/heavier/)).toBeNull();
    expect(screen.queryByText(/ kg/)).toBeNull();
    expect(screen.getByText('Time in bed')).toBeTruthy();
    expect(
      screen.getByText(/May need slightly more time in bed with nicotine: about \d+(–\d+)? min\./),
    ).toBeTruthy();
    expect(screen.getAllByText('Weak evidence')).toHaveLength(2);
    expect(screen.getByText('Estimates from your own settings. Not medical advice.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'How is this estimated?' })).toBeTruthy();
  });

  it('does not build the "smoked less" what-if (board 4B is not approved)', () => {
    seed();
    render(<NicotineCard workout={current} />);
    expect(screen.queryByText(/less/i)).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('is hidden with no products, with the master switch off, or with the hints switch off', () => {
    seed({ products: [] });
    const a = render(<NicotineCard workout={current} />);
    expect(a.container.firstChild).toBeNull();
    cleanup();
    seed({ settings: { useInCalculations: false } });
    const b = render(<NicotineCard workout={current} />);
    expect(b.container.firstChild).toBeNull();
    cleanup();
    seed({
      settings: { surfaces: { ...defaultNicotineSettings().surfaces, afterWorkoutHints: false } },
    });
    const c = render(<NicotineCard workout={current} />);
    expect(c.container.firstChild).toBeNull();
  });

  it('leaves out a line it has no data for (no history: no recovery line; no nights: no sleep line)', () => {
    seed({ workouts: [], sleeps: [] });
    render(<NicotineCard workout={current} />);
    expect(screen.queryByText('Recovery time')).toBeNull();
    expect(screen.queryByText('Time in bed')).toBeNull();
  });

  it('is hidden when only experimental surfaces are on and no research-backed one is', () => {
    const surfaces = { ...defaultNicotineSettings().surfaces };
    for (const k of EXPERIMENTAL_SURFACES) surfaces[k] = true;
    for (const k of EVIDENCE_SURFACES) surfaces[k] = k === 'afterWorkoutHints';
    seed({ settings: { surfaces } });
    const a = render(<NicotineCard workout={current} />);
    expect(a.container.firstChild).toBeNull();
  });

  it('is hidden when no line has any data', () => {
    seed({ workouts: [], sleeps: [] });
    const empty: Workout = { ...current, exercises: [] };
    const { container } = render(<NicotineCard workout={empty} />);
    expect(container.firstChild).toBeNull();
  });

  it('"How is this estimated?" opens the sheet: per-product mg, one combined load, own numbers, rough default', () => {
    seed();
    render(<NicotineCard workout={current} />);
    fireEvent.click(screen.getByRole('button', { name: 'How is this estimated?' }));
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText('How this is estimated')).toBeTruthy();
    expect(within(sheet).getByText('Vape')).toBeTruthy();
    expect(within(sheet).getByText('ml: 1.5 × 20 mg')).toBeTruthy();
    expect(within(sheet).getByText('label ≈ 30 mg')).toBeTruthy();
    expect(within(sheet).getByText('≈ 9 mg absorbed')).toBeTruthy();
    expect(within(sheet).getByText('Heated tobacco')).toBeTruthy();
    expect(within(sheet).getByText('sticks: 8 × 1 mg')).toBeTruthy();
    expect(within(sheet).getByText('≈ 4.8 mg absorbed')).toBeTruthy();
    expect(within(sheet).getByText('One combined load')).toBeTruthy();
    expect(within(sheet).getByText('≈ 14 mg')).toBeTruthy(); // 9 + 4.8 absorbed
    expect(within(sheet).getByText(/13\.8 cigarette-equivalents/)).toBeTruthy();
    // The research disclaimer and the sources list.
    expect(within(sheet).getByText(/These estimates come from population averages/)).toBeTruthy();
    expect(
      within(sheet).getByText(/Where the research is limited, we show it as experimental/),
    ).toBeTruthy();
    expect(within(sheet).getByText('Sources')).toBeTruthy();
    expect(within(sheet).getByText(/Catoire et al\. 2021, Sleep Med Rev 60/)).toBeTruthy();
    expect(within(sheet).getByText(/Phillips-Waller et al\. 2021/)).toBeTruthy();
    expect(
      within(sheet).getByText('Dinas et al. 2013, Int J Cardiol 163:109 (systematic review)'),
    ).toBeTruthy();
    expect(within(sheet).getByText(/Zhang et al\. 2006/)).toBeTruthy();
    expect(within(sheet).getByText(/Jacobson et al\. 2021/)).toBeTruthy();
    expect(within(sheet).queryByText(/approx/)).toBeNull();
    expect(within(sheet).getByText('Your own numbers')).toBeTruthy();
    expect(within(sheet).getByText('A rough default')).toBeTruthy();
    expect(within(sheet).getByText('Estimates, adjustable, not medical advice.')).toBeTruthy();
    expect(within(sheet).queryByText('Open “Use in calculations”')).toBeNull();
  });

  it('the sheet shows a from-time-to-time product without an amount; the mg stay per day', () => {
    const some: NicotineProduct = {
      ...newNicotineProduct('cigarettes', 'c'),
      amount: 20,
      strengthMg: 1,
      occasional: true,
    };
    seed({ products: [vape, some] });
    render(<NicotineCard workout={current} />);
    fireEvent.click(screen.getByRole('button', { name: 'How is this estimated?' }));
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText('From time to time × 1 mg')).toBeTruthy();
    expect(within(sheet).queryByText(/pieces:/)).toBeNull();
  });

  it('the sheet links to the settings only when the screen can open them', () => {
    seed();
    const open = vi.fn();
    render(<NicotineCard workout={current} onOpenSettings={open} />);
    fireEvent.click(screen.getByRole('button', { name: 'How is this estimated?' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open “Use in calculations”' }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('counts a pack of cigarettes in pieces so mg lines up', () => {
    seed({
      products: [
        { ...newNicotineProduct('cigarettes', 'c'), unit: 'packs', amount: 1, strengthMg: 1 },
      ],
    });
    render(<NicotineCard workout={current} />);
    fireEvent.click(screen.getByRole('button', { name: 'How is this estimated?' }));
    expect(screen.getByText('pieces: 20 × 1 mg')).toBeTruthy();
    expect(screen.getAllByText('≈ 20 mg absorbed').length).toBeGreaterThan(0);
  });

  it('reads in the selected language', () => {
    setLocale('uk');
    seed();
    render(<NicotineCard workout={current} />);
    expect(screen.getByText('Без нікотину')).toBeTruthy();
    expect(screen.getByText('Як це оцінюється?')).toBeTruthy();
  });
});

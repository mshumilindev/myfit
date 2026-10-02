import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SupplementsCard } from './SupplementsCard';
import { supplementCardModel } from './supplementCardModel';
import { __getStateForTests, __replaceStateForTests } from '../../store';
import { setLocale } from '../../i18n';
import {
  defaultSupplementSettings,
  emptySupplementState,
  emptySupplementEffects,
  newSupplementEntry,
} from '../../supplements';
import { SUPPLEMENT_SOURCES } from '../../supplementCatalog';
import type {
  SupplementCheckin,
  SupplementEntry,
  SupplementId,
  SupplementSurface,
  Workout,
} from '../../types';

// Workout on Wed 7 Oct 2026, 18:00. Entries saved on 2026-09-01 (five weeks before).
const WORKOUT_AT = new Date(2026, 9, 7, 18).getTime();
const T0 = new Date(2026, 8, 1, 10).getTime();
const wo = (startedAt: number): Workout =>
  ({
    id: 'w',
    startedAt,
    finishedAt: startedAt + 3_600_000,
    autoFinished: false,
    gymId: null,
    exercises: [],
  }) as unknown as Workout;
const ent = (id: SupplementId, over: Partial<SupplementEntry> = {}): SupplementEntry => ({
  ...newSupplementEntry(id, `e-${id}`, T0),
  ...over,
});

function seed(
  entries: SupplementEntry[],
  opts: {
    master?: boolean;
    off?: SupplementSurface[];
    checkins?: Record<string, SupplementCheckin>;
  } = {},
) {
  const settings = defaultSupplementSettings();
  settings.useInCalculations = opts.master ?? true;
  for (const s of opts.off ?? []) settings.surfaces[s] = false;
  __replaceStateForTests({
    ...__getStateForTests(),
    // The workout itself is a finished workout of that day: a training day.
    workouts: [wo(WORKOUT_AT)],
    supplements: { entries, checkins: opts.checkins ?? {}, settings, updatedAt: 1 },
  });
}

beforeEach(() => {
  setLocale('en');
  try {
    localStorage.clear();
  } catch {
    /* no storage */
  }
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(WORKOUT_AT + 3_600_000);
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

describe('supplementCardModel', () => {
  const settings = defaultSupplementSettings();
  const fx = () => {
    const e = emptySupplementEffects();
    e.creatineStrength = { low: 0, high: 0.0423 };
    e.creatineBodyweightKg = { low: 0.5, high: 2 };
    e.caffeineRpe = { low: -0.5, high: -0.2 };
    return e;
  };
  it('is null without effects, with the hints switch off, or when nothing rounds up', () => {
    expect(supplementCardModel(null, settings)).toBeNull();
    expect(supplementCardModel(fx(), settings)).not.toBeNull();
    expect(
      supplementCardModel(fx(), {
        useInCalculations: true,
        surfaces: { ...settings.surfaces, afterWorkoutHints: false },
      }),
    ).toBeNull();
    expect(supplementCardModel(fx(), { ...settings, useInCalculations: false })).toBeNull();
    const tiny = emptySupplementEffects();
    tiny.creatineStrength = { low: 0, high: 0.004 };
    tiny.caffeineRpe = { low: -0.04, high: -0.02 };
    expect(supplementCardModel(tiny, settings)).toBeNull();
  });
  it('turns fractions into percent, keeps kg and shows the RPE drop as positive points', () => {
    expect(supplementCardModel(fx(), settings)).toEqual({
      strengthPct: { low: 0, high: 4 },
      weightKg: { low: 0.5, high: 2 },
      rpe: { low: 0.2, high: 0.5 },
    });
  });
});

describe('SupplementsCard', () => {
  it('shows the creatine expectation and body-weight note, with no promise of a load change', () => {
    seed([ent('creatine')]);
    render(<SupplementsCard workout={wo(WORKOUT_AT)} />);
    expect(screen.getByText('Your supplements')).toBeTruthy();
    expect(screen.getByText(/May rise about \+0–3 % over the next weeks/)).toBeTruthy();
    expect(screen.getByText(/Your loads are not changed/)).toBeTruthy();
    expect(screen.getByText(/0\.5–2 kg in the first 1–2 weeks, mostly water/)).toBeTruthy();
    expect(screen.queryByText(/easier/)).toBeNull();
  });

  it('shows the caffeine effort note on a training day with a pre-workout dose', () => {
    seed([ent('caffeine', { dose: 200 })]);
    render(<SupplementsCard workout={wo(WORKOUT_AT)} />);
    expect(screen.getByText(/sets may feel about 0\.2–0\.5 RPE easier/)).toBeTruthy();
    expect(screen.queryByText(/May rise about/)).toBeNull();
  });

  it('is light: no evidence tags, one card', () => {
    seed([ent('creatine'), ent('caffeine')]);
    render(<SupplementsCard workout={wo(WORKOUT_AT)} />);
    expect(screen.getAllByTestId('sup-fx-card')).toHaveLength(1);
    expect(screen.queryByText('Weak evidence')).toBeNull();
    expect(screen.getByText('Strength')).toBeTruthy();
    expect(screen.getByText('Effort')).toBeTruthy();
  });

  it('is hidden with nothing saved, off, a switched-off surface, or nothing that applies today', () => {
    const none = () =>
      expect(render(<SupplementsCard workout={wo(WORKOUT_AT)} />).container.firstChild).toBeNull();
    seed([]);
    none();
    cleanup();
    seed([ent('creatine')], { master: false });
    none();
    cleanup();
    seed([ent('creatine')], { off: ['afterWorkoutHints'] });
    none();
    cleanup();
    seed([ent('vitaminD'), ent('whey'), ent('melatonin')]); // tracked, no effect to show here
    none();
    cleanup();
    seed([ent('creatine', { startedAt: WORKOUT_AT })]); // saved today: the ramp has not started
    none();
  });

  it('a "None" check-in for the day takes it away', () => {
    seed([ent('creatine')], { checkins: { '2026-10-07': { taken: false } } });
    expect(render(<SupplementsCard workout={wo(WORKOUT_AT)} />).container.firstChild).toBeNull();
  });

  it('"How is this estimated?" opens the sheet with the disclaimer, the sources and the link', () => {
    seed([ent('creatine'), ent('caffeine')]);
    const open = vi.fn();
    render(<SupplementsCard workout={wo(WORKOUT_AT)} onOpenSettings={open} />);
    fireEvent.click(screen.getByRole('button', { name: /How is this estimated/ }));
    expect(screen.getByText(/Supplement effects are small, vary between people/)).toBeTruthy();
    expect(
      screen.getByText(/never changes your training loads because of a supplement/),
    ).toBeTruthy();
    for (const key of ['creatine', 'caffeine'] as const)
      expect(screen.getByText(SUPPLEMENT_SOURCES[key].cite)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Open .Use in calculations./ }));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('works in every locale (no missing strings)', () => {
    seed([ent('creatine'), ent('caffeine')]);
    for (const lang of ['uk', 'pl', 'lt', 'et'] as const) {
      setLocale(lang);
      const r = render(<SupplementsCard workout={wo(WORKOUT_AT)} />);
      expect(r.container.textContent).not.toMatch(/undefined|\[object/);
      expect(r.container.querySelector('[data-line="strength"]')).toBeTruthy();
      r.unmount();
    }
    setLocale('en');
  });
});

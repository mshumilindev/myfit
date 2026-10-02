import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AlcoholCard } from './AlcoholCard';
import { alcoholCardModel } from './alcoholCardModel';
import { __getStateForTests, __replaceStateForTests } from '../../store';
import { setLocale } from '../../i18n';
import {
  ALCOHOL_SOURCES,
  ALCOHOL_SURFACES,
  defaultAlcoholSettings,
  effectsForLoad,
  emptyAlcoholState,
  newAlcoholEntry,
} from '../../alcohol';
import type { AlcoholSurface, Workout } from '../../types';

const SAT_EVENING = new Date(2026, 9, 3, 18).getTime(); // Saturday
const SUN_EVENING = SAT_EVENING + 24 * 3600 * 1000;

const wo = (startedAt: number): Workout =>
  ({
    id: 'w',
    startedAt,
    finishedAt: startedAt + 3600_000,
    autoFinished: false,
    exercises: [],
  }) as unknown as Workout;

function seed(
  opts: { usualDays?: number[]; servings?: number; master?: boolean; off?: AlcoholSurface[] } = {},
) {
  const settings = defaultAlcoholSettings();
  settings.useInCalculations = opts.master ?? true;
  for (const s of ALCOHOL_SURFACES) settings.surfaces[s] = true;
  for (const s of opts.off ?? []) settings.surfaces[s] = false;
  settings.usualDays = opts.usualDays ?? [4]; // Friday
  __replaceStateForTests({
    ...__getStateForTests(),
    alcohol: {
      entries:
        (opts.servings ?? 6) > 0
          ? [{ ...newAlcoholEntry('beerRegular', 'b', 500), servingsPerWeek: opts.servings ?? 6 }]
          : [],
      checkins: {},
      settings,
      updatedAt: 1,
    },
  });
}

beforeEach(() => setLocale('en'));
afterEach(() => {
  cleanup();
  __replaceStateForTests({ ...__getStateForTests(), alcohol: emptyAlcoholState() });
});

describe('alcoholCardModel', () => {
  const settings = defaultAlcoholSettings();
  it('is null without effects, with the hints switch off, and when nothing rounds up', () => {
    expect(alcoholCardModel(null, settings)).toBeNull();
    const fx = effectsForLoad({ gramsPerWeek: 300 } as never, {});
    expect(alcoholCardModel(fx, { ...settings, useInCalculations: true })).not.toBeNull();
    expect(
      alcoholCardModel(fx, {
        useInCalculations: true,
        surfaces: { ...settings.surfaces, afterWorkoutHints: false },
      }),
    ).toBeNull();
    expect(
      alcoholCardModel(effectsForLoad({ gramsPerWeek: 0.1 } as never, {}), settings),
    ).toBeNull();
  });
  it('turns the readiness factor into a percent range and keeps the sleep minutes', () => {
    const m = alcoholCardModel(effectsForLoad({ gramsPerWeek: 1000 } as never, {}), {
      useInCalculations: true,
      surfaces: {},
    } as never)!;
    expect(m.recoveryPct!.high).toBeLessThanOrEqual(10);
    expect(m.recoveryPct!.low).toBeLessThanOrEqual(m.recoveryPct!.high);
    expect(m.sleepMin!.high).toBeLessThanOrEqual(30);
  });
});

describe('AlcoholCard', () => {
  it('shows on the day after a usual drinking day, with both lines and weak-evidence tags', () => {
    seed(); // Friday usual
    render(<AlcoholCard workout={wo(SAT_EVENING)} />);
    expect(screen.getByText('Without alcohol')).toBeTruthy();
    expect(screen.getByText(/quicker, the day after drinking/)).toBeTruthy();
    expect(screen.getByText(/more time in bed after drinking/)).toBeTruthy();
    expect(screen.getAllByText('Weak evidence')).toHaveLength(2);
  });

  it('is hidden on other days, with alcohol off, no drinks, or the hints switch off', () => {
    seed();
    expect(render(<AlcoholCard workout={wo(SUN_EVENING)} />).container.firstChild).toBeNull();
    cleanup();
    seed({ master: false });
    expect(render(<AlcoholCard workout={wo(SAT_EVENING)} />).container.firstChild).toBeNull();
    cleanup();
    seed({ servings: 0 });
    expect(render(<AlcoholCard workout={wo(SAT_EVENING)} />).container.firstChild).toBeNull();
    cleanup();
    seed({ off: ['afterWorkoutHints'] });
    expect(render(<AlcoholCard workout={wo(SAT_EVENING)} />).container.firstChild).toBeNull();
  });

  it('a "No" check-in for the evening before hides it', () => {
    seed();
    const s = __getStateForTests();
    __replaceStateForTests({
      ...s,
      alcohol: { ...s.alcohol, checkins: { '2026-10-02': { drank: false } } },
    });
    expect(render(<AlcoholCard workout={wo(SAT_EVENING)} />).container.firstChild).toBeNull();
  });

  it('"How is this estimated?" opens the sheet with the disclaimer, every source, and Settings', () => {
    seed();
    const open = vi.fn();
    render(<AlcoholCard workout={wo(SAT_EVENING)} onOpenSettings={open} />);
    fireEvent.click(screen.getByRole('button', { name: /How is this estimated/ }));
    expect(screen.getByText(/Estimates are based on population studies of alcohol/)).toBeTruthy();
    for (const src of ALCOHOL_SOURCES)
      expect(
        screen.getByText(new RegExp(src.cite.slice(0, 12).replace(/[()]/g, '\\$&'))),
      ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Open .Use in calculations./ }));
    expect(open).toHaveBeenCalledTimes(1);
  });
});

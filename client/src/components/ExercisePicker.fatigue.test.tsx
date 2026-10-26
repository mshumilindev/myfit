import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LOCALES, setLocale } from '../i18n';
import { __getStateForTests, __replaceStateForTests } from '../store';
import { BUILT_IN_CATALOG } from '../data/exercises';
import type { Workout } from '../types';
import { ExercisePicker } from './ExercisePicker';

// SPO-352 / SPO-353: the muscle card must say Fresh (and why) for a rested muscle, even with a flat lift.
const NOW = new Date(2026, 9, 26, 12, 0).getTime();
const DAY = 86400000;
const bench = BUILT_IN_CATALOG.find((c) => c.muscle === 'chest' && /bench press/i.test(c.names[0]))!
  .names[0];

const session = (id: string, startedAt: number, sets: number): Workout => ({
  id,
  startedAt,
  finishedAt: startedAt + 3600000,
  autoFinished: false,
  exercises: [
    {
      id: `${id}-e`,
      name: bench,
      position: 0,
      sets: Array.from({ length: sets }, (_, i) => ({
        id: `${id}-s${i}`,
        reps: 8,
        weight: 60,
        isWarmup: false,
      })),
    } as never,
  ],
});
const setWorkouts = (workouts: Workout[]) =>
  __replaceStateForTests({ ...__getStateForTests(), workouts } as never);

function show() {
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as never;
  render(
    <ExercisePicker
      workout={{
        id: 'cur',
        startedAt: NOW - 600000,
        finishedAt: null,
        autoFinished: false,
        exercises: [],
      }}
      gym={null}
      onPick={vi.fn()}
      onMarker={vi.fn()}
      onCardio={vi.fn()}
      onCreate={vi.fn()}
      onClose={vi.fn()}
    />,
  );
}
const openChest = (name: string) =>
  fireEvent.click(
    screen
      .getAllByText(name)
      .map((n) => n.closest('button'))
      .find(Boolean)!,
  );

beforeEach(() => {
  setLocale('en');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  setWorkouts([]);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('muscle cards: fatigue label and its reason', () => {
  const rested = [9, 12, 15, 18].map((d) => session(`r${d}`, NOW - d * DAY, 3));

  it("owner's scenario: flat chest lift, last session 9 days ago -> every tile Fresh, never High", () => {
    setWorkouts(rested);
    show();
    const states = [...document.querySelectorAll('.xp-fam-state')].map((n) => n.textContent);
    expect(states.length).toBeGreaterThan(0);
    for (const s of states) expect(s).toBe(LOCALES.en.fatLevel.fresh);
    expect(document.body.textContent).not.toContain(LOCALES.en.fatLevel.high);
  });

  it('the detail header says Fresh, 0 of N sets, and why (last trained 9 d ago)', () => {
    setWorkouts(rested);
    show();
    openChest(LOCALES.en.pickFamilies.chest);
    const sub = document.querySelector('.xp-ghead-sub')!;
    expect(sub.textContent).toContain(LOCALES.en.fatLevel.fresh);
    expect(sub.textContent).toMatch(/^Fresh · 0 of \d+ sets this week$/);
    expect(document.querySelector('.xp-ghead-why')!.textContent).toBe(LOCALES.en.fatWhy.idle(9));
  });

  it('a loaded week explains itself with the sets against the limit instead', () => {
    setWorkouts([session('h', NOW - DAY, 24)]);
    show();
    openChest(LOCALES.en.pickFamilies.chest);
    const why = document.querySelector('.xp-ghead-why')!.textContent!;
    expect(why).toBe(LOCALES.en.fatWhy.load(24, 22));
    expect(document.querySelector('.xp-ghead-sub .st')!.textContent).not.toBe(
      LOCALES.en.fatLevel.fresh,
    );
  });

  it.each(Object.keys(LOCALES) as Array<keyof typeof LOCALES>)(
    '%s: the "why" hint is translated and carries the numbers',
    (loc) => {
      const t = LOCALES[loc];
      expect(t.fatWhy.idle(9)).toContain('9');
      expect(t.fatWhy.idle(null).length).toBeGreaterThan(5);
      expect(t.fatWhy.load(24, 22)).toMatch(/24.*22/);
      if (loc !== 'en') {
        expect(t.fatWhy.idle(9)).not.toBe(LOCALES.en.fatWhy.idle(9));
        expect(t.fatWhy.load(24, 22)).not.toBe(LOCALES.en.fatWhy.load(24, 22));
      }
    },
  );
});

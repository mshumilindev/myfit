import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { setLocale } from '../../i18n';
import { en } from '../../i18n/en';
import type { HomeMove } from '../../homeSets';
import type { Activity, SleepNight, Workout } from '../../types';
import { DAY, NOW, emptyState, freezeClock, history, seed } from '../__fixtures__/viewKit';
import { useLastLabel, useLiveLock, useMoveName, useMuscleName } from './homeHooks';
import {
  NEW_SET,
  dropSetDraft,
  forgetMove,
  pruneHomeSetDrafts,
  putSetDraft,
  setPicks,
  usePicks,
  useSetDraft,
} from './homeSetDraft';

beforeEach(() => {
  freezeClock(NOW);
  setLocale('en');
  seed(emptyState());
});
afterEach(() => {
  cleanup();
  pruneHomeSetDrafts([]);
});

const move = (over: Partial<HomeMove> = {}): HomeMove =>
  ({
    id: 'm1',
    name: 'Push-up',
    measure: 'reps',
    muscle: 'chest',
    icon: 'pushup',
    ...over,
  }) as HomeMove;

describe('home hooks: names and the last-run label', () => {
  it('a catalog move uses the localized exercise name, an own move keeps what the person typed', () => {
    const { result } = renderHook(() => useMoveName());
    expect(result.current(move({ name: 'Push-up' }))).toBe('Push-up');
    expect(result.current(move({ custom: true, name: 'My own thing' }))).toBe('My own thing');
  });

  it('a muscle group is named from the dictionary and falls back to the raw id', () => {
    const { result } = renderHook(() => useMuscleName());
    expect(result.current('chest')).toBe((en.muscleGroups as Record<string, string>).chest);
    expect(result.current('not-a-muscle')).toBe('not-a-muscle');
  });

  it('"Last: …" says today and yesterday with the clock, an older day with its weekday and date', () => {
    const { result } = renderHook(() => useLastLabel());
    const today = result.current(NOW - 3600_000, 12);
    expect(today).toMatch(/^Last: today, \d{1,2}[:.]\d{2}.* · 12 min$/);
    const yest = result.current(NOW - DAY, 30);
    expect(yest).toMatch(/^Last: yesterday, /);
    expect(yest).toContain('30 min');
    const older = result.current(NOW - 5 * DAY, 45);
    expect(older).not.toMatch(/today|yesterday/);
    expect(older).toContain('21');
    expect(older).toContain('45 min');
  });
});

describe('home hooks: the live lock', () => {
  const draftWorkout = (exercises: Workout['exercises'], dayName = 'Push'): Workout =>
    ({ ...history(1)[0], id: 'live', finishedAt: null, dayName, exercises }) as Workout;
  const act1 = {
    id: 'a1',
    type: 'run',
    category: 'conditioning',
    startedAt: NOW,
    finishedAt: null,
    durationMin: 0,
  } as Activity;
  const sleep1 = {
    id: 's1',
    date: 'd',
    bedtime: NOW - 3600_000,
    wake: null,
    source: 'live',
  } as unknown as SleepNight;

  it('nothing runs: not busy, not locked', () => {
    const { result } = renderHook(() => useLiveLock());
    expect(result.current).toMatchObject({
      open: null,
      liveAct: null,
      sleepLive: null,
      busy: false,
      locked: false,
      liveName: '',
    });
  });

  it('an empty draft session is busy but does not lock, and is named by its day or the default label', () => {
    seed({ ...emptyState(), workouts: [draftWorkout([], 'Push')] });
    expect(renderHook(() => useLiveLock()).result.current).toMatchObject({
      busy: true,
      locked: false,
      liveName: 'Push',
    });
    cleanup();
    seed({ ...emptyState(), workouts: [draftWorkout([], '')] });
    expect(renderHook(() => useLiveLock()).result.current.liveName).toBe(en.startSessionLabel);
  });

  it('a session with an exercise locks everything else', () => {
    seed({ ...emptyState(), workouts: [draftWorkout(history(1)[0].exercises.slice(0, 1))] });
    expect(renderHook(() => useLiveLock()).result.current).toMatchObject({
      busy: true,
      locked: true,
      liveName: 'Push',
    });
  });

  it('a running activity locks and is named by its type; an unknown type falls back to the id', () => {
    seed({ ...emptyState(), activities: [act1] });
    expect(renderHook(() => useLiveLock()).result.current).toMatchObject({
      locked: true,
      liveName: en.actType.run,
    });
    cleanup();
    seed({ ...emptyState(), activities: [{ ...act1, type: 'zzz' }] });
    expect(renderHook(() => useLiveLock()).result.current.liveName).toBe('zzz');
  });

  it('a running sleep locks and is named "Sleep"', () => {
    seed({ ...emptyState(), sleeps: [sleep1] });
    expect(renderHook(() => useLiveLock()).result.current).toMatchObject({
      locked: true,
      liveName: en.sleepTitle,
    });
  });
});

describe('home set drafts', () => {
  it('a draft is kept per set until it is dropped; dropping an unknown one changes nothing', () => {
    const d = renderHook(() => useSetDraft('s1'));
    expect(d.result.current).toBeUndefined();
    act(() => putSetDraft('s1', { name: 'Morning', moves: ['a', 'b'] }));
    expect(d.result.current).toEqual({ name: 'Morning', moves: ['a', 'b'] });
    act(() => dropSetDraft('nope'));
    expect(d.result.current?.name).toBe('Morning');
    act(() => dropSetDraft('s1'));
    expect(d.result.current).toBeUndefined();
  });

  it('deleting an own move removes it from every draft and from the picker selection', () => {
    const picks = renderHook(() => usePicks());
    const a = renderHook(() => useSetDraft('s1'));
    const b = renderHook(() => useSetDraft(NEW_SET));
    act(() => {
      putSetDraft('s1', { name: 'A', moves: ['x', 'y'] });
      putSetDraft(NEW_SET, { name: 'B', moves: ['y', 'z'] });
      setPicks(['x', 'z']);
    });
    act(() => forgetMove('y'));
    expect(a.result.current?.moves).toEqual(['x']);
    expect(b.result.current?.moves).toEqual(['z']);
    act(() => forgetMove('x'));
    expect(picks.result.current).toEqual(['z']);
  });

  it('leaving the screen clears drafts and picks; staying on a set page keeps its own draft', () => {
    const a = renderHook(() => useSetDraft('s1'));
    const picks = renderHook(() => usePicks());
    act(() => {
      putSetDraft('s1', { name: 'A', moves: ['x'] });
      putSetDraft('s2', { name: 'B', moves: [] });
      setPicks(['x']);
    });
    act(() =>
      pruneHomeSetDrafts([
        { screen: 'home-set', page: 'set', id: 's1' },
        { screen: 'home-set', page: 'add' },
      ]),
    );
    expect(a.result.current?.name).toBe('A');
    expect(picks.result.current).toEqual(['x']);
    act(() => pruneHomeSetDrafts([{ screen: 'home-set', page: 'set', id: 's1' }]));
    expect(a.result.current?.name).toBe('A');
    expect(picks.result.current).toEqual([]);
    act(() => pruneHomeSetDrafts([{ screen: 'session' }, null]));
    expect(a.result.current).toBeUndefined();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { __getStateForTests } from '../store';
import type { StoreState } from '../store';
import { personalLandmarks, tuneSummary } from '../personalize';
import { VOLUME_MUSCLES, VOLUME_ZONES } from '../volume';
import type { Exercise, Workout } from '../types';
import {
  DAY,
  freezeClock,
  makeShell,
  NOW,
  richState,
  seed,
  set,
  setDesktop,
} from './__fixtures__/viewKit';

const m = vi.hoisted(() => ({ start: vi.fn(), add: vi.fn() }));
vi.mock('../data/programMine', async (orig) => ({
  ...(await orig<typeof import('../data/programMine')>()),
  useProgramMine: () => ({ assignment: null, active: true }),
}));
vi.mock('../store', async (orig) => ({
  ...(await orig<typeof import('../store')>()),
  startWorkout: (...a: unknown[]) => m.start(...a),
  addExercise: (...a: unknown[]) => m.add(...a),
}));

import { ProgressView } from './ProgressView';

type Lens = 'volume' | 'fatigue' | 'readiness';
const open = (o: { lens?: Lens; state?: StoreState } = {}) => {
  if (o.state) seed(o.state);
  const shell = makeShell();
  const onLens = vi.fn();
  const out = render(
    <ProgressView
      store={__getStateForTests() as never}
      shell={shell}
      sub="progress"
      seg="volume"
      onSeg={vi.fn()}
      lens={o.lens ?? 'volume'}
      onLens={onLens}
    />,
  );
  return { ...out, shell, onLens };
};
const LIFTS: Array<[string, string]> = [
  ['Barbell Bench Press - Medium Grip', 'chest'],
  ['Barbell Squat', 'quads'],
  ['Bent Over Barbell Row', 'back'],
  ['Barbell Shoulder Press', 'shoulders'],
];
/** One brutal session `ago` days back: `sets` working sets on each of the first `n` lifts. */
const pile = (n: number, sets: number, ago = 1): Workout => {
  const at = NOW - ago * DAY;
  const exercises = LIFTS.slice(0, n).map(
    ([name, muscle], i) =>
      ({
        id: `p${i}`,
        name,
        kind: 'strength',
        position: i,
        primaryMuscle: muscle,
        secondaryMuscles: [],
        sets: Array.from({ length: sets }, (_, k) => set(`p${i}-${k}`, 10, 80)),
      }) as unknown as Exercise,
  );
  return {
    id: `pile${n}`,
    startedAt: at,
    finishedAt: at + 3600_000,
    gymId: null,
    exercises,
  } as unknown as Workout;
};
/** Fillers keep the screen unlocked (3 finished sessions) without adding real load. */
const filler = (id: string, ago: number): Workout => ({
  ...pile(1, 1, ago),
  id,
  exercises: [
    { ...pile(1, 1, ago).exercises[0], name: 'Barbell Deadlift', primaryMuscle: 'hamstrings' },
  ],
});
const recent = (extra: Workout[]): StoreState => ({
  ...richState(),
  workouts: [...extra, filler('f1', 3), filler('f2', 4)],
});
const rowEls = () => [...document.querySelectorAll('.vol-row')] as HTMLElement[];
const nameOf = (r: Element) => r.querySelector('.vol-name')?.textContent;
const seg = (label: string) =>
  [...document.querySelectorAll('.uiseg-opt')].find((b) => b.textContent === label) as HTMLElement;

beforeEach(() => {
  freezeClock(NOW);
  setLocale('en');
  setDesktop(false);
  m.start.mockReset();
  m.add.mockReset();
  seed(richState());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ProgressView: volume list', () => {
  it('shows every trackable muscle with its zone, most loaded first', () => {
    open();
    expect(rowEls()).toHaveLength(VOLUME_MUSCLES.length);
    const ratio = (r: HTMLElement) =>
      parseFloat(r.querySelector('.vol-sets')?.textContent ?? '0') /
      Number(/MRV (\d+)/.exec(r.querySelector('.vol-cap-mrv')?.textContent ?? '')?.[1]);
    const rs = rowEls().map(ratio);
    expect(rs).toEqual([...rs].sort((a, b) => b - a));
    for (const r of rowEls()) expect(r.className).toMatch(/z-(none|under|productive|high|over)/);
  });

  it('the sort button flips the order', () => {
    open();
    const first = nameOf(rowEls()[0]);
    const last = nameOf(rowEls()[rowEls().length - 1]);
    fireEvent.click(screen.getByRole('button', { name: en.volSort }));
    expect(nameOf(rowEls()[0])).not.toBe(first);
    expect(document.querySelector('.vol-sort.asc')).not.toBeNull();
    expect(nameOf(rowEls()[rowEls().length - 1])).toBe(first);
    expect(last).toBeTruthy();
  });

  it('zone grain groups the muscles into the six zones with their translated names', () => {
    open();
    fireEvent.click(seg(en.volZones));
    expect(rowEls()).toHaveLength(VOLUME_ZONES.length);
    const names = rowEls().map(nameOf);
    for (const z of VOLUME_ZONES)
      expect(names).toContain(en.volZoneNames[z.key as keyof typeof en.volZoneNames]);
    expect(document.querySelector('.vol-row .muscle-icon, .vol-row svg')).toBeNull();
    fireEvent.click(seg(en.volFine));
    expect(rowEls()).toHaveLength(VOLUME_MUSCLES.length);
  });

  it('range 4 weeks scales the landmarks (MRV x4) against the rolling week', () => {
    open();
    const mrv = () =>
      Number(
        /MRV (\d+)/.exec(
          rowEls()
            .find((r) => nameOf(r) === en.muscleGroups.chest)
            ?.querySelector('.vol-cap-mrv')?.textContent ?? '',
        )?.[1],
      );
    const week = mrv();
    fireEvent.click(document.querySelector('.pv-top .uibtn') as HTMLElement);
    fireEvent.click(
      within(document.querySelector('.range-sheet') as HTMLElement).getByText(en.volRange28),
    );
    expect(mrv()).toBe(week * 4);
  });

  it('summary reflects the zones: over MRV beats below-MEV, which beats all good', () => {
    open({ state: recent([pile(1, 60)]) });
    const over = rowEls().filter((r) => r.classList.contains('z-over')).length;
    expect(over).toBeGreaterThan(0);
    expect(document.querySelector('.vol-note p')?.textContent).toBe(en.volAbove(over));
    cleanup();
    open({ state: richState() });
    const below = rowEls().filter(
      (r) => r.classList.contains('z-under') || r.classList.contains('z-none'),
    ).length;
    const overN = rowEls().filter((r) => r.classList.contains('z-over')).length;
    expect(document.querySelector('.vol-note p')?.textContent).toBe(
      overN > 0 ? en.volAbove(overN) : below > 0 ? en.volBelow(below) : en.volAllGood,
    );
  });

  it('the cold-start hint shows for a history younger than three weeks only', () => {
    open({ state: recent([pile(1, 3, 2)]) });
    expect(screen.getByText(en.volColdStart)).toBeTruthy();
    cleanup();
    open({ state: richState() });
    expect(screen.queryByText(en.volColdStart)).toBeNull();
  });

  it('the personalisation note counts tuned muscles, or says it is still estimating', () => {
    const s = richState();
    const tuned = tuneSummary(
      personalLandmarks(
        s.workouts.filter((w) => w.finishedAt !== null),
        NOW,
      ),
    );
    open();
    expect(document.querySelector('.vol-tuned')?.textContent).toBe(
      tuned.tunedCount > 0 ? en.volTuned(tuned.tunedCount) : en.volTunedDefault,
    );
    cleanup();
    open({ state: recent([pile(1, 3, 2)]) });
    expect(document.querySelector('.vol-tuned')?.textContent).toBe(en.volTunedDefault);
    expect(document.querySelector('.vol-tuned.on')).toBeNull();
  });
});

describe('ProgressView: volume nudges', () => {
  it('a muscle far under target gets a Fix button that opens the suggestion sheet', () => {
    open({ state: recent([pile(1, 12)]) });
    const fixable = rowEls().filter((r) => r.querySelector('.vol-fix'));
    expect(fixable.length).toBeGreaterThan(0);
    for (const r of fixable) expect(r.className).toMatch(/z-(none|under)/);
    const target = fixable[0];
    fireEvent.click(within(target).getByText(en.fixCta));
    const sheet = document.querySelector('.fix-sheet, [role="dialog"]') as HTMLElement;
    expect(sheet.textContent).toContain(en.fixTitle(nameOf(target) as string));
  });

  it('adding a Fix suggestion starts a session when none is open', () => {
    m.start.mockReturnValue({ id: 'new-w' });
    open({ state: recent([pile(1, 12)]) });
    const target = rowEls().find((r) => r.querySelector('.vol-fix')) as HTMLElement;
    fireEvent.click(within(target).getByText(en.fixCta));
    const sheet = document.querySelector('.fix-sheet') as HTMLElement;
    fireEvent.click(within(sheet).getAllByText(en.fixStartAndAdd)[0]);
    expect(m.start).toHaveBeenCalledTimes(1);
    expect(m.add).toHaveBeenCalledWith('new-w', expect.any(String), 'strength', expect.any(Object));
    expect(within(sheet).getAllByText(en.fixAddedNew).length).toBe(1);
  });

  it('one fried muscle earns a local deload card naming it', () => {
    open({ state: recent([pile(1, 60)]) });
    const card = document.querySelector('.deload-card') as HTMLElement;
    expect(card.className).toContain('local');
    expect(card.querySelector('.dl-title')?.textContent).toBe(
      en.deloadLocalTitle(en.muscleGroups.chest),
    );
    expect(card.querySelector('.dl-body')?.textContent).toBe(
      en.deloadLocalBody(en.muscleGroups.chest),
    );
  });

  it('several fried muscles earn the systemic deload card', () => {
    open({ state: recent([pile(4, 60)]) });
    const card = document.querySelector('.deload-card') as HTMLElement;
    expect(card.className).toContain('systemic');
    expect(card.querySelector('.dl-title')?.textContent).toBe(en.deloadSystemicTitle);
    expect(card.querySelector('.dl-body')?.textContent).toBe(en.deloadSystemicBody);
  });

  it('no deload card when nothing is fried', () => {
    open({ state: recent([pile(1, 3, 2)]) });
    expect(document.querySelector('.deload-card')).toBeNull();
  });

  it('chronically under-trained muscles appear in the weak-point radar with a Fix button', () => {
    const weeks = [0, 1, 2, 3, 4, 5].map((w) => ({ ...pile(1, 14, 2 + w * 7), id: `wk${w}` }));
    open({ state: recent(weeks) });
    const card = document.querySelector('.weak-card') as HTMLElement;
    expect(card.querySelector('.weak-title')?.textContent).toBe(en.weakTitle);
    const rows = [...card.querySelectorAll('.weak-row')];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].querySelector('.weak-metric')?.textContent).toMatch(/^\d+\/\d+ wk low$/);
    fireEvent.click(within(rows[0] as HTMLElement).getByText(en.fixCta));
    expect(document.querySelector('.fix-sheet')).not.toBeNull();
  });
});

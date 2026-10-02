import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { WarmupCard } from './WarmupCard';
import {
  __getStateForTests,
  __replaceStateForTests,
  addExercise,
  startWorkout,
  useStore,
} from '../store';
import { setLocale } from '../i18n';
import { warmupItemsOf } from '../warmupLog';
import { warmupProposal } from '../warmupFor';
import type { Workout } from '../types';

function Harness({ wid, eid }: { wid: string; eid: string }) {
  const { workouts } = useStore();
  const w = workouts.find((x) => x.id === wid)!;
  const ex = w.exercises.find((e) => e.id === eid)!;
  return <WarmupCard workout={w} exercise={ex} />;
}

const cur = (wid: string, eid: string) =>
  __getStateForTests()
    .workouts.find((w) => w.id === wid)!
    .exercises.find((e) => e.id === eid)!;

function setup(seedHistory: Workout[] = [], plan?: Parameters<typeof addExercise>[3]) {
  __replaceStateForTests({ ...__getStateForTests(), workouts: seedHistory });
  const w = startWorkout(null)!;
  const ex = addExercise(w.id, 'Warm-up', 'warmup', plan);
  render(<Harness wid={w.id} eid={ex.id} />);
  return { wid: w.id, eid: ex.id };
}

/** Open the picker, search the whole exercise database and tap the first hit. */
function pickFromDatabase(query: string, name: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
  fireEvent.change(screen.getByPlaceholderText(/Search/), { target: { value: query } });
  fireEvent.click(screen.getAllByText(name)[0]);
}

beforeEach(() => {
  setLocale('en');
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

describe('WarmupCard', () => {
  it('with no exercises it is a generic warm-up: Add exercise only — no checkbox, no counter', () => {
    const { wid, eid } = setup();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText(/\/ \d+ done/)).toBeNull();
    expect(screen.queryByRole('group', { name: 'Minutes' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add exercise' })).toBeTruthy();
    expect(cur(wid, eid).warmupItems).toBeUndefined();
    expect(cur(wid, eid).sets).toEqual([]);
  });

  it('a picked exercise appears as a PENDING cut-down logger with its name — nothing recorded yet', () => {
    const { wid, eid } = setup();
    pickFromDatabase('lateral raise', /Lateral Raise/);
    const items = warmupItemsOf(cur(wid, eid));
    expect(items).toHaveLength(1);
    expect(items[0].name).toMatch(/Lateral Raise/);
    expect(items[0].exerciseId).toBeTruthy();
    expect(items[0].reps).toBe(12);
    expect(items[0].done).toBe(false);
    const logger = screen.getByRole('group', { name: items[0].name });
    expect(logger.textContent).toContain(items[0].name);
    expect(screen.getByRole('textbox', { name: 'Reps' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log' })).toBeTruthy();
    // no tick, no counter, nothing of the full logger
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText(/done/i)).toBeNull();
    expect(screen.queryByText(/RPE|Rest|Note|Swap|Superset|failure/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /options|failure/i })).toBeNull();
  });

  it('values are only recorded when Log is pressed, then it collapses into a one-line row', () => {
    const { wid, eid } = setup([], {
      warmupItems: [{ name: 'Band Pull Apart', exerciseId: 'Band_Pull_Apart', reps: 15 }],
    });
    // bodyweight / band: reps only, no weight stepper
    expect(screen.queryByRole('textbox', { name: /Weight/ })).toBeNull();
    const reps = screen.getByRole('textbox', { name: 'Reps' }) as HTMLInputElement;
    fireEvent.change(reps, { target: { value: '20' } });
    fireEvent.blur(reps);
    // typing alone records nothing
    expect(warmupItemsOf(cur(wid, eid))[0]).toMatchObject({ reps: 15, done: false });
    fireEvent.click(screen.getByRole('button', { name: 'Log' }));
    expect(warmupItemsOf(cur(wid, eid))[0]).toMatchObject({ reps: 20, done: true });
    // collapsed: a line, no logger, no Log — only ONE set can be logged
    expect(screen.queryByRole('button', { name: 'Log' })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByText('Band Pull Apart')).toBeTruthy();
    expect(screen.getByText('20 reps')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit Band Pull Apart' })).toBeTruthy();
  });

  it('a stretch is logged in seconds', () => {
    const { wid, eid } = setup();
    pickFromDatabase('cat stretch', /^Cat Stretch$/);
    expect(warmupItemsOf(cur(wid, eid))[0]).toMatchObject({
      name: 'Cat Stretch',
      exerciseId: 'Cat_Stretch',
      durationSec: 30,
    });
    const input = screen.getByRole('textbox', { name: 'Hold, s' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '45' } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByRole('button', { name: 'Log' }));
    const it = warmupItemsOf(cur(wid, eid))[0];
    expect(it).toMatchObject({ durationSec: 45, done: true });
    expect(it.reps).toBeUndefined();
    expect(screen.getByText('45 s')).toBeTruthy();
  });

  it('a loaded move logs reps + weight; the line reads "12 reps · 10 kg"', () => {
    const { wid, eid } = setup([], {
      warmupItems: [{ name: 'Dumbbell Bicep Curl', reps: 12 }],
    });
    const w = screen.getByRole('textbox', { name: 'Weight, kg' }) as HTMLInputElement;
    fireEvent.change(w, { target: { value: '10' } });
    fireEvent.blur(w);
    fireEvent.click(screen.getByRole('button', { name: 'Log' }));
    expect(warmupItemsOf(cur(wid, eid))[0]).toMatchObject({ reps: 12, weight: 10, done: true });
    expect(screen.getByText('12 reps · 10 kg')).toBeTruthy();
  });

  it('Edit opens a drawer with the same logger; Save updates, it stays logged; Remove works', () => {
    const { wid, eid } = setup([], {
      warmupItems: [{ name: 'Dumbbell Bicep Curl', reps: 12 }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Log' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Dumbbell Bicep Curl' }));
    const reps = screen.getByRole('textbox', { name: 'Reps' }) as HTMLInputElement;
    expect(reps.value).toBe('12');
    expect(screen.getByRole('textbox', { name: 'Weight, kg' })).toBeTruthy();
    fireEvent.change(reps, { target: { value: '8' } });
    fireEvent.blur(reps);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(warmupItemsOf(cur(wid, eid))[0]).toMatchObject({ reps: 8, done: true });
    expect(screen.getByText('8 reps')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Dumbbell Bicep Curl' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove from warm-up' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    expect(cur(wid, eid).warmupItems).toBeUndefined();
  });

  it('the drawer is warm-up blue; Remove is the red danger button and asks first; Keep cancels', () => {
    const { wid, eid } = setup([], {
      warmupItems: [{ name: 'Dumbbell Bicep Curl', reps: 12 }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Log' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Dumbbell Bicep Curl' }));
    expect(document.querySelector('.sheet.uit--warmup')).toBeTruthy();
    const remove = screen.getByRole('button', { name: 'Remove from warm-up' });
    expect(remove.className).toContain('uibtn--danger');
    fireEvent.click(remove);
    const dlg = screen.getByRole('alertdialog');
    expect(dlg.textContent).toContain('Delete “Dumbbell Bicep Curl”?');
    fireEvent.click(within(dlg).getByRole('button', { name: 'Keep' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(warmupItemsOf(cur(wid, eid))).toHaveLength(1);
  });

  it('Save is disabled until a value differs from the logged one, and again when edited back', () => {
    setup([], { warmupItems: [{ name: 'Dumbbell Bicep Curl', reps: 12 }] });
    fireEvent.click(screen.getByRole('button', { name: 'Log' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Dumbbell Bicep Curl' }));
    const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    const reps = screen.getByRole('textbox', { name: 'Reps' }) as HTMLInputElement;
    fireEvent.change(reps, { target: { value: '10' } });
    fireEvent.blur(reps);
    expect(save.disabled).toBe(false);
    fireEvent.change(reps, { target: { value: '12' } });
    fireEvent.blur(reps);
    expect(save.disabled).toBe(true);
  });

  it('a pending logger can be removed with its x; an empty block is a generic warm-up again', () => {
    const { wid, eid } = setup([], {
      warmupItems: [
        { name: 'Band Pull Apart', exerciseId: 'Band_Pull_Apart', reps: 15 },
        { name: 'Cat Stretch', exerciseId: 'Cat_Stretch', durationSec: 30 },
      ],
    });
    expect(screen.getAllByRole('button', { name: 'Log' })).toHaveLength(2);
    for (let n = 0; n < 2; n++)
      fireEvent.click(screen.getAllByRole('button', { name: 'Remove from warm-up' })[0]);
    expect(cur(wid, eid).warmupItems).toBeUndefined();
    expect(screen.queryByRole('group', { name: 'Minutes' })).toBeNull();
  });

  it('pre-fills a new logger with what was logged last time (still pending until Log)', () => {
    const t0 = Date.UTC(2026, 8, 20, 9);
    const old: Workout = {
      id: 'old',
      startedAt: t0,
      finishedAt: t0 + 3600_000,
      autoFinished: false,
      exercises: [
        {
          id: 'm',
          name: 'Warm-up',
          kind: 'warmup',
          position: 0,
          sets: [],
          warmupItems: [{ id: 'a', name: 'Dumbbell Bicep Curl', reps: 9, weight: 7.5, done: true }],
        },
      ],
    };
    const { wid, eid } = setup([old]);
    pickFromDatabase('dumbbell bicep curl', /^Dumbbell Bicep Curl$/);
    expect(warmupItemsOf(cur(wid, eid))[0]).toMatchObject({ reps: 9, weight: 7.5, done: false });
    expect((screen.getByRole('textbox', { name: 'Weight, kg' }) as HTMLInputElement).value).toBe(
      '7.5',
    );
  });

  it('old data: done:true items read as logged lines, done:false as pending loggers', () => {
    const { wid } = setup();
    const state = __getStateForTests();
    act(() =>
      __replaceStateForTests({
        ...state,
        workouts: state.workouts.map((x) =>
          x.id === wid
            ? {
                ...x,
                exercises: x.exercises.map((e) => ({
                  ...e,
                  warmupDetailed: false,
                  warmupItems: [
                    { id: 'z', name: 'Cat Stretch', durationSec: 60, done: true },
                    { id: 'y', name: 'Arm Circles', reps: 10, done: false },
                  ],
                })),
              }
            : x,
        ),
      } as never),
    );
    expect(screen.getByText('60 s')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Log' })).toHaveLength(1);
    expect(screen.queryByText(/ \/ \d+ done/)).toBeNull();
  });

  it("keeps the Careful flag of the person's conditions on a pickable move", () => {
    const { wid, eid } = setup();
    act(() =>
      __replaceStateForTests({
        ...__getStateForTests(),
        conditions: [
          { id: 'c', key: 'pain_upper_back', severity: 2, share: 'effects', createdAt: 0 },
        ] as never,
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
    fireEvent.change(screen.getByPlaceholderText(/Search/), { target: { value: 'front raise' } });
    expect(screen.getAllByText('Careful').length).toBeGreaterThan(0);
    // flagged, never blocked
    fireEvent.click(screen.getAllByText('Front Raise And Pullover')[0]);
    expect(warmupItemsOf(cur(wid, eid))[0].name).toBe('Front Raise And Pullover');
  });

  it('the picker is the reduced exercise picker: no kind switch, no custom names', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
    expect(screen.queryByRole('group', { name: 'What to add' })).toBeNull();
    expect(screen.queryByText('Cardio')).toBeNull();
    fireEvent.change(screen.getByPlaceholderText(/Search/), {
      target: { value: 'Couch stretch deluxe' },
    });
    expect(screen.queryByText(/Couch stretch deluxe/, { selector: 'button *' })).toBeNull();
  });

  it('offers "Repeat last warm-up" from a finished session and copies its items undone', () => {
    const t0 = Date.UTC(2026, 8, 20, 9);
    const old: Workout = {
      id: 'old',
      startedAt: t0,
      finishedAt: t0 + 3600_000,
      autoFinished: false,
      exercises: [
        {
          id: 'm',
          name: 'Warm-up',
          kind: 'warmup',
          position: 0,
          sets: [],
          warmupItems: [
            { id: 'a', name: 'Dumbbell Bicep Curl', reps: 10, weight: 5, done: true },
            { id: 'b', name: 'Cat Stretch', durationSec: 60, done: true },
            { id: 'c', name: 'Arm Circles', reps: 10, done: false },
          ],
        },
      ],
    };
    const { wid, eid } = setup([old]);
    const btn = screen.getByRole('button', { name: /Repeat last warm-up · 2 exercises · 1 min/ });
    act(() => {
      fireEvent.click(btn);
    });
    const items = warmupItemsOf(cur(wid, eid));
    // only the logged ones are repeated, as pending loggers carrying their values
    expect(items.map((i) => [i.name, i.done])).toEqual([
      ['Dumbbell Bicep Curl', false],
      ['Cat Stretch', false],
    ]);
    expect(items[0].weight).toBe(5);
    expect(items[0].id).not.toBe('a');
    expect(screen.queryByRole('button', { name: /Repeat last warm-up/ })).toBeNull();
  });

  describe('picker suggestions', () => {
    function setupBands() {
      const gym = { id: 'g1', name: 'Home', inventory: ['bands'] } as never;
      __replaceStateForTests({ ...__getStateForTests(), workouts: [], gyms: [gym] });
      const w = startWorkout(null)!;
      addExercise(w.id, 'Barbell Bench Press - Medium Grip', 'strength');
      const ex = addExercise(w.id, 'Warm-up', 'warmup');
      act(() =>
        __replaceStateForTests({
          ...__getStateForTests(),
          workouts: __getStateForTests().workouts.map((x) =>
            x.id === w.id ? { ...x, gymId: 'g1' } : x,
          ),
        }),
      );
      render(<Harness wid={w.id} eid={ex.id} />);
      return { wid: w.id, eid: ex.id };
    }

    it("highlights today's muscle groups and suggests one light station, nothing heavy", () => {
      setupBands();
      fireEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
      expect(screen.getAllByText('Today').length).toBeGreaterThan(0);
      const proposal = warmupProposal({
        muscles: ['chest'],
        gym: { id: 'g1', name: 'Home', inventory: ['bands'] } as never,
      })!;
      expect(proposal.station).toBe('bands');
      for (const it of proposal.items)
        expect(screen.getAllByText(new RegExp(it.name.replace(/[()]/g, '.')))[0]).toBeTruthy();
      expect(screen.queryByText(/Barbell Bench Press - Medium Grip/)).toBeNull();
    });

    it('keeps already-added exercises in the list: no Added badge, suggested again', () => {
      const { wid, eid } = setupBands();
      fireEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
      const first = warmupProposal({
        muscles: ['chest'],
        gym: { id: 'g1', name: 'Home', inventory: ['bands'] } as never,
      })!.items[0].name;
      fireEvent.click(screen.getAllByText(new RegExp(first))[0]);
      expect(warmupItemsOf(cur(wid, eid))[0].name).toBe(first);
      fireEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
      // still suggested, and never marked Added
      expect(
        [...document.querySelectorAll('.xp-sugs-list .xp-row-name')].some(
          (n) => n.textContent === first,
        ),
      ).toBe(true);
      expect(document.querySelector('.xp-badge.done')).toBeNull();
      // adding it a second time works
      fireEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
      const again = [...document.querySelectorAll('.xp-sugs-list .xp-row-name')].find(
        (n) => n.textContent === first,
      )!;
      fireEvent.click(again);
      expect(warmupItemsOf(cur(wid, eid)).filter((x) => x.name === first)).toHaveLength(2);
    });
  });
});

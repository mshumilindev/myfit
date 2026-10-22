import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { equipmentLabel } from '../components/Muscle';
import { equipmentById } from '../data/equipmentCatalog';
import {
  customExercises,
  registerCustomExercises,
  richExerciseByName,
  subRegionsByName,
} from '../data/exercises';
import { __getStateForTests } from '../store';
import {
  emptyState,
  freezeClock,
  makeShell,
  richState,
  seed,
  setDesktop,
} from './__fixtures__/viewKit';

const m = vi.hoisted(() => ({ role: 'member' as string }));
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  getRole: () => m.role,
}));

import { ExerciseDetailView } from './ExerciseDetailView';

const BENCH = 'Barbell Bench Press - Medium Grip';
const open = (name = BENCH) => {
  const shell = makeShell();
  const onClose = vi.fn();
  const out = render(<ExerciseDetailView name={name} shell={shell} onClose={onClose} />);
  return { ...out, shell, onClose };
};
const tile = (label: string) => {
  const l = [...document.querySelectorAll('.exd-tile-label')].find((x) => x.textContent === label);
  return l?.previousElementSibling?.textContent;
};

/** Heaviest non-warm-up set and the number of finished sessions with the lift in the fixture. */
function benchFacts() {
  const finished = __getStateForTests().workouts.filter((w) => w.finishedAt !== null);
  const sets = finished.flatMap((w) =>
    w.exercises.filter((e) => e.name === BENCH).flatMap((e) => e.sets),
  );
  const sessions = finished.filter((w) => w.exercises.some((e) => e.name === BENCH)).length;
  const record = Math.max(...sets.filter((s) => !s.isWarmup).map((s) => s.weight ?? 0));
  return { record, sessions };
}

beforeEach(() => {
  freezeClock();
  setLocale('en');
  localStorage.clear();
  m.role = 'member';
  seed(richState());
  setDesktop(false);
  registerCustomExercises([]);
});
afterEach(() => {
  cleanup();
  registerCustomExercises([]);
  vi.useRealTimers();
});

describe('ExerciseDetailView: a library lift', () => {
  it('shows the classification badges from the record', () => {
    const { container } = open();
    const rich = richExerciseByName(BENCH)!;
    const badges = [...container.querySelectorAll('.exd-badges > *')].map((b) => b.textContent);
    expect(badges).toContain(en.categoryNames[rich.category!]);
    if (rich.mechanic) expect(badges).toContain(en.mechanicNames[rich.mechanic]);
    if (rich.force) expect(badges).toContain(en.forceNames[rich.force]);
    expect(badges).toContain(en.equipmentNames[rich.equipment!]);
    expect(container.querySelector('.exd-title')?.textContent).toBe(BENCH);
  });

  it('lists primary and secondary muscles; each opens the muscle history', () => {
    const { container, shell } = open();
    const rich = richExerciseByName(BENCH)!;
    expect(screen.getByText(en.musclesWorkedLabel)).toBeTruthy();
    const rows = container.querySelectorAll('.exd-mrow-badges');
    expect(rows).toHaveLength(2);
    expect([...rows[0].children].map((c) => c.textContent)).toEqual(
      rich.primaryMuscles.map((x) => en.muscleGroups[x]),
    );
    expect([...rows[1].children].map((c) => c.textContent)).toEqual(
      rich.secondaryMuscles.map((x) => en.muscleGroups[x]),
    );
    fireEvent.click(rows[0].children[0]);
    expect(shell.openOverlay).toHaveBeenLastCalledWith({
      screen: 'muscle-history',
      muscle: rich.primaryMuscles[0],
    });
    fireEvent.click(rows[1].children[0]);
    expect(shell.openOverlay).toHaveBeenLastCalledWith({
      screen: 'muscle-history',
      muscle: rich.secondaryMuscles[0],
    });
    expect(screen.getByText(en.musclesLegend)).toBeTruthy();
  });

  it('chest lifts show the fine sub-regions', () => {
    const { container } = open();
    const sub = subRegionsByName(BENCH)!;
    expect(sub.primary).toEqual(['chest-lower', 'chest-upper']);
    const tags = [...container.querySelectorAll('.exd-subregions > *')].map((t) => t.textContent);
    expect(tags).toEqual(
      [...sub.primary, ...(sub.secondary ?? [])].map((f) => en.subMuscleNames[f]),
    );
    expect(container.querySelectorAll('.exd-subregions > *')[0].className).not.toBe(
      container.querySelectorAll('.exd-subregions > *')[2].className,
    );
  });

  it('loads the numbered instructions', async () => {
    const { container } = open();
    await waitFor(() => expect(container.querySelectorAll('.exd-instr').length).toBeGreaterThan(0));
    expect(screen.getByText(en.instructionsLabel)).toBeTruthy();
    expect(container.querySelector('.exd-instr-n')?.textContent).toBe('1');
  });

  it('the history tiles come from the logged sessions', () => {
    open();
    const { record, sessions } = benchFacts();
    expect(tile(en.recordKg)).toBe(String(record));
    expect(tile(en.detailSessions)).toBe(String(sessions));
    expect(tile(en.est1rmLabel)).not.toBe('—');
    expect(tile(en.lastTop)).not.toBe('—');
  });

  it('with no history the tiles show dashes and zero sessions', () => {
    seed(emptyState());
    open();
    expect(tile(en.recordKg)).toBe('—');
    expect(tile(en.est1rmLabel)).toBe('—');
    expect(tile(en.lastTop)).toBe('—');
    expect(tile(en.detailSessions)).toBe('0');
  });

  it('form photos open a zoomable lightbox that closes on Escape', () => {
    const { container } = open();
    const rich = richExerciseByName(BENCH)!;
    expect(rich.images).toHaveLength(2);
    const photos = container.querySelectorAll('.exd-formphoto');
    expect(photos).toHaveLength(2);
    fireEvent.click(photos[0]);
    const box = document.querySelector('.exd-lightbox') as HTMLElement;
    expect(box.querySelector('.exd-lightbox-title')?.textContent).toBe(en.photoStart);
    expect(document.body.style.overflow).toBe('hidden');
    const zoomOut = within(box).getByRole('button', { name: en.zoomOut }) as HTMLButtonElement;
    const zoomIn = within(box).getByRole('button', { name: en.zoomIn }) as HTMLButtonElement;
    expect(zoomOut.disabled).toBe(true);
    fireEvent.click(zoomIn);
    expect(box.textContent).toContain('150%');
    fireEvent.click(zoomIn);
    fireEvent.click(zoomIn);
    fireEvent.click(zoomIn);
    expect(box.textContent).toContain('300%');
    expect(zoomIn.disabled).toBe(true);
    fireEvent.click(zoomOut);
    expect(box.textContent).toContain('250%');
    fireEvent.doubleClick(box.querySelector('img')!);
    expect(box.textContent).toContain('100%');
    fireEvent.doubleClick(box.querySelector('img')!);
    expect(box.textContent).toContain('250%');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.querySelector('.exd-lightbox')).toBeNull();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('the header photo opens the lightbox titled with the lift; the close button closes it', () => {
    const { container } = open();
    const hero = container.querySelector('.exd-media.photo')!;
    expect(hero).toBeTruthy();
    fireEvent.click(hero);
    expect(document.querySelector('.exd-lightbox-title')?.textContent).toBe(BENCH);
    fireEvent.click(
      within(document.querySelector('.exd-lightbox-top') as HTMLElement).getByRole('button', {
        name: en.cancel,
      }),
    );
    expect(document.querySelector('.exd-lightbox')).toBeNull();
    fireEvent.click(hero);
    fireEvent.click(
      within(document.querySelector('.exd-lightbox') as HTMLElement).getAllByRole('button', {
        name: en.cancel,
      })[0],
    );
    expect(document.querySelector('.exd-lightbox')).toBeNull();
  });

  it('a broken photo is hidden', () => {
    const { container } = open();
    const img = container.querySelector('.exd-media img') as HTMLImageElement;
    expect(img).toBeTruthy();
    fireEvent.error(img);
    expect(img.style.display).toBe('none');
  });

  it('the available-at-your-gym line appears when the usual gym stocks the equipment', () => {
    open();
    expect(__getStateForTests().gyms.find((g) => g.id === 'g1')!.inventory).toContain('barbell');
    expect(document.querySelector('.exd-avail')?.textContent).toContain(
      en.availableAtGymLine(equipmentLabel('barbell')),
    );
  });

  it('no availability line when the gym does not stock it', () => {
    const s = richState();
    s.gyms = s.gyms.map((g) => ({ ...g, inventory: ['kettlebell'] }));
    seed(s);
    open();
    expect(document.querySelector('.exd-avail')).toBeNull();
  });

  it('suggests alternatives with a match and where they are available; tapping one opens it', () => {
    const { container, shell } = open();
    const rows = container.querySelectorAll('.swap-row');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(4);
    expect(rows[0].querySelector('.swap-match')?.textContent).toMatch(/^\d+% match$/);
    expect(rows[0].querySelector('.swap-avail')).toBeTruthy();
    fireEvent.click(rows[0]);
    const call = (shell.openOverlay as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0];
    expect(call.screen).toBe('exercise-detail');
    expect(call.name).not.toBe(BENCH);
  });

  it('without any gym the alternatives list the equipment they need', () => {
    const s = richState();
    s.gyms = [];
    s.workouts = s.workouts.map((w) => ({ ...w, gymId: null }));
    seed(s);
    const { container } = open();
    const classes = [...container.querySelectorAll('.swap-avail')].map((a) => a.className);
    expect(classes.length).toBeGreaterThan(0);
    expect(classes.every((c) => c.includes('neutral') || c.includes('any'))).toBe(true);
  });

  it('marks alternatives the gym cannot equip', () => {
    const s = richState();
    s.gyms = s.gyms.map((g) => ({ ...g, equipmentItems: ['bench-flat'], inventory: ['barbell'] }));
    seed(s);
    const { container } = open();
    const classes = [...container.querySelectorAll('.swap-avail')].map((a) => a.className);
    expect(classes.some((c) => c.includes('warn') || c.includes('ok') || c.includes('any'))).toBe(
      true,
    );
  });

  it('records per machine show only when the lift was done on two or more variants', () => {
    open();
    expect(screen.queryByText(en.exRecByMachine)).toBeNull();
    cleanup();
    const mk = (id: string, gymId: string, items: string[], kg: number, startedAt: number) => ({
      id,
      startedAt,
      finishedAt: startedAt + 3_600_000,
      autoFinished: false,
      gymId,
      dayName: null,
      targetMuscles: [],
      exercises: [
        {
          id: `e-${id}`,
          name: 'Leg Press',
          kind: 'strength',
          position: 0,
          primaryMuscle: 'quads',
          secondaryMuscles: [],
          equipmentItems: items,
          sets: [{ id: `s-${id}`, reps: 10, weight: kg, isWarmup: false }],
        },
      ],
    });
    const s = richState();
    s.workouts = [
      mk('a', 'g1', ['smith-machine'], 180, 1_000),
      mk('b', 'g2', [], 150, 2_000),
    ] as never;
    seed(s);
    const { container } = open('Leg Press');
    expect(screen.getByText(en.exRecByMachine)).toBeTruthy();
    const rows = [...container.querySelectorAll('.uigl-rows > *')];
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain(equipmentById('smith-machine')!.name);
    expect(rows[0].textContent).toContain('180 × 10');
    expect(rows[1].textContent).toContain(en.exNoMachine);
    expect(rows[1].textContent).toContain('Home Rack');
    expect(rows[1].textContent).toContain('150 × 10');
  });
});

describe('ExerciseDetailView: actions on a phone', () => {
  it('Back closes', () => {
    const { onClose } = open();
    fireEvent.click(screen.getByRole('button', { name: en.backAction }));
    expect(onClose).toHaveBeenCalled();
  });

  it('"Add to today\'s session" starts a workout with the lift and opens it', () => {
    const { shell } = open();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.addToTodaySession) }));
    const live = __getStateForTests().workouts.find((w) => w.finishedAt === null)!;
    expect(live.exercises.map((e) => e.name)).toEqual([BENCH]);
    expect(shell.openOverlay).toHaveBeenCalledWith({ screen: 'session', workoutId: live.id });
  });

  it('adds to the session already in progress instead of starting another', () => {
    const { shell } = open();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.addToTodaySession) }));
    cleanup();
    open('Barbell Squat');
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.addToTodaySession) }));
    const live = __getStateForTests().workouts.filter((w) => w.finishedAt === null);
    expect(live).toHaveLength(1);
    expect(live[0].exercises.map((e) => e.name)).toEqual([BENCH, 'Barbell Squat']);
    void shell;
  });

  it('does nothing visible when a session cannot be started (activity running)', () => {
    const s = richState();
    s.activities = [{ ...s.activities[0], finishedAt: null }];
    seed(s);
    const { shell } = open();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.addToTodaySession) }));
    expect(shell.openOverlay).not.toHaveBeenCalled();
  });
});

describe('ExerciseDetailView: desktop', () => {
  beforeEach(() => setDesktop(true));

  it('shows the breadcrumb, full history and add actions', () => {
    const { container, shell, onClose } = open();
    expect(container.querySelector('.exd-crumb')?.textContent).toBe(
      `${en.exercisesTabLabel} / ${BENCH}`,
    );
    fireEvent.click(screen.getByRole('button', { name: en.fullHistory }));
    expect(shell.openOverlay).toHaveBeenCalledWith({ screen: 'exercise-history', name: BENCH });
    fireEvent.click(screen.getByRole('button', { name: en.backAction }));
    expect(onClose).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.addToTodaySession) }));
    expect(shell.openOverlay).toHaveBeenLastCalledWith(
      expect.objectContaining({ screen: 'session' }),
    );
  });
});

describe('ExerciseDetailView: custom and sparse lifts', () => {
  const custom = {
    id: 'zz custom press',
    name: 'ZZ Custom Press',
    primaryMuscle: 'chest' as const,
    secondaryMuscles: ['triceps' as const],
    equipment: ['dumbbell'],
  };

  it('a name nobody has still renders from what is logged: no badges, two tiles, no photos', () => {
    const { container } = open('Totally Unknown Lift');
    expect(container.querySelector('.exd-title')?.textContent).toBe('Totally Unknown Lift');
    expect(container.querySelectorAll('.exd-badges > *')).toHaveLength(0);
    expect(container.querySelector('.exd-tiles')?.className).toContain('n2');
    expect(container.querySelector('.exd-formphotos')).toBeNull();
    expect(container.querySelector('.exd-media.none')).toBeTruthy();
    expect(screen.queryByText(en.musclesWorkedLabel)).toBeNull();
  });

  it('a custom lift takes its muscles and equipment from the catalog entry', () => {
    registerCustomExercises([custom]);
    const { container } = open('ZZ Custom Press');
    expect(screen.getByText(en.musclesWorkedLabel)).toBeTruthy();
    const rows = container.querySelectorAll('.exd-mrow-badges');
    expect(rows[0].textContent).toBe(en.muscleGroups.chest);
    expect(rows[1].textContent).toBe(en.muscleGroups.triceps);
  });

  it('only a trainer or admin gets Edit on a custom lift', () => {
    registerCustomExercises([custom]);
    open('ZZ Custom Press');
    expect(screen.queryByRole('button', { name: en.libEditExercise })).toBeNull();
    cleanup();
    m.role = 'trainer';
    open('ZZ Custom Press');
    expect(screen.getByRole('button', { name: en.libEditExercise })).toBeTruthy();
    cleanup();
    open(BENCH);
    expect(screen.queryByRole('button', { name: en.libEditExercise })).toBeNull();
  });

  it('editing saves the new name and muscles into the catalog and closes the editor', () => {
    registerCustomExercises([custom]);
    m.role = 'admin';
    open('ZZ Custom Press');
    fireEvent.click(screen.getByRole('button', { name: en.libEditExercise }));
    const field = screen.getByPlaceholderText(en.exerciseNamePlaceholder) as HTMLInputElement;
    expect(field.value).toBe('ZZ Custom Press');
    fireEvent.change(field, { target: { value: 'ZZ Custom Press II' } });
    const sheet = field.closest('.new-exercise-sheet') as HTMLElement;
    fireEvent.click(within(sheet).getByRole('button', { name: en.save }));
    expect(document.querySelector('.new-exercise-sheet')).toBeNull();
    expect(customExercises().map((e) => e.name)).toEqual(['ZZ Custom Press II']);
  });
});

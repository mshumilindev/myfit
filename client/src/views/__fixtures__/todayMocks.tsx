/**
 * Boundary mocks + helpers for the Today screen tests (`TodayView.*.cases.test.tsx`): the assigned program (Firestore
 * cache) and the program-day starter are faked; the store, layout, role (localStorage) and every card are real.
 * Import this module BEFORE `./TodayView` so its `vi.mock` calls apply.
 */
import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { __getStateForTests } from '../../store';
import type { StoreState } from '../../store';
import { setRole } from '../../api';
import { getTodayLayout, resetTodayLayout, setCoreOpts, setTodayLayout } from '../../today/layout';
import type { CoreOptsMap, NudgeKind } from '../../today/layout';
import { DAY, NOW, makeShell, richState, seed, setDesktop } from './viewKit';

const hoisted = vi.hoisted(() => ({
  mine: { assignment: null as unknown, active: true },
  startDay: vi.fn<(...a: unknown[]) => string | null>(() => 'w-prog'),
  roster: null as unknown,
}));
export const m = hoisted;

vi.mock('../../data/programMine', async (orig) => ({
  ...(await orig<typeof import('../../data/programMine')>()),
  useProgramMine: () => hoisted.mine,
  startProgramDaySession: (...a: unknown[]) =>
    (hoisted.startDay as (...x: unknown[]) => string | null)(...a),
}));

// The coach's client roster is a cloud call: faked (null = "not loaded / not a coach", the real default for members).
vi.mock('../../today/clientRoster', async (orig) => ({
  ...(await orig<typeof import('../../today/clientRoster')>()),
  useClientRoster: () => hoisted.roster,
}));

/** A member's assigned program: Mon push, Wed legs, Sat pull (Saturday 2026-09-26 is "today"). */
export function assignment(over: Record<string, unknown> = {}, days: number[] = [1, 3, 6]) {
  const names: Record<number, string> = { 1: 'Push', 3: 'Legs', 6: 'Pull' };
  return {
    program: {
      id: 'p1',
      name: 'Strength Block',
      weeks: 8,
      daysPerWeek: days.length,
      status: 'active',
      authorId: 'u1',
      dayNames: names,
      targetMuscles: {},
      items: days.map((d, i) => ({
        id: `i${i}`,
        day: d,
        position: 0,
        name: d === 3 ? 'Barbell Squat' : 'Barbell Bench Press - Medium Grip',
        kind: 'strength',
        sets: 3,
        reps: 5,
        durationMin: null,
        equipment: 'barbell',
        groupId: null,
        groupOrder: null,
        dropLast: false,
      })),
      ...over,
    },
    assignedBy: null,
    startedAt: NOW - 14 * DAY,
    week: 2,
    done: 0,
    total: days.length,
  };
}

export function resetTodayMocks(): void {
  m.mine = { assignment: null, active: true };
  m.startDay.mockReset();
  m.startDay.mockReturnValue('w-prog');
  m.roster = null;
  localStorage.clear();
  resetTodayLayout();
  setRole('member');
  setDesktop(false);
}

/** Today for the given state; `store` is the live state object, as App passes it. */
export async function openToday(state: StoreState = richState()) {
  const { TodayView } = await import('../TodayView');
  seed(state);
  const shell = makeShell();
  const out = render(<TodayView shell={shell} store={__getStateForTests() as never} />);
  return { ...out, shell };
}

/** Change the Program block's options the way the Customize sheet does. */
export function programOpts(patch: Partial<CoreOptsMap['program']>): void {
  setTodayLayout(setCoreOpts(getTodayLayout(), 'program', patch));
}
export function nudgesOff(...kinds: NudgeKind[]): void {
  setTodayLayout(setCoreOpts(getTodayLayout(), 'nudges', { off: kinds }));
}
export { DAY };

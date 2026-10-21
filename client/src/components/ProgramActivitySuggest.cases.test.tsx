import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { __getStateForTests, __replaceStateForTests } from '../store';
import { programSuggestOffPref } from '../activityPrefs';
import { setLocale } from '../i18n';
import type { Activity } from '../types';
import { weekStartOf } from '../weekStart';

const saved = vi.fn<(id: string, list: unknown[]) => Promise<void>>(async () => undefined);
let assignment: Record<string, unknown> | null = null;
let active = true;

vi.mock('../data/programMine', () => ({
  useProgramMine: () => ({ assignment, active }),
  refreshProgramMine: () => undefined,
}));
vi.mock('../data/programActivities', () => ({
  isOwnProgram: (a: { program: { authorId?: string } } | null) => a?.program.authorId === 'me',
  savePlannedActivities: (id: string, list: unknown[]) => saved(id, list),
}));

import {
  AddToProgramSheet,
  ProgramActivitySuggest,
  useEditableProgram,
} from './ProgramActivitySuggest';
import { renderHook } from '@testing-library/react';

const DAY = 86400000;
const NOW = new Date(2026, 8, 30, 12).getTime(); // Wed
const monday = weekStartOf(NOW, 1);
const sat = (back: number): Activity => ({
  id: `p${back}`,
  type: 'padel',
  category: 'conditioning',
  startedAt: monday - back * 7 * DAY + 5 * DAY + 10 * 3600000,
  finishedAt: monday - back * 7 * DAY + 5 * DAY + 10 * 3600000 + 78 * 60000,
  durationMin: 78,
});
const program = (over: Record<string, unknown> = {}) => ({
  program: { id: 'prog1', authorId: 'me', name: 'P', items: [], ...over },
});
const lastSaved = () => saved.mock.calls.at(-1) as [string, Array<Record<string, unknown>>];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(NOW);
  setLocale('en');
  programSuggestOffPref.reset();
  saved.mockClear();
  active = true;
  assignment = program();
  __replaceStateForTests({ ...__getStateForTests(), activities: [1, 2, 3, 4, 5].map(sat) });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useEditableProgram', () => {
  it('is editable only for an active own program with an openable activity list', () => {
    expect(renderHook(() => useEditableProgram()).result.current.own).toBe(true);
    active = false;
    expect(renderHook(() => useEditableProgram()).result.current.own).toBe(false);
    active = true;
    assignment = program({ authorId: 'coach' });
    expect(renderHook(() => useEditableProgram()).result.current.own).toBe(false);
    assignment = program({ activitiesEnc: { v: 1 } });
    expect(renderHook(() => useEditableProgram()).result.current.own).toBe(false);
    assignment = null;
    expect(renderHook(() => useEditableProgram()).result.current.own).toBe(false);
  });

  it('returns the sanitised planned list', () => {
    assignment = program({
      activities: [
        { id: 'a', day: 2, type: 'padel', minutes: 60, effort: 'hard', when: 'any' },
        { nonsense: true },
      ],
    });
    const { planned } = renderHook(() => useEditableProgram()).result.current;
    expect(planned.map((p) => p.id)).toEqual(['a']);
  });
});

describe('ProgramActivitySuggest · sheet', () => {
  const openAdd = () => {
    render(<ProgramActivitySuggest />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to Saturday' }));
  };
  const submit = async () => {
    const btns = screen.getAllByRole('button', { name: /^Add to / });
    await act(async () => {
      fireEvent.click(btns[btns.length - 1]);
    });
  };

  it('lets the member pick another day, a different length and effort before adding', async () => {
    openAdd();
    const days = screen.getByRole('group', { name: 'Day' });
    expect(within(days).getAllByRole('button')).toHaveLength(7);
    fireEvent.click(within(days).getByRole('button', { name: 'Fri' }));
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hard' }));
    await submit();
    expect(lastSaved()[1][0]).toMatchObject({
      day: 5,
      type: 'padel',
      minutes: 80,
      effort: 'hard',
      when: 'any',
    });
  });

  it('hides days the type is already planned on', () => {
    assignment = program({
      activities: [
        { id: 'x', day: 1, type: 'padel', minutes: 60, effort: 'moderate', when: 'any' },
      ],
    });
    openAdd();
    const days = within(screen.getByRole('group', { name: 'Day' })).getAllByRole('button');
    expect(days).toHaveLength(6);
    expect(days.map((d) => d.textContent)).not.toContain('Mon');
  });

  it('appends to the existing list, and closes the sheet', async () => {
    const existing = { id: 'x', day: 1, type: 'run', minutes: 30, effort: 'light', when: 'any' };
    assignment = program({ activities: [existing] });
    openAdd();
    await submit();
    expect(lastSaved()[1]).toHaveLength(2);
    expect(lastSaved()[1][0]).toMatchObject({ id: 'x' });
    expect(screen.queryByRole('group', { name: 'Day' })).toBeNull();
  });

  it('the Undo bar disappears after eight seconds', async () => {
    openAdd();
    await submit();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    act(() => void vi.advanceTimersByTime(7999));
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeTruthy();
    act(() => void vi.advanceTimersByTime(1));
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });
});

describe('ProgramActivitySuggest · Not now', () => {
  const openLater = () => {
    render(<ProgramActivitySuggest />);
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
  };

  it('snoozes the activity for two weeks (a dated entry)', () => {
    openLater();
    fireEvent.click(screen.getByText('Ask again in 14 days'));
    const entry = programSuggestOffPref.get()[0];
    expect(entry).toBe(`later:padel:${NOW + 14 * DAY}`);
    expect(screen.queryByText('You do Padel most Saturdays')).toBeNull();
  });

  it('prunes expired snoozes when muting something new', () => {
    programSuggestOffPref.set([`later:run:${NOW - 1}`, `later:swim:${NOW + DAY}`]);
    openLater();
    fireEvent.click(screen.getByText('Never suggest Padel'));
    expect(programSuggestOffPref.get()).toEqual([`later:swim:${NOW + DAY}`, 'padel']);
  });

  it('stops all suggestions and hides the card', () => {
    openLater();
    fireEvent.click(screen.getByText('Stop all suggestions'));
    expect(programSuggestOffPref.get()).toEqual(['*']);
    expect(screen.queryByText('You do Padel most Saturdays')).toBeNull();
  });

  it('shows muted activities with Turn on, which removes just that one', () => {
    programSuggestOffPref.set(['swim', 'run', `later:x:${NOW + DAY}`]);
    openLater();
    const list = screen.getByText('Turned off').parentElement as HTMLElement;
    expect(within(list).getByText('Swim')).toBeTruthy();
    expect(within(list).getByText('Run')).toBeTruthy();
    expect(within(list).queryByText(/later:/)).toBeNull(); // snoozes are not listed
    fireEvent.click(within(list).getAllByRole('button', { name: 'Turn on' })[0]);
    expect(programSuggestOffPref.get()).toEqual(['run', `later:x:${NOW + DAY}`]);
  });

  it('with everything muted the open sheet lists "All suggestions" and can turn them back on', () => {
    openLater();
    act(() => programSuggestOffPref.set(['*', 'swim']));
    expect(screen.getByText('All suggestions')).toBeTruthy();
    // no suggestion any more: only the stop-all row remains in the options
    expect(screen.queryByText('Ask again in 14 days')).toBeNull();
    const row = screen.getByText('All suggestions').closest('li, div')!
      .parentElement as HTMLElement;
    fireEvent.click(within(row).getAllByRole('button', { name: 'Turn on' })[0]);
    expect(programSuggestOffPref.get()).toEqual(['swim']);
  });

  it('hides the options that need a suggestion when none exists', () => {
    openLater();
    act(() => programSuggestOffPref.set(['padel']));
    expect(screen.queryByText('Never suggest Padel')).toBeNull();
    expect(screen.getByText('Stop all suggestions')).toBeTruthy();
  });
});

describe('AddToProgramSheet', () => {
  it('renders nothing for a trainer program', () => {
    assignment = program({ authorId: 'coach' });
    const { container } = render(
      <AddToProgramSheet type="padel" weekday={6} minutes={60} onClose={() => undefined} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('opens with the requested weekday and saves a new entry, then closes', async () => {
    const onClose = vi.fn();
    render(<AddToProgramSheet type="padel" weekday={3} minutes={45} onClose={onClose} />);
    expect(screen.getByText('Add Padel to your program')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add to Wednesday' })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add to Wednesday' }));
    });
    expect(lastSaved()[0]).toBe('prog1');
    expect(lastSaved()[1][0]).toMatchObject({
      day: 3,
      type: 'padel',
      minutes: 45,
      effort: 'moderate',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('falls back to the first free day when the weekday is already planned', () => {
    assignment = program({
      activities: [
        { id: 'x', day: 3, type: 'padel', minutes: 60, effort: 'moderate', when: 'any' },
      ],
    });
    render(<AddToProgramSheet type="padel" weekday={3} minutes={45} onClose={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Add to Monday' })).toBeTruthy();
  });

  it('falls back to the raw key for an unknown activity type', () => {
    render(<AddToProgramSheet type="zorbing" weekday={2} minutes={45} onClose={() => undefined} />);
    expect(screen.getByText('Add zorbing to your program')).toBeTruthy();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { __getStateForTests, __replaceStateForTests } from '../store';
import { programSuggestOffPref } from '../activityPrefs';
import { setLocale } from '../i18n';
import type { Activity } from '../types';
import { weekStartOf } from '../weekStart';

const saved = vi.fn<(id: string, list: unknown[]) => Promise<void>>(async () => undefined);
let assignment: Record<string, unknown> | null = null;

vi.mock('../data/programMine', () => ({
  useProgramMine: () => ({ assignment, active: true }),
  refreshProgramMine: () => undefined,
}));
vi.mock('../data/programActivities', () => ({
  isOwnProgram: (a: { program: { authorId?: string } } | null) => a?.program.authorId === 'me',
  savePlannedActivities: (id: string, list: unknown[]) => saved(id, list),
}));

import { ProgramActivitySuggest } from './ProgramActivitySuggest';

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

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  setLocale('en');
  programSuggestOffPref.reset();
  saved.mockClear();
  assignment = program();
  __replaceStateForTests({
    ...__getStateForTests(),
    activities: [1, 2, 3, 4, 5].map(sat),
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ProgramActivitySuggest (Today)', () => {
  it('offers the weekly pattern and adds it to the program, with Undo', async () => {
    render(<ProgramActivitySuggest />);
    expect(screen.getByText('You do Padel most Saturdays')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add to Saturday' }));
    // the sheet's own CTA
    const ctas = screen.getAllByRole('button', { name: 'Add to Saturday' });
    await act(async () => {
      fireEvent.click(ctas[ctas.length - 1]);
    });
    expect(saved).toHaveBeenCalledTimes(1);
    const [id, list] = saved.mock.calls[0] as [string, Array<Record<string, unknown>>];
    expect(id).toBe('prog1');
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ type: 'padel', day: 6, minutes: 75 });
    // Undo restores the previous (empty) list
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    });
    expect(saved).toHaveBeenLastCalledWith('prog1', []);
  });

  it("stays hidden for a trainer's program, a muted activity, and a planned one", () => {
    assignment = program({ authorId: 'coach' });
    const { unmount } = render(<ProgramActivitySuggest />);
    expect(screen.queryByText('You do Padel most Saturdays')).toBeNull();
    unmount();
    assignment = program({
      activities: [
        { id: 'x', day: 6, type: 'padel', minutes: 60, effort: 'moderate', when: 'any' },
      ],
    });
    const second = render(<ProgramActivitySuggest />);
    expect(screen.queryByText('You do Padel most Saturdays')).toBeNull();
    second.unmount();
    assignment = program();
    programSuggestOffPref.set(['padel']);
    render(<ProgramActivitySuggest />);
    expect(screen.queryByText('You do Padel most Saturdays')).toBeNull();
  });

  it('does not guess while a sealed list cannot be opened', () => {
    assignment = program({ activitiesEnc: { v: 1 } });
    render(<ProgramActivitySuggest />);
    expect(screen.queryByText('You do Padel most Saturdays')).toBeNull();
  });

  it('Not now → never suggest this activity is remembered, and can be turned back on', () => {
    render(<ProgramActivitySuggest />);
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    fireEvent.click(screen.getByText('Never suggest Padel'));
    expect(programSuggestOffPref.get()).toEqual(['padel']);
    expect(screen.queryByText('You do Padel most Saturdays')).toBeNull();
  });
});

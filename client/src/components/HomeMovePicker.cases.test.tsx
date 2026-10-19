import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setLocale } from '../i18n';
import { __getStateForTests, __replaceStateForTests } from '../store';
import { HOME_CATALOG, type HomeMove } from '../homeSets';
import type { Workout } from '../types';

const saveHomeSet = vi.fn();
const saveHomeMove = vi.fn();
vi.mock('../store', async (orig) => ({
  ...(await orig<typeof import('../store')>()),
  saveHomeSet: (...a: unknown[]) => saveHomeSet(...a),
  saveHomeMove: (...a: unknown[]) => saveHomeMove(...a),
}));

import { HomeMovePicker } from './HomeMovePicker';

const own: HomeMove = {
  id: 'own-1',
  name: 'Doorframe hang',
  measure: 'hold',
  muscle: 'forearms',
  icon: 'bar',
  custom: true,
};
const workout = (over: Partial<Workout> = {}): Workout => ({
  id: 'w1',
  startedAt: 1,
  finishedAt: null,
  autoFinished: false,
  kind: 'home',
  exercises: [],
  ...over,
});
function setHome(
  moves: HomeMove[],
  sets: Array<{ id: string; name: string; moves: string[] }> = [],
) {
  __replaceStateForTests({
    ...__getStateForTests(),
    home: { ...__getStateForTests().home, moves, sets } as never,
  });
}

beforeEach(() => {
  setLocale('en');
  saveHomeSet.mockReset();
  saveHomeMove.mockReset();
  setHome([]);
});
afterEach(cleanup);

const addBtn = () => screen.getByRole('button', { name: /^Add( |$)/ }) as HTMLButtonElement;

describe('HomeMovePicker', () => {
  it('lists the Spotter catalog, hides the own-moves section when empty, and disables Add', () => {
    render(
      <HomeMovePicker workout={workout()} onPick={() => undefined} onClose={() => undefined} />,
    );
    expect(screen.getByText('Add move', { selector: '.hs-title' })).toBeTruthy();
    expect(screen.queryByText('My moves')).toBeNull();
    expect(screen.getByText('Spotter’s home moves')).toBeTruthy();
    expect(document.querySelectorAll('.hs-mlist [aria-pressed]')).toHaveLength(HOME_CATALOG.length);
    expect(addBtn().disabled).toBe(true);
    expect(screen.getByText('Gym exercises stay in gym sessions.')).toBeTruthy();
  });

  it('shows own moves first, with a custom name verbatim', () => {
    setHome([own]);
    render(
      <HomeMovePicker workout={workout()} onPick={() => undefined} onClose={() => undefined} />,
    );
    expect(screen.getByText('My moves')).toBeTruthy();
    expect(screen.getByText('Doorframe hang')).toBeTruthy();
    expect(screen.getByText('Forearms · Hold')).toBeTruthy();
  });

  it('hides moves already in the session (case-insensitive)', () => {
    render(
      <HomeMovePicker
        workout={workout({
          exercises: [{ id: 'e', name: 'pushups', position: 0, sets: [] } as never],
        })}
        onPick={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(document.querySelectorAll('.hs-mlist [aria-pressed]')).toHaveLength(
      HOME_CATALOG.length - 1,
    );
  });

  it('selects a row (toggle) and picks it with Add', () => {
    const onPick = vi.fn();
    setHome([own]);
    render(<HomeMovePicker workout={workout()} onPick={onPick} onClose={() => undefined} />);
    const row = screen.getByText('Doorframe hang').closest('[aria-pressed]') as HTMLElement;
    fireEvent.click(row);
    expect(row.getAttribute('aria-pressed')).toBe('true');
    expect(addBtn().textContent).toBe('Add Doorframe hang');
    fireEvent.click(row);
    expect(row.getAttribute('aria-pressed')).toBe('false');
    expect(addBtn().disabled).toBe(true);
    fireEvent.click(row);
    fireEvent.click(addBtn());
    expect(onPick).toHaveBeenCalledWith(own);
    expect(saveHomeSet).not.toHaveBeenCalled();
  });

  it('adds the move to the saved home set it came from, once', () => {
    const onPick = vi.fn();
    setHome([own], [{ id: 's1', name: 'Morning', moves: ['Plank'] }]);
    render(
      <HomeMovePicker
        workout={workout({ homeSetId: 's1' })}
        onPick={onPick}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByText(/Morning/, { selector: '.hs-note' })).toBeTruthy();
    fireEvent.click(screen.getByText('Doorframe hang').closest('[aria-pressed]')!);
    fireEvent.click(addBtn());
    expect(saveHomeSet).toHaveBeenCalledWith({
      id: 's1',
      name: 'Morning',
      moves: ['Plank', 'own-1'],
    });
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('does not touch the set when the move is already in it', () => {
    setHome([own], [{ id: 's1', name: 'Morning', moves: ['own-1'] }]);
    render(
      <HomeMovePicker
        workout={workout({ homeSetId: 's1' })}
        onPick={() => undefined}
        onClose={() => undefined}
      />,
    );
    fireEvent.click(screen.getByText('Doorframe hang').closest('[aria-pressed]')!);
    fireEvent.click(addBtn());
    expect(saveHomeSet).not.toHaveBeenCalled();
  });

  it('in replace mode uses the replace title and never edits the set', () => {
    const onPick = vi.fn();
    setHome([own], [{ id: 's1', name: 'Morning', moves: [] }]);
    render(
      <HomeMovePicker
        workout={workout({ homeSetId: 's1' })}
        replacing
        onPick={onPick}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByText('Replace exercise')).toBeTruthy();
    expect(screen.getByText('Gym exercises stay in gym sessions.')).toBeTruthy();
    fireEvent.click(screen.getByText('Doorframe hang').closest('[aria-pressed]')!);
    fireEvent.click(addBtn());
    expect(saveHomeSet).not.toHaveBeenCalled();
    expect(onPick).toHaveBeenCalledWith(own);
  });

  it('creates an own move in place: form, back, validation and save', () => {
    const onPick = vi.fn();
    saveHomeMove.mockImplementation((i: Omit<HomeMove, 'id'>) => ({
      ...i,
      id: 'new-1',
      custom: true,
    }));
    render(<HomeMovePicker workout={workout()} onPick={onPick} onClose={() => undefined} />);
    fireEvent.click(screen.getByText('Create your own move'));
    expect(screen.getByText('New move')).toBeTruthy();
    const save = screen.getByRole('button', { name: 'Save move' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    // back returns to the list
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Spotter’s home moves')).toBeTruthy();
    fireEvent.click(screen.getByText('Create your own move'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Ring row ' } });
    const save2 = screen.getByRole('button', { name: 'Save move' }) as HTMLButtonElement;
    expect(save2.disabled).toBe(false);
    fireEvent.click(save2);
    expect(saveHomeMove).toHaveBeenCalledWith(
      expect.objectContaining({ name: '  Ring row ', measure: 'reps', muscle: 'core' }),
    );
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-1' }));
  });

  it('keeps Save disabled for a name already taken', () => {
    setHome([own]);
    render(
      <HomeMovePicker workout={workout()} onPick={() => undefined} onClose={() => undefined} />,
    );
    fireEvent.click(screen.getByText('Create your own move'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'doorframe hang' } });
    expect((screen.getByRole('button', { name: 'Save move' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

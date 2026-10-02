import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { HomeSetView, type HomeSetRoute } from './HomeSetView';
import { pruneHomeSetDrafts } from './homeSetDraft';
import { setLocale } from '../../i18n';
import { en } from '../../i18n/en';
import { et } from '../../i18n/et';
import { lt } from '../../i18n/lt';
import { pl } from '../../i18n/pl';
import { uk } from '../../i18n/uk';
import { EMPTY_HOME } from '../../homeSets';
import type { Shell, Overlay } from '../../App';
import {
  __getStateForTests,
  __replaceStateForTests,
  deleteHomeSet,
  saveHomeMove,
  saveHomeSet,
  startWorkout,
  addExercise,
} from '../../store';

type Cur = ({ screen: 'home-set' } & HomeSetRoute) | { screen: 'session'; workoutId: string };
interface Nav {
  cur: Cur | null;
  stack: Cur[];
}

/** The app's overlay stack in miniature: open pushes, replace swaps, close pops. */
function Harness() {
  const [nav, setNav] = useState<Nav>({ cur: { screen: 'home-set' }, stack: [] });
  useEffect(() => {
    pruneHomeSetDrafts([nav.cur, ...nav.stack]);
    (window as unknown as { __nav: Nav }).__nav = nav;
  }, [nav]);
  const shell = {
    openOverlay: (o: Overlay) =>
      setNav((n) =>
        o === null
          ? { cur: null, stack: [] }
          : { cur: o as Cur, stack: n.cur ? [...n.stack, n.cur] : n.stack },
      ),
    replaceOverlay: (o: Overlay) => setNav((n) => ({ cur: o as Cur, stack: n.stack })),
  } as unknown as Shell;
  const close = () =>
    setNav((n) =>
      n.stack.length
        ? { cur: n.stack[n.stack.length - 1], stack: n.stack.slice(0, -1) }
        : { cur: null, stack: [] },
    );
  const cur = nav.cur;
  if (!cur) return <div>closed</div>;
  if (cur.screen === 'session') return <div>session {cur.workoutId}</div>;
  return <HomeSetView shell={shell} {...cur} onClose={close} />;
}

const nav = () => (window as unknown as { __nav: Nav }).__nav;
const home = () => __getStateForTests().home;
const btn = (name: string | RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement;

beforeEach(() => {
  setLocale('en');
  __replaceStateForTests({
    ...__getStateForTests(),
    home: EMPTY_HOME,
    workouts: [],
    activities: [],
    sleeps: [],
  });
});
afterEach(cleanup);

function seed() {
  return saveHomeSet({ name: 'Morning', moves: ['Pullups', 'Pushups'] });
}

describe('Home set screen — Sets tab', () => {
  it('shows the empty state with New home set', () => {
    render(<Harness />);
    expect(screen.getByText('No home sets yet')).toBeTruthy();
    expect(btn('New home set')).toBeTruthy();
  });

  it('lists saved sets with their move count and a play button', () => {
    seed();
    render(<Harness />);
    expect(screen.getByText('Morning')).toBeTruthy();
    expect(screen.getByText(/2 moves · Not done yet/)).toBeTruthy();
    expect(btn('Start Morning')).toBeTruthy();
  });

  it('play starts the set right away and leaves the screen for the session', () => {
    seed();
    render(<Harness />);
    fireEvent.click(btn('Start Morning'));
    const w = __getStateForTests().workouts.find((x) => x.kind === 'home');
    expect(w?.dayName).toBe('Morning');
    expect(w?.exercises.map((e) => e.name)).toEqual(['Pullups', 'Pushups']);
    expect(nav().cur).toEqual({ screen: 'session', workoutId: w?.id });
    expect(nav().stack).toEqual([]);
  });

  it('play is locked while another session is live', () => {
    seed();
    const w = startWorkout(null, { dayName: 'Push day' });
    addExercise(w!.id, 'Bench Press');
    render(<Harness />);
    expect(screen.getByText('Finish Push day first')).toBeTruthy();
    expect(btn('Start Morning').disabled).toBe(true);
  });
});

describe('Home set screen — new set', () => {
  function openNew() {
    render(<Harness />);
    fireEvent.click(btn('New home set'));
  }
  function pick(...names: string[]) {
    fireEvent.click(screen.getByText('Choose moves'));
    for (const n of names) fireEvent.click(screen.getByText(n));
  }

  it('Save and Start stay disabled until there is a name and a move', () => {
    openNew();
    expect(screen.getByText('Save keeps it · Start runs it once')).toBeTruthy();
    expect(btn('Save').disabled).toBe(true);
    expect(btn('Start').disabled).toBe(true);
    pick('Pullups');
    fireEvent.click(btn(/^Add 1 to/));
    // a move, no name: Start works (runs once), Save does not
    expect(btn('Start').disabled).toBe(false);
    expect(btn('Save').disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Evening' } });
    expect(btn('Save').disabled).toBe(false);
  });

  it('the picker adds the ticked moves to the draft, which survives the hop', () => {
    openNew();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Evening' } });
    pick('Pullups', 'Plank');
    fireEvent.click(btn('Add 2 to Evening'));
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Evening');
    expect(screen.getByText('Moves · 2')).toBeTruthy();
    expect(screen.getByText('Pullups')).toBeTruthy();
    expect(screen.getByText('Plank')).toBeTruthy();
    // already-chosen moves are not offered again
    fireEvent.click(screen.getByText('Add move'));
    expect(screen.queryByText('Pullups')).toBeNull();
  });

  it('Save keeps the set and returns to the list', () => {
    openNew();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: ' Evening ' } });
    pick('Pullups');
    fireEvent.click(btn(/^Add 1 to/));
    fireEvent.click(btn('Save'));
    expect(home().sets.map((s) => [s.name, s.moves])).toEqual([['Evening', ['Pullups']]]);
    expect(btn('Open Evening')).toBeTruthy();
  });

  it('Start runs it once without saving', () => {
    openNew();
    pick('Plank');
    fireEvent.click(btn(/^Add 1 to/));
    fireEvent.click(btn('Start'));
    expect(home().sets).toHaveLength(0);
    const w = __getStateForTests().workouts.find((x) => x.kind === 'home');
    expect(w?.homeSetId).toBeNull();
    expect(nav().cur?.screen).toBe('session');
  });

  it('Back discards the draft', () => {
    openNew();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Evening' } });
    fireEvent.click(btn('Back'));
    fireEvent.click(btn('New home set'));
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('');
  });
});

describe('Home set screen — edit a saved set', () => {
  function openEdit() {
    seed();
    render(<Harness />);
    fireEvent.click(btn('Open Morning'));
  }

  it('Save is disabled until something changed; edits are a draft', () => {
    openEdit();
    expect(screen.getByText('Edit home set')).toBeTruthy();
    expect(btn('Save').disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Early' } });
    expect(home().sets[0].name).toBe('Morning');
    expect(btn('Save').disabled).toBe(false);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Morning' } });
    expect(btn('Save').disabled).toBe(true);
  });

  it('reordering and removing count as changes and save on Save', () => {
    openEdit();
    fireEvent.click(screen.getAllByRole('button', { name: 'Move down' })[0]);
    expect(btn('Save').disabled).toBe(false);
    fireEvent.click(btn('Save'));
    expect(home().sets[0].moves).toEqual(['Pushups', 'Pullups']);
  });

  it('removing a move asks first and counts as a change', () => {
    openEdit();
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove from this home set' })[0]);
    expect(screen.getAllByText('Pullups').length).toBeGreaterThan(0);
    const dlg = screen.getByRole('alertdialog');
    expect(btn('Save').disabled).toBe(true);
    fireEvent.click(within(dlg).getByRole('button', { name: 'Cancel' }));
    expect(btn('Save').disabled).toBe(true);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove from this home set' })[0]);
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' }),
    );
    expect(btn('Save').disabled).toBe(false);
    fireEvent.click(btn('Save'));
    expect(home().sets[0].moves).toEqual(['Pushups']);
  });

  it('Cancel drops the draft', () => {
    openEdit();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Early' } });
    fireEvent.click(btn('Cancel'));
    expect(home().sets[0].name).toBe('Morning');
    fireEvent.click(btn('Open Morning'));
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Morning');
  });

  it('Delete asks first, then removes the set', () => {
    openEdit();
    expect(screen.getByText('Past “Morning” sessions stay in History.')).toBeTruthy();
    fireEvent.click(screen.getByText('Delete home set'));
    expect(home().sets).toHaveLength(1);
    const dlg = screen.getByRole('alertdialog');
    fireEvent.click(within(dlg).getByRole('button', { name: 'Delete' }));
    expect(home().sets).toHaveLength(0);
    expect(screen.getByText('No home sets yet')).toBeTruthy();
  });

  it('a set deleted elsewhere sends its page back to the home page', () => {
    const s = seed();
    render(<Harness />);
    fireEvent.click(btn('Open Morning'));
    act(() => deleteHomeSet(s.id));
    expect(screen.getByText('No home sets yet')).toBeTruthy();
  });
});

describe('Home set screen — My moves', () => {
  function openMoves() {
    render(<Harness />);
    fireEvent.click(screen.getByRole('tab', { name: 'Moves' }));
  }

  it('shows My moves only once you have created one', () => {
    openMoves();
    expect(screen.queryByText('My moves')).toBeNull();
    expect(screen.getByText('Spotter’s home moves')).toBeTruthy();
  });

  it('lists your own moves and Spotter’s, filtered by muscle', () => {
    saveHomeMove({ name: 'Doorframe hang', measure: 'hold', muscle: 'forearms', icon: 'bar' });
    openMoves();
    expect(screen.getByText('My moves')).toBeTruthy();
    expect(screen.getByText('Doorframe hang')).toBeTruthy();
    expect(screen.getByText('Spotter’s home moves')).toBeTruthy();
    expect(screen.getByText('Pullups')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Forearms' }));
    expect(screen.queryByText('Pullups')).toBeNull();
    expect(screen.getByText('Doorframe hang')).toBeTruthy();
  });

  it('a Spotter move opens a read-only page', () => {
    openMoves();
    fireEvent.click(screen.getByText('Pullups'));
    expect(screen.getByText('About this move')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('own move form: a taken name is an error and blocks Save', () => {
    saveHomeMove({ name: 'Doorframe hang', measure: 'hold', muscle: 'forearms', icon: 'bar' });
    openMoves();
    fireEvent.click(btn('New move'));
    const name = screen.getByLabelText('Name');
    expect(btn('Save move').disabled).toBe(true);
    fireEvent.change(name, { target: { value: 'doorframe hang' } });
    expect(screen.getByText('You already have a move with this name.')).toBeTruthy();
    expect(btn('Save move').disabled).toBe(true);
    fireEvent.change(name, { target: { value: 'Ring row' } });
    expect(btn('Save move').disabled).toBe(false);
    fireEvent.click(btn('Save move'));
    expect(home().moves.map((m) => m.name)).toContain('Ring row');
  });

  it('editing an own move: Save needs a change; Delete goes through a confirm', () => {
    const m = saveHomeMove({ name: 'Ring row', measure: 'reps', muscle: 'lats', icon: 'bar' });
    saveHomeSet({ name: 'Back', moves: [m.id] });
    openMoves();
    fireEvent.click(screen.getByText('Ring row'));
    expect(btn('Save').disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ring rows' } });
    expect(btn('Save').disabled).toBe(false);
    fireEvent.click(screen.getByText('Delete move'));
    expect(home().moves).toHaveLength(1);
    expect(within(screen.getByRole('alertdialog')).getByText(/“Back”/)).toBeTruthy();
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    expect(home().moves).toHaveLength(0);
    expect(home().sets[0].moves).toEqual([]);
  });

  it('a move created from the picker comes back ticked', () => {
    render(<Harness />);
    fireEvent.click(btn('New home set'));
    fireEvent.click(screen.getByText('Choose moves'));
    fireEvent.click(screen.getByText('Create your own move'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ring row' } });
    fireEvent.click(btn('Save move'));
    expect(btn(/^Add 1 to/)).toBeTruthy();
    expect(screen.getByText('Ring row')).toBeTruthy();
  });
});

describe('Home set strings', () => {
  it('every locale has the new keys; counts are pluralised', () => {
    for (const d of [en, uk, pl, lt, et]) {
      expect(d.homeTabSets).toBeTruthy();
      expect(d.homeEmptyTitle).toBeTruthy();
      expect(d.homeAddCountTo(2, 'X')).toContain('X');
    }
    expect(uk.homeMovesCount(1)).toBe('1 вправа');
    expect(uk.homeMovesCount(3)).toBe('3 вправи');
    expect(uk.homeMovesCount(11)).toBe('11 вправ');
    expect(pl.homeMovesCount(2)).toBe('2 ćwiczenia');
    expect(pl.homeMovesCount(5)).toBe('5 ćwiczeń');
    expect(lt.homeMovesCount(10)).toBe('10 pratimų');
    expect(lt.homeMovesCount(3)).toBe('3 pratimai');
  });
});

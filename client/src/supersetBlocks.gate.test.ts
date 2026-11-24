import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addonsPref } from './addons/enabledSet';
import { circuitHost } from './circuitApi';
import { supersetsHost } from './supersetsApi';
import { SupersetBlock } from './supersets/SupersetBlock';
import { SupersetGroupMenu } from './supersets/GroupMenu';
import { SupersetSheet } from './supersets/SupersetSheet';
import { inShownGroup, sessionBlocks } from './supersetBlocks';
import { CircuitBlock } from './circuit/CircuitBlock';
import { CIRCUIT_CONTROLS } from './circuit/CircuitControls';
import { CircuitRunSheet } from './circuit/CircuitRun';
import type { Exercise, Workout } from './types';

const ex = (id: string, position: number, o: Partial<Exercise> = {}): Exercise => ({
  id,
  name: id,
  kind: 'strength',
  position,
  sets: [],
  ...o,
});
const w = (exercises: Exercise[]): Workout => ({
  id: 'w',
  startedAt: 0,
  finishedAt: null,
  autoFinished: false,
  exercises,
});
function installSupersets() {
  supersetsHost.Sheet = SupersetSheet;
  supersetsHost.Block = SupersetBlock;
  supersetsHost.GroupMenu = SupersetGroupMenu;
}

const mixed = w([
  ex('a', 0, { groupId: 's1', groupOrder: 0, groupKind: 'superset' }),
  ex('b', 1, { groupId: 's1', groupOrder: 1, groupKind: 'superset' }),
  ex('c', 2),
  ex('d', 3, { groupId: 'c1', groupOrder: 0, groupKind: 'circuit' }),
  ex('e', 4, { groupId: 'c1', groupOrder: 1, groupKind: 'circuit' }),
]);
const kinds = (x: Workout) =>
  sessionBlocks(x).map((b) => (b.kind === 'single' ? 's' : b.group.circuit ? 'C' : 'G'));

beforeEach(() => addonsPref.reset());
afterEach(() => {
  circuitHost.Block = null;
  circuitHost.RunSheet = null;
  circuitHost.Controls = null;
  supersetsHost.Sheet = null;
  supersetsHost.Block = null;
  supersetsHost.GroupMenu = null;
  addonsPref.reset();
});

describe('Supersets and Circuit gates (neutral contract)', () => {
  it('off: every stored group reads as separate exercises in order, and the data is untouched', () => {
    expect(kinds(mixed)).toEqual(['s', 's', 's', 's', 's']);
    expect(sessionBlocks(mixed).map((b) => (b.kind === 'single' ? b.exercise.id : '?'))).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
    expect(mixed.exercises[0].groupId).toBe('s1');
    expect(inShownGroup(mixed.exercises[0], mixed)).toBe(false);
  });
  it('Supersets installed but not loaded yet still reads as separate exercises', () => {
    addonsPref.set(['supersets']);
    expect(kinds(mixed)).toEqual(['s', 's', 's', 's', 's']);
  });
  it('Supersets on shows supersets only; a circuit stays separate exercises', () => {
    addonsPref.set(['supersets']);
    installSupersets();
    expect(kinds(mixed)).toEqual(['G', 's', 's', 's']);
    expect(inShownGroup(mixed.exercises[3], mixed)).toBe(false);
  });
  it('Circuit installed but not loaded yet still reads as separate exercises', () => {
    addonsPref.set(['circuit']);
    expect(kinds(mixed)).toEqual(['s', 's', 's', 's', 's']);
  });
  it('Circuit installed and loaded shows the circuit; letters count only the shown groups', () => {
    addonsPref.set(['supersets', 'circuit']);
    installSupersets();
    circuitHost.Block = CircuitBlock;
    circuitHost.RunSheet = CircuitRunSheet;
    circuitHost.Controls = CIRCUIT_CONTROLS;
    expect(kinds(mixed)).toEqual(['G', 's', 'C']);
    const letters = sessionBlocks(mixed).flatMap((b) =>
      b.kind === 'group' ? [b.group.letter] : [],
    );
    expect(letters).toEqual(['A', 'B']);
    addonsPref.set(['circuit']);
    expect(kinds(mixed)).toEqual(['s', 's', 's', 'C']);
    expect(
      sessionBlocks(mixed).flatMap((b) => (b.kind === 'group' ? [b.group.letter] : [])),
    ).toEqual(['A']);
  });
});

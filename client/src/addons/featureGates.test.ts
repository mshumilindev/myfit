import { beforeEach, describe, expect, it } from 'vitest';
import { addonsPref } from './enabledSet';
import { goalsAvailable } from './featureGates';
import { __getStateForTests, __replaceStateForTests, getStoreState } from '../store';
import type { FitGoals } from '../goals';

const goals = { physique: 'muscle' } as unknown as FitGoals;

beforeEach(() => {
  __replaceStateForTests({ ...__getStateForTests(), goals });
});

describe('Goals add-on gate (SPO-500)', () => {
  it('without the add-on every reader of the store sees empty goals, the data stays stored', () => {
    addonsPref.reset();
    expect(goalsAvailable()).toBe(false);
    expect(getStoreState().goals.physique).toBeFalsy();
    expect(__getStateForTests().goals.physique).toBe('muscle');
  });
  it('with the add-on the goals are back', () => {
    addonsPref.set(['goals']);
    expect(goalsAvailable()).toBe(true);
    expect(getStoreState().goals.physique).toBe('muscle');
  });
});

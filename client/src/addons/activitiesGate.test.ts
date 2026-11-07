import { beforeEach, describe, expect, it } from 'vitest';
import { addonsPref } from './enabledSet';
import { activitiesAvailable } from './activitiesGate';
import { __getStateForTests, __replaceStateForTests, getStoreState } from '../store';
import type { Activity } from '../types';

const act = {
  id: 'a1',
  type: 'run',
  startedAt: 1,
  finishedAt: 2,
} as unknown as Activity;

beforeEach(() => {
  __replaceStateForTests({ ...__getStateForTests(), activities: [act] });
});

describe('Activities add-on gate (SPO-500)', () => {
  it('without the add-on every reader of the store sees no activities, the data stays stored', () => {
    addonsPref.reset();
    expect(activitiesAvailable()).toBe(false);
    expect(getStoreState().activities).toEqual([]);
    expect(__getStateForTests().activities).toHaveLength(1);
  });
  it('with the add-on they are back', () => {
    addonsPref.set(['activities']);
    expect(activitiesAvailable()).toBe(true);
    expect(getStoreState().activities).toHaveLength(1);
  });
});

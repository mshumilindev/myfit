import { beforeEach, describe, expect, it } from 'vitest';
import { addonsPref } from './enabledSet';
import { sleepAvailable } from './featureGates';
import { __getStateForTests, __replaceStateForTests, getStoreState } from '../store';
import type { SleepNight } from '../types';

const night = { id: 'n1', source: 'live', start: 1_000, end: 30_000_000 } as unknown as SleepNight;

beforeEach(() => {
  __replaceStateForTests({ ...__getStateForTests(), sleeps: [night] });
});

describe('Sleep add-on gate (SPO-500 I8)', () => {
  it('without the add-on every reader sees no nights, so no model uses them; the data stays stored', () => {
    addonsPref.reset();
    expect(sleepAvailable()).toBe(false);
    expect(getStoreState().sleeps).toEqual([]);
    expect(__getStateForTests().sleeps).toHaveLength(1);
  });
  it('with the add-on the nights are back', () => {
    addonsPref.set(['sleep']);
    expect(sleepAvailable()).toBe(true);
    expect(getStoreState().sleeps).toHaveLength(1);
  });
  it('removing the add-on hides them again at once', () => {
    addonsPref.set(['sleep']);
    expect(getStoreState().sleeps).toHaveLength(1);
    addonsPref.reset();
    expect(getStoreState().sleeps).toEqual([]);
  });
});

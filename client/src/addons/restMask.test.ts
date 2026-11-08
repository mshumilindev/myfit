import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addonsPref } from './enabledSet';
import {
  __getStateForTests,
  __replaceStateForTests,
  activeRestPeriod,
  getStoreState,
} from '../store';
import type { RestPeriod } from '../types';

// Owner 08.11: what is not installed is neither used nor shown; the data stays. Illness needs Unwell, rest needs Rest.
const day = Math.floor(Date.now() / 86_400_000);
const mk = (id: string, mode: RestPeriod['mode']): RestPeriod => ({
  id,
  startDay: day - 1,
  endDay: day + 1,
  mode,
  createdAt: 1,
});
let before: ReturnType<typeof __getStateForTests>;
beforeEach(() => {
  before = __getStateForTests();
  __replaceStateForTests({ ...before, restPeriods: [mk('r', 'off'), mk('i', 'illness')] });
  addonsPref.reset();
});
afterEach(() => {
  __replaceStateForTests(before);
  addonsPref.reset();
});

describe('rest periods follow the Rest and Unwell modules', () => {
  it('without the modules no reader sees them, the data stays stored', () => {
    expect(getStoreState().restPeriods).toEqual([]);
    expect(activeRestPeriod()).toBeNull();
    expect(__getStateForTests().restPeriods).toHaveLength(2);
  });
  it('Rest brings back planned rest only, Unwell the illness only', () => {
    addonsPref.set(['health', 'rest']);
    expect(getStoreState().restPeriods.map((r) => r.id)).toEqual(['r']);
    addonsPref.set(['health', 'unwell']);
    expect(getStoreState().restPeriods.map((r) => r.id)).toEqual(['i']);
    addonsPref.set(['health', 'rest', 'unwell']);
    expect(getStoreState().restPeriods).toHaveLength(2);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import {
  activityPins,
  cleanList,
  createListPref,
  listPrefFromDoc,
  nextUpOff,
  pinsPref,
  nextUpOffPref,
  placeInList,
  placePin,
  reconcileListPref,
  togglePin,
  toggleNextUpOff,
} from './activityPrefs';

beforeEach(() => {
  localStorage.clear();
  pinsPref.reset();
  nextUpOffPref.reset();
});

describe('list helpers', () => {
  it('cleanList dedupes and drops junk', () => {
    expect(cleanList(['run', 'run', 3, '', 'sauna', null])).toEqual(['run', 'sauna']);
    expect(cleanList('run')).toEqual([]);
  });
  it('placeInList inserts / moves', () => {
    expect(placeInList(['run', 'dance', 'sauna'], 'tennis', 2)).toEqual([
      'run',
      'dance',
      'tennis',
      'sauna',
    ]);
    expect(placeInList(['run', 'dance', 'sauna'], 'run', 2)).toEqual(['dance', 'sauna', 'run']);
    expect(placeInList(['run'], 'x', 99)).toEqual(['run', 'x']);
    expect(placeInList(['run'], 'x', -3)).toEqual(['x', 'run']);
  });
});

describe('reconcileListPref (last-write-wins merge)', () => {
  const local = { list: ['run'], updatedAt: 100 };
  it('newer remote is applied', () => {
    expect(reconcileListPref(local, { list: ['dance'], updatedAt: 200 })).toEqual({
      apply: { list: ['dance'], updatedAt: 200 },
      push: false,
    });
  });
  it('newer local is pushed', () => {
    expect(reconcileListPref(local, { list: ['dance'], updatedAt: 50 })).toEqual({
      apply: null,
      push: true,
    });
  });
  it('missing remote field: push only a locally edited value', () => {
    expect(reconcileListPref(local, null)).toEqual({ apply: null, push: true });
    expect(reconcileListPref({ list: [], updatedAt: 0 }, null)).toEqual({
      apply: null,
      push: false,
    });
  });
  it('tie: identical is a no-op, differing takes the synced copy', () => {
    expect(reconcileListPref(local, { list: ['run'], updatedAt: 100 })).toEqual({
      apply: null,
      push: false,
    });
    expect(reconcileListPref(local, { list: ['x'], updatedAt: 100 }).apply?.list).toEqual(['x']);
  });
  it('reads fields off the prefs doc', () => {
    const data = {
      weekStart: 1,
      updatedAt: 5,
      activityPins: ['run', 'run', 'sauna'],
      activityPinsUpdatedAt: 9,
    };
    expect(listPrefFromDoc(data, 'activityPins')).toEqual({ list: ['run', 'sauna'], updatedAt: 9 });
    expect(listPrefFromDoc(data, 'nextUpOff')).toBeNull();
    expect(listPrefFromDoc({ nextUpOff: ['walk'] }, 'nextUpOff')).toEqual({
      list: ['walk'],
      updatedAt: 0,
    });
  });
});

describe('list pref store', () => {
  it('persists to localStorage and reloads', () => {
    const a = createListPref('test.pref');
    a.set(['run', 'dance']);
    expect(a.updatedAt()).toBeGreaterThan(0);
    const b = createListPref('test.pref');
    expect(b.get()).toEqual(['run', 'dance']);
  });
  it('a synced value older than the local edit is ignored', () => {
    const a = createListPref('test.pref2');
    a.set(['run'], 500);
    a.set(['dance'], 400);
    expect(a.get()).toEqual(['run']);
    a.set(['dance'], 600);
    expect(a.get()).toEqual(['dance']);
  });
  it('notifies subscribers', () => {
    const a = createListPref('test.pref3');
    let n = 0;
    const off = a.subscribe(() => n++);
    a.set(['x']);
    off();
    a.set(['y']);
    expect(n).toBe(1);
  });
  it('user edits always move the stamp forward', () => {
    const a = createListPref('test.pref4');
    a.set(['x'], Date.now() + 60_000); // synced from a device with a fast clock
    const before = a.updatedAt();
    a.set(['y']);
    expect(a.updatedAt()).toBeGreaterThan(before);
  });
});

describe('pins + nextUpOff', () => {
  it('toggle, order and reorder pins', () => {
    expect(togglePin('run')).toBe(true);
    expect(togglePin('dance')).toBe(true);
    togglePin('sauna');
    expect(activityPins()).toEqual(['run', 'dance', 'sauna']);
    placePin('tennis', 2);
    expect(activityPins()).toEqual(['run', 'dance', 'tennis', 'sauna']);
    placePin('run', 3);
    expect(activityPins()).toEqual(['dance', 'tennis', 'sauna', 'run']);
    expect(togglePin('tennis')).toBe(false);
    expect(activityPins()).toEqual(['dance', 'sauna', 'run']);
  });
  it('nextUpOff toggles independently', () => {
    expect(toggleNextUpOff('sauna')).toBe(true);
    expect(nextUpOff()).toEqual(['sauna']);
    expect(activityPins()).toEqual([]);
    expect(toggleNextUpOff('sauna')).toBe(false);
    expect(nextUpOff()).toEqual([]);
  });
});

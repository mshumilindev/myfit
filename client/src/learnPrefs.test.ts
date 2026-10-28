import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listPrefFromDoc, reconcileListPref } from './activityPrefs';

/** SPO-387: the saved and finished lessons are synced lists; the old plain-array keys are kept. */
async function fresh() {
  vi.resetModules();
  return import('./activityPrefs');
}

describe('learn lists (SPO-387)', () => {
  beforeEach(() => localStorage.clear());

  it('reads the older plain array and sends it to an empty account', async () => {
    localStorage.setItem('spotter.learn.saved', JSON.stringify(['a', 'b', 'a']));
    const m = await fresh();
    expect(m.learnSavedPref.get()).toEqual(['a', 'b']);
    const d = m.reconcileListPref(m.learnSavedPref.snapshot(), null);
    expect(d.push).toBe(true);
  });

  it('a real value already in the account beats the migrated array', async () => {
    localStorage.setItem('spotter.learn.completed', JSON.stringify(['x']));
    const m = await fresh();
    const remote = listPrefFromDoc(
      { learnCompleted: ['y', 'z'], learnCompletedUpdatedAt: 500 },
      'learnCompleted',
    );
    const d = reconcileListPref(m.learnCompletedPref.snapshot(), remote);
    expect(d.apply?.list).toEqual(['y', 'z']);
    expect(d.push).toBe(false);
  });

  it('broken or empty storage gives an empty list that is not sent', async () => {
    localStorage.setItem('spotter.learn.saved', '{not json');
    localStorage.setItem('spotter.learn.completed', '[]');
    const m = await fresh();
    expect(m.learnSavedPref.get()).toEqual([]);
    expect(m.learnCompletedPref.get()).toEqual([]);
    expect(m.reconcileListPref(m.learnCompletedPref.snapshot(), null).push).toBe(false);
  });

  it('an edit is stored in the new format and survives a reload', async () => {
    const m = await fresh();
    m.learnSavedPref.set(['l1', 'l2']);
    expect(JSON.parse(localStorage.getItem('spotter.learn.saved')!)).toMatchObject({
      list: ['l1', 'l2'],
    });
    const m2 = await fresh();
    expect(m2.learnSavedPref.get()).toEqual(['l1', 'l2']);
    expect(m2.learnSavedPref.updatedAt()).toBeGreaterThan(1);
  });

  it('reset removes the key (sign-out leaves nothing behind)', async () => {
    const m = await fresh();
    m.learnCompletedPref.set(['l1']);
    m.learnCompletedPref.reset();
    expect(localStorage.getItem('spotter.learn.completed')).toBeNull();
  });
});

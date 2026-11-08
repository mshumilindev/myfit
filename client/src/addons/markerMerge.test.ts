import { describe, expect, it } from 'vitest';
import { reconcileListPref } from '../activityPrefs';
import { mergeServiceMarkers } from './enabledSet';

const L = (list: string[], updatedAt: number) => ({ list, updatedAt });

describe('service markers survive a sync conflict (SPO-511)', () => {
  it('a stale device that wrote later keeps the marker another device set, and sends it back', () => {
    // device A set "seen" at t=100; device B (offline, older view) toggled an add-on at t=200
    const local = L(['sleep'], 200);
    const remote = L(['sleep', 'seen:make-it-yours'], 100);
    const r = reconcileListPref(local, remote, mergeServiceMarkers);
    expect(r.apply).toEqual(L(['sleep', 'seen:make-it-yours'], 200));
    expect(r.push).toBe(false); // the account already holds exactly this list
  });

  it('each side has a marker the other lacks: both end up with both, the account is updated', () => {
    const local = L(['sleep', 'migrated:roles-v1'], 200);
    const remote = L(['sleep', 'seen:make-it-yours'], 100);
    const r = reconcileListPref(local, remote, mergeServiceMarkers);
    expect(r.apply?.list.sort()).toEqual(['migrated:roles-v1', 'seen:make-it-yours', 'sleep']);
    expect(r.push).toBe(true);
  });

  it('the newer remote list wins for add-ons but keeps local-only markers', () => {
    const local = L(['sleep', 'migrated:roles-v1'], 100);
    const remote = L(['health'], 200);
    const r = reconcileListPref(local, remote, mergeServiceMarkers);
    expect(r.apply).toEqual(L(['health', 'migrated:roles-v1'], 200));
    expect(r.push).toBe(true);
  });

  it('a removed add-on does not come back from the loser', () => {
    const r = reconcileListPref(
      L(['health'], 200),
      L(['health', 'sleep'], 100),
      mergeServiceMarkers,
    );
    expect(r.apply).toBeNull();
    expect(r.push).toBe(true);
    expect(mergeServiceMarkers(['health'], ['health', 'sleep'])).toEqual(['health']);
  });

  it('identical lists do nothing', () => {
    const a = L(['sleep', 'seen:make-it-yours'], 100);
    expect(reconcileListPref(a, { ...a }, mergeServiceMarkers)).toEqual({
      apply: null,
      push: false,
    });
  });

  it('keeps one snooze record: the highest count, so the limit of three cannot be dodged', () => {
    const out = mergeServiceMarkers(
      ['later:make-it-yours:1000:1'],
      ['later:make-it-yours:5000:2', 'later:make-it-yours:9000:1'],
    );
    expect(out).toEqual(['later:make-it-yours:5000:2']);
  });

  it('without a merge function nothing changes (other lists)', () => {
    expect(reconcileListPref(L(['a'], 2), L(['b'], 1))).toEqual({ apply: null, push: true });
    expect(reconcileListPref(L(['a'], 1), L(['b'], 2))).toEqual({
      apply: L(['b'], 2),
      push: false,
    });
  });
});
